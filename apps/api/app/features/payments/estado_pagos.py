"""
Cómo el estado de un pago en Mercado Pago cambia nuestras tablas, y los
reembolsos que quedaron pendientes de reintentar.

Lo usan el webhook, la vuelta del checkout y la conciliación. Reglas:

- Un aviso nunca retrocede un pago que ya cerramos nosotros (liberado,
  reembolsado, cancelado): antes, cualquier estado que no fuera "aprobado"
  marcaba el pago `fallido`, y un aviso de la liberación que hicimos a
  propósito borraba ese hecho.
- Si Mercado Pago dice que se cobró o retuvo plata de una reserva que ya está
  cancelada (el banco aprobó tarde), se devuelve o se suelta sola.
- Un contracargo congela la liquidación del dueño y avisa a los admins.
- Un reembolso que falla queda como `Pago(tipo="reembolso_*", estado="pendiente")`
  y el barrido lo reintenta con la misma clave de idempotencia.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Notificacion, Pago, Reserva, Usuario
from app.features.payments.mercadopago_service import MercadoPagoService
from app.features.communications.notifications.service import crear_notificacion
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

# Ya se le cobró al arrendatario (y así queda aunque Mercado Pago avise "approved" otra vez).
ESTADOS_COBRADOS = ("capturado", "capturado_disputa")
# Cerrados por nosotros: un aviso de la pasarela no los reabre.
ESTADOS_CERRADOS = ("liberado", "reembolsado", "cancelado", "contracargo", "vencido")
# Pagos que la reserva necesita en orden para dejar `pendiente_pago`.
TIPOS_CHECKOUT = ("hold_reserva", "cobro_arriendo")
TIPOS_REEMBOLSO = ("reembolso_total", "reembolso_parcial")

# Reintentos de un reembolso antes de pasarlo a revisión manual (el barrido corre cada 5 min).
MAX_INTENTOS_REEMBOLSO = 24


def es_real(referencia: Optional[str]) -> bool:
    return bool(referencia) and not pagos_simulados.es_pago_simulado(referencia)


# ===========================================================================
# Avisos a los admins
# ===========================================================================
def admins(db: Session) -> List[Usuario]:
    return db.query(Usuario).filter(cast(Usuario.roles_activos, String).ilike('%"admin"%')).all()


def avisar_admins(db: Session, titulo: str, mensaje: str, reserva_id: Optional[str] = None) -> None:
    """Notificación a cada admin (sin commit). También queda en el log como error."""
    logger.error("[PAGOS][ADMIN] %s — %s", titulo, mensaje)
    for admin in admins(db):
        crear_notificacion(
            db, usuario_id=admin.id, tipo="pago", titulo=titulo, mensaje=mensaje,
            entidad_tipo="reserva" if reserva_id else None, entidad_id=reserva_id, commit=False,
        )


# ===========================================================================
# Reembolsos
# ===========================================================================
def registrar_reembolso_pendiente(db: Session, origen: Pago, monto: int, tipo: str = "reembolso_total") -> Pago:
    """Deja anotado un reembolso que la pasarela no pudo hacer, para que el barrido lo reintente."""
    pendiente = Pago(
        id=str(uuid.uuid4()),
        reserva_id=origen.reserva_id,
        usuario_id=origen.usuario_id,
        tipo=tipo,
        monto=int(monto),
        estado="pendiente",
        referencia_pago=origen.referencia_pago,
    )
    db.add(pendiente)
    db.flush()
    return pendiente


def reembolsar_total(db: Session, pago: Pago) -> bool:
    """
    Devuelve entero un cobro ya capturado. Si la pasarela falla, lo deja
    anotado para reintentar y devuelve False (el cobro sigue `capturado`
    hasta que el reintento lo logre).
    """
    if es_real(pago.referencia_pago):
        res = MercadoPagoService.reembolsar(pago.referencia_pago)
        if not res.get("success"):
            logger.error("[REEMBOLSO] Falló el reembolso de %s (%s): %s",
                         pago.id, pago.referencia_pago, res.get("error"))
            registrar_reembolso_pendiente(db, pago, int(pago.monto or 0), "reembolso_total")
            return False
    pago.estado = "reembolsado"
    return True


def _cobro_de(db: Session, reembolso: Pago) -> Optional[Pago]:
    """El pago original (no un reembolso) que corresponde a la misma operación de Mercado Pago."""
    return (
        db.query(Pago)
        .filter(Pago.referencia_pago == reembolso.referencia_pago, ~Pago.tipo.in_(TIPOS_REEMBOLSO))
        .first()
    )


def reintentar_reembolsos_pendientes(db: Session) -> Dict[str, int]:
    """
    Reintenta los reembolsos que fallaron. Misma clave de idempotencia que el
    primer intento (ver `MercadoPagoService.reembolsar`): si aquel sí llegó a
    Mercado Pago, este no devuelve dos veces.
    """
    resumen = {"reintentados": 0, "hechos": 0, "a_revision": 0}
    pendientes = (
        db.query(Pago)
        .filter(Pago.tipo.in_(TIPOS_REEMBOLSO), Pago.estado == "pendiente")
        .all()
    )
    for reembolso in pendientes:
        resumen["reintentados"] += 1
        total = reembolso.tipo == "reembolso_total"
        hecho = False
        if not es_real(reembolso.referencia_pago):
            hecho = True
        else:
            # Si ya figura devuelto en Mercado Pago (el primer intento sí llegó), no se repite.
            actual = MercadoPagoService.obtener_pago(reembolso.referencia_pago)
            if total and actual.get("success") and actual.get("estado") == "refunded":
                hecho = True
            else:
                res = MercadoPagoService.reembolsar(
                    reembolso.referencia_pago, None if total else int(reembolso.monto or 0)
                )
                hecho = bool(res.get("success"))
                if not hecho:
                    logger.warning("[REEMBOLSO] Reintento fallido de %s: %s", reembolso.id, res.get("error"))

        if hecho:
            reembolso.estado = "reembolsado"
            if total:
                cobro = _cobro_de(db, reembolso)
                if cobro and cobro.estado in ESTADOS_COBRADOS:
                    cobro.estado = "reembolsado"
            resumen["hechos"] += 1
            crear_notificacion(
                db, usuario_id=reembolso.usuario_id, tipo="pago", titulo="Devolución realizada",
                mensaje=(f"Te devolvimos ${int(reembolso.monto or 0):,} CLP a tu tarjeta. Según tu banco, "
                         "puede tardar unos días hábiles en verse.").replace(",", "."),
                entidad_tipo="reserva", entidad_id=reembolso.reserva_id, commit=False,
            )
        else:
            # `intentos_liquidacion` es el contador genérico de reintentos de un Pago.
            reembolso.intentos_liquidacion = int(reembolso.intentos_liquidacion or 0) + 1
            if reembolso.intentos_liquidacion >= MAX_INTENTOS_REEMBOLSO:
                reembolso.estado = "en_revision"
                resumen["a_revision"] += 1
                avisar_admins(
                    db, "Reembolso sin poder hacerse",
                    (f"No pudimos devolver ${int(reembolso.monto or 0):,} CLP (pago de Mercado Pago "
                     f"{reembolso.referencia_pago}) tras {reembolso.intentos_liquidacion} intentos. "
                     "Revisa el saldo de la cuenta de Mercado Pago y hazlo a mano.").replace(",", "."),
                    reembolso.reserva_id,
                )
        db.commit()
    return resumen


# ===========================================================================
# Estado de la pasarela -> nuestras tablas
# ===========================================================================
def _reserva_de(db: Session, pago: Pago) -> Optional[Reserva]:
    if not pago.reserva_id:
        return None
    return db.query(Reserva).filter(Reserva.id == pago.reserva_id).first()


def _checkout_completo(db: Session, reserva: Reserva) -> bool:
    """Todos los pagos del checkout de la reserva quedaron bien (ninguno sigue en revisión)."""
    pagos = db.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo.in_(TIPOS_CHECKOUT)).all()
    # Los intentos anteriores que fallaron o se soltaron no cuentan.
    vigentes = [p for p in pagos if p.estado not in ("fallido",) + ESTADOS_CERRADOS]
    return bool(vigentes) and all(p.estado in ("retenido",) + ESTADOS_COBRADOS for p in vigentes)


def _deshacer_en_reserva_cancelada(db: Session, pago: Pago, reserva: Reserva, estado_mp: str) -> None:
    """El banco aprobó tarde una reserva que ya se canceló: se devuelve o suelta sola."""
    if estado_mp == "authorized":
        res = MercadoPagoService.liberar_hold(pago.referencia_pago)
        if res.get("success"):
            pago.estado = "liberado"
        else:
            pago.estado = "retenido"  # liberar_garantias_colgadas lo reintenta
        return
    # approved: se cobró de verdad.
    pago.estado = "capturado"
    hecho = reembolsar_total(db, pago)
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago", titulo="Te devolvemos un cobro",
        mensaje=("Tu banco aprobó un cobro de una reserva que ya estaba cancelada. "
                 + ("Ya lo devolvimos a tu tarjeta." if hecho else "Lo estamos devolviendo a tu tarjeta.")),
        entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
    )


def _por_contracargo(db: Session, pago: Pago, reserva: Optional[Reserva]) -> None:
    """El arrendatario desconoció el cobro con su banco: se congela lo del dueño y se avisa."""
    pago.estado = "contracargo"
    if reserva:
        db.query(Pago).filter(
            Pago.reserva_id == reserva.id,
            Pago.tipo == "liquidacion_dueno",
            Pago.estado.in_(["pendiente", "fallido"]),
        ).update({"estado": "en_revision"}, synchronize_session=False)
    avisar_admins(
        db, "Contracargo recibido",
        (f"El banco revirtió un pago de ${int(pago.monto or 0):,} CLP ({pago.tipo}, Mercado Pago "
         f"{pago.referencia_pago}). La liquidación del dueño quedó en revisión. Responde la disputa "
         "en el panel de Mercado Pago con el contrato, el checklist y las fotos.").replace(",", "."),
        reserva.id if reserva else None,
    )


def aplicar_estado_pasarela(db: Session, pago: Optional[Pago], resultado: Dict[str, Any]) -> None:
    """
    Lleva el estado actual de un pago en Mercado Pago a nuestras tablas.
    Idempotente: se puede llamar varias veces con el mismo aviso. Hace commit.
    """
    if not pago or not resultado.get("success"):
        # Sin respuesta de la pasarela no se toca nada: no sabemos qué pasó.
        return
    estado_mp = resultado.get("estado")
    if resultado.get("payment_id") and pago.estado == "pendiente":
        # En el checkout antiguo la referencia era la preferencia; desde acá, el pago real.
        pago.referencia_pago = str(resultado["payment_id"])
    reserva = _reserva_de(db, pago)

    if estado_mp == "charged_back":
        if pago.estado != "contracargo":
            _por_contracargo(db, pago, reserva)
    elif estado_mp == "refunded":
        if pago.estado != "reembolsado":
            pago.estado = "reembolsado"
            # Si había un reembolso pendiente de esta operación, ya está hecho.
            db.query(Pago).filter(
                Pago.referencia_pago == pago.referencia_pago,
                Pago.tipo == "reembolso_total", Pago.estado == "pendiente",
            ).update({"estado": "reembolsado"}, synchronize_session=False)
    elif estado_mp in ("pending", "in_process"):
        pass  # sigue en revisión del banco
    elif estado_mp in ("rejected", "cancelled"):
        if pago.estado == "pendiente":
            pago.estado = "fallido" if estado_mp == "rejected" else "liberado"
        elif pago.estado == "retenido" and estado_mp == "cancelled":
            # Mercado Pago soltó una garantía que seguíamos contando como retenida (venció).
            pago.estado = "vencido"
            if reserva and reserva.estado not in ("cancelada", "finalizada"):
                avisar_admins(
                    db, "Garantía vencida",
                    (f"La garantía de ${int(pago.monto or 0):,} CLP de una reserva en estado "
                     f"'{reserva.estado}' se liberó sola en Mercado Pago. El auto quedó sin garantía.")
                    .replace(",", "."),
                    reserva.id,
                )
    elif estado_mp in ("authorized", "approved"):
        if reserva and reserva.estado == "cancelada" and pago.estado not in ESTADOS_COBRADOS + ESTADOS_CERRADOS:
            _deshacer_en_reserva_cancelada(db, pago, reserva, estado_mp)
        elif pago.estado in ESTADOS_CERRADOS:
            # Lo dimos por cerrado y la pasarela dice que la plata sigue tomada: se revisa a mano.
            if pago.estado in ("liberado",) and estado_mp == "authorized":
                MercadoPagoService.liberar_hold(pago.referencia_pago)
            elif pago.estado == "liberado" and estado_mp == "approved":
                avisar_admins(
                    db, "Pago cobrado que dimos por liberado",
                    (f"Mercado Pago muestra cobrado el pago {pago.referencia_pago} (${int(pago.monto or 0):,} CLP), "
                     "que en la plataforma figura liberado. Revisa si corresponde devolverlo.").replace(",", "."),
                    pago.reserva_id,
                )
        elif pago.estado not in ESTADOS_COBRADOS:
            pago.estado = "retenido" if estado_mp == "authorized" else "capturado"
            # Pagada, no confirmada: la reserva espera al dueño. Solo avanza cuando TODO el
            # checkout quedó bien (antes bastaba con que llegara la garantía, aunque el
            # cobro del arriendo siguiera en revisión del banco).
            if reserva and reserva.estado == "pendiente_pago":
                db.flush()
                if _checkout_completo(db, reserva):
                    from app.features.bookings.reservations import confirmacion_service

                    confirmacion_service.esperar_confirmacion_del_dueno(db, reserva)
    db.commit()
    db.refresh(pago)


# ===========================================================================
# Conciliación con Mercado Pago
# ===========================================================================
_ultima_conciliacion: Optional[datetime] = None


def conciliar(db: Session, ventana_horas: int = 3, forzar: bool = False) -> Dict[str, int]:
    """
    Compara con Mercado Pago los pagos que cambiaron en las últimas horas:
      · los que tenemos, se llevan a nuestro estado con las mismas reglas del
        webhook (cubre avisos perdidos: caída del servidor, webhook mal configurado);
      · los que Mercado Pago tiene cobrados o retenidos y nosotros no, se
        avisan a los admins (una vez por pago) para revisarlos a mano.
    Corre como mucho una vez cada `CONCILIACION_INTERVALO_MINUTOS` (salvo `forzar`).
    """
    global _ultima_conciliacion
    resumen = {"revisados": 0, "aplicados": 0, "huerfanos": 0}
    if not MercadoPagoService.credenciales_configuradas() or pagos_simulados.pagos_simulados_activos():
        return resumen
    ahora = datetime.utcnow()
    intervalo = timedelta(minutes=settings.CONCILIACION_INTERVALO_MINUTOS)
    if not forzar and _ultima_conciliacion and ahora - _ultima_conciliacion < intervalo:
        return resumen
    _ultima_conciliacion = ahora

    offset = 0
    while offset < 1000:  # tope de seguridad por pasada
        pagina = MercadoPagoService.buscar_pagos_actualizados(
            f"NOW-{int(ventana_horas)}HOURS", "NOW", offset=offset,
        )
        if not pagina.get("success"):
            logger.error("[CONCILIACION] No se pudo consultar Mercado Pago: %s", pagina.get("error"))
            break
        for resultado in pagina["pagos"]:
            resumen["revisados"] += 1
            try:
                pago = buscar_pago_local(db, resultado)
                if pago:
                    antes = pago.estado
                    aplicar_estado_pasarela(db, pago, resultado)
                    if pago.estado != antes:
                        resumen["aplicados"] += 1
                        logger.warning("[CONCILIACION] Pago %s: %s -> %s (Mercado Pago: %s)",
                                       pago.id, antes, pago.estado, resultado.get("estado"))
                elif resultado.get("estado") in ("approved", "authorized"):
                    if _avisar_huerfano(db, resultado):
                        resumen["huerfanos"] += 1
                    db.commit()
            except Exception:  # noqa: BLE001 — un pago raro no frena la conciliación
                db.rollback()
                logger.exception("[CONCILIACION] Falló el pago %s", resultado.get("payment_id"))
        offset += len(pagina["pagos"])
        if not pagina["pagos"] or offset >= int(pagina.get("total") or 0):
            break
    if resumen["aplicados"] or resumen["huerfanos"]:
        logger.warning("[CONCILIACION] %s", resumen)
    return resumen


def _avisar_huerfano(db: Session, resultado: Dict[str, Any]) -> bool:
    """Un pago cobrado o retenido en Mercado Pago que no está en la base. Avisa una sola vez."""
    payment_id = str(resultado.get("payment_id") or "")
    ya_avisado = (
        db.query(Notificacion.id)
        .filter(Notificacion.titulo == TITULO_HUERFANO, Notificacion.mensaje.contains(payment_id))
        .first()
    )
    if ya_avisado:
        return False
    estado = "cobrado" if resultado.get("estado") == "approved" else "retenido (garantía)"
    avisar_admins(
        db, TITULO_HUERFANO,
        (f"Mercado Pago tiene el pago {payment_id} {estado} por ${int(float(resultado.get('monto') or 0)):,} CLP "
         f"(referencia {resultado.get('referencia_externa') or '—'}) y la plataforma no lo tiene registrado. "
         "Revisa si corresponde devolverlo o soltarlo.").replace(",", "."),
    )
    return True


TITULO_HUERFANO = "Pago sin registrar en la plataforma"


def buscar_pago_local(db: Session, resultado: Dict[str, Any]) -> Optional[Pago]:
    """Nuestro `Pago` para un pago de Mercado Pago: por external_reference (= Pago.id) o por su id."""
    referencia = resultado.get("referencia_externa")
    pago = db.query(Pago).filter(Pago.id == referencia).first() if referencia else None
    if not pago and resultado.get("payment_id"):
        pago = (
            db.query(Pago)
            .filter(Pago.referencia_pago == str(resultado["payment_id"]), ~Pago.tipo.in_(TIPOS_REEMBOLSO))
            .first()
        )
    return pago
