"""
Pago automático de las liquidaciones a los dueños vía transferencia BCI.

Barre los Pago(tipo="liquidacion_dueno") en 'pendiente'/'fallido'/'procesando'
cuyo dueño tiene una cuenta de cobro predeterminada y los transfiere. Se dispara
al cerrar la devolución (intentar_liquidar) y desde un bucle de fondo periódico.

No-op salvo `settings.BCI_PAYOUTS_HABILITADO`. Nunca toca holds ni cobros.

SEGURIDAD — dos hallazgos del review final, cerrados acá (camino de plata real):

  1. Doble transferencia por barridos concurrentes. El barrido corre desde
     varios lados a la vez (loop de fondo, POST /admin/liquidaciones/ejecutar,
     y el enganche de la devolución). El diseño original leía la fila 'pendiente'
     y luego la marcaba 'procesando' en un paso aparte: dos barridos podían leer
     la misma fila antes de que ninguno escribiera y depositar dos veces. Ahora
     `_claim()` es un `UPDATE ... WHERE estado=:prev` atómico y solo el que hace
     `rowcount==1` transfiere. Además, una fila 'procesando' se considera
     huérfana (re-transferible) solo si lleva > `_minutos_stale_procesando()`
     ahí: mientras `bci_payouts.transferir()` está en vuelo, `procesando_desde`
     es reciente y nadie la vuelve a tomar.

  2. Barrido global disparable por cualquier usuario. `PUT /me/cuenta-bancaria`
     y `POST /me/cuentas-cobro` (solo gated por sesión, cualquier autenticado)
     llamaban a `ejecutar_liquidaciones_pendientes()` SIN filtro de usuario, o
     sea una pasada de pagos de TODA la plataforma bajo demanda. Ahora esos
     endpoints pasan `usuario_id=current_user.id` y el barrido global queda solo
     para el loop de fondo y el endpoint de admin.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import String, and_, cast, or_, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Notificacion, Pago, Reserva, Usuario
from app.features.payments import bci_payouts
from app.features.communications.notifications.service import crear_notificacion
from app.features.communications.email.service import enviar_deposito_realizado

logger = logging.getLogger(__name__)

MAX_INTENTOS_LIQUIDACION = 3

_ESTADOS_BARRIDO = ["pendiente", "fallido", "procesando"]

# Título único del aviso "tu plata está lista" (se emite al cerrar la devolución
# y, si el dueño no tiene cuenta, también desde el barrido). Es la clave de
# idempotencia: nunca se manda dos veces para el mismo pago.
TITULO_LIQUIDACION_LISTA = "Tu arriendo finalizó"

# Piso de minutos que una fila debe llevar en 'procesando' antes de que el
# barrido la considere huérfana. Por debajo de esto puede ser una transferencia
# BCI todavía en vuelo y re-tomarla significaría pagar dos veces.
_PROCESANDO_STALE_MIN_PISO = 5


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _corte_retencion() -> datetime:
    """Solo se transfieren las liquidaciones creadas antes de este momento (UTC sin zona, como la columna)."""
    return _ahora() - timedelta(days=settings.LIQUIDACION_RETENCION_DIAS)


def _minutos_stale_procesando() -> int:
    """Umbral de antigüedad para tratar un 'procesando' como huérfano."""
    intervalo = int(getattr(settings, "LIQUIDACIONES_INTERVALO_MINUTOS", 0) or 0)
    return max(_PROCESANDO_STALE_MIN_PISO, intervalo)


def _cuenta_predeterminada(db: Session, usuario_id: str) -> Optional[dict]:
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    cb = (u.cuenta_bancaria or {}) if u else {}
    return cb if cb.get("numero") else None


def _claim(db: Session, pago_id: str, estado_previo: str) -> bool:
    """Compare-and-set atómico: reclama la fila para este barrido.

    Devuelve True solo si ESTE proceso pasó la fila de `estado_previo` a
    'procesando'. Si otro barrido ya la tomó, rowcount == 0 -> False.
    Funciona igual en SQLite y Postgres.
    """
    rc = db.execute(
        text(
            "UPDATE pagos SET estado='procesando', procesando_desde=:ahora "
            "WHERE id=:id AND estado=:prev"
        ),
        {"id": pago_id, "prev": estado_previo, "ahora": _ahora()},
    ).rowcount
    db.commit()
    return rc == 1


def _marcar_fallido(db: Session, pago: Pago) -> str:
    pago.estado = "fallido"
    pago.procesando_desde = None
    pago.intentos_liquidacion = (pago.intentos_liquidacion or 0) + 1
    db.commit()
    if pago.intentos_liquidacion >= MAX_INTENTOS_LIQUIDACION:
        _notificar_fallo_final(db, pago)
    return "fallida"


def _compensar_multas_dueno(db: Session, dueno_id: str, liquidacion: Pago) -> int:
    """
    Compensa deudas líquidas y exigibles del dueño (multas por no presentación o cancelación tardía)
    contra el monto de su liquidación (Art. 1655 y ss. del Código Civil de Chile).
    Devuelve el monto total compensado en CLP.
    """
    multas = (
        db.query(Pago)
        .filter(Pago.usuario_id == dueno_id, Pago.tipo == "multa_dueno", Pago.estado == "pendiente")
        .order_by(Pago.timestamp.asc())
        .all()
    )
    if not multas:
        return 0

    monto_disp = int(liquidacion.monto or 0)
    total_comp = 0
    ahora = _ahora()

    for m in multas:
        if monto_disp <= 0:
            break
        m_monto = int(m.monto or 0)
        descontar = min(monto_disp, m_monto)
        monto_disp -= descontar
        total_comp += descontar

        if descontar == m_monto:
            m.estado = "pagado"
            m.referencia_pago = f"COMPENSADO-LIQ-{liquidacion.id[:8]}"
            m.liquidado_en = ahora
        else:
            # Compensación parcial
            m.monto = m_monto - descontar
            m_compensada = Pago(
                reserva_id=m.reserva_id,
                usuario_id=m.usuario_id,
                tipo="multa_dueno",
                monto=descontar,
                estado="pagado",
                referencia_pago=f"COMPENSADO-LIQ-{liquidacion.id[:8]}",
                liquidado_en=ahora,
            )
            db.add(m_compensada)

    if total_comp > 0:
        db.flush()
    return total_comp


def _marcar_pagado(
    db: Session,
    pago: Pago,
    cuenta: dict,
    transfer_id: Optional[str],
    compensado: int = 0,
    neto_transferido: Optional[int] = None,
) -> str:
    pago.estado = "pagado"
    pago.procesando_desde = None
    if transfer_id:
        pago.referencia_pago = transfer_id
    pago.liquidado_en = pago.liquidado_en or _ahora()
    db.commit()
    _notificar_pagada(db, pago, cuenta, compensado=compensado, neto_transferido=neto_transferido)
    return "pagada"


def _reconciliar_procesando(db: Session, pago: Pago, cuenta: dict) -> Optional[str]:
    """Fila 'procesando' huérfana (proceso muerto entre el claim y el resultado).

    Con transfer_id -> se consulta el estado real en BCI. Sin transfer_id ->
    devuelve None para que el llamador la re-transfiera bajo un claim nuevo.
    """
    if pago.referencia_pago:
        try:
            estado = (bci_payouts.consultar_transferencia(pago.referencia_pago) or {}).get("estado")
        except Exception as e:  # noqa: BLE001
            logger.error("[LIQUIDACIONES] consultar_transferencia falló para %s: %s", pago.id, e)
            return "omitida"
        if estado == "acreditada":
            return _marcar_pagado(db, pago, cuenta, pago.referencia_pago)
        if estado == "rechazada":
            return _marcar_fallido(db, pago)
        return "omitida"  # sigue en proceso: no la contamos
    return None


def _procesar_uno(db: Session, pago: Pago) -> str:
    """Devuelve 'pagada' | 'fallida' | 'sin_cuenta' | 'omitida'."""
    cuenta = _cuenta_predeterminada(db, pago.usuario_id)
    if not cuenta:
        # Le debemos plata y no tiene dónde depositarla: se lo decimos una sola
        # vez (el helper es idempotente por pago), no en cada barrido.
        _notificar_liquidacion_lista(db, pago, cuenta=None)
        return "sin_cuenta"

    estado_previo = pago.estado
    if estado_previo == "procesando":
        resuelto = _reconciliar_procesando(db, pago, cuenta)
        if resuelto is not None:
            return resuelto
        # sin referencia_pago: re-transferir bajo un claim nuevo

    if not _claim(db, pago.id, estado_previo):
        return "omitida"  # otro barrido ya la tomó
    db.refresh(pago)

    # Compensación legal de multas pendientes de este dueño (Art. 1655 Código Civil)
    total_compensado = _compensar_multas_dueno(db, pago.usuario_id, pago)
    monto_original = int(pago.monto or 0)
    monto_a_transferir = max(0, monto_original - total_compensado)

    if monto_a_transferir == 0:
        # Se compensó la totalidad de la liquidación contra multas del dueño
        pago.estado = "pagado"
        pago.procesando_desde = None
        pago.referencia_pago = f"COMPENSACION-MULTAS-{pago.id[:8]}"
        pago.liquidado_en = pago.liquidado_en or _ahora()
        db.commit()
        _notificar_pagada(db, pago, cuenta, compensado=total_compensado, neto_transferido=0)
        return "pagada"

    ref = f"LIQ-{pago.id[:8]}"
    try:
        r = bci_payouts.transferir(cuenta, monto_a_transferir, ref)
    except Exception as e:  # noqa: BLE001 — API real no implementada / caída
        logger.error("[LIQUIDACIONES] transferir() falló para %s: %s", pago.id, e)
        r = {"ok": False, "transfer_id": None, "estado": "error", "detalle": str(e)}

    if r.get("ok"):
        return _marcar_pagado(
            db, pago, cuenta, r.get("transfer_id"),
            compensado=total_compensado, neto_transferido=monto_a_transferir
        )
    return _marcar_fallido(db, pago)


def ejecutar_liquidaciones_pendientes(
    db: Session,
    usuario_id: Optional[str] = None,
) -> Dict[str, int]:
    """Barre las liquidaciones que faltan pagar.

    `usuario_id` acota el barrido a un solo dueño: los endpoints de cuenta de
    cobro (que cualquier usuario autenticado puede tocar) lo pasan siempre, así
    nadie dispara una pasada de plata de toda la plataforma. Sin él barre todo
    — eso queda reservado al loop de fondo y al endpoint de admin.
    """
    resumen = {"intentadas": 0, "pagadas": 0, "fallidas": 0, "sin_cuenta": 0}
    if not settings.BCI_PAYOUTS_HABILITADO:
        return resumen

    # Un 'procesando' fresco es una transferencia en vuelo, no un huérfano:
    # re-tomarla sería un doble depósito. Solo entra al barrido cuando ya
    # lleva demasiado tiempo ahí (o viene de antes de esta columna: NULL).
    corte_procesando = _ahora() - timedelta(minutes=_minutos_stale_procesando())
    # Una reserva "disputada" (daño reportado en la devolución) no paga su
    # liquidación hasta que soporte la resuelve: el monto puede cambiar.
    reservas_disputadas = db.query(Reserva.id).filter(Reserva.estado == "disputada")
    filtros = [
        Pago.tipo == "liquidacion_dueno",
        ~Pago.reserva_id.in_(reservas_disputadas),
        # La plata del arrendatario todavía puede volver (contracargo, reembolso por
        # disputa): no se le transfiere al dueño hasta que pase el período de retención.
        Pago.timestamp <= _corte_retencion(),
        or_(
            Pago.estado.in_(["pendiente", "fallido"]),
            and_(
                Pago.estado == "procesando",
                or_(
                    Pago.procesando_desde.is_(None),
                    Pago.procesando_desde < corte_procesando,
                ),
            ),
        ),
        Pago.monto >= settings.BCI_PAYOUT_MIN_CLP,
        Pago.intentos_liquidacion < MAX_INTENTOS_LIQUIDACION,
    ]
    if usuario_id:
        filtros.append(Pago.usuario_id == usuario_id)

    candidatos = db.query(Pago).filter(*filtros).all()
    for pago in candidatos:
        pago_id = pago.id
        try:
            resultado = _procesar_uno(db, pago)
        except Exception:  # noqa: BLE001 — un pago malo no aborta el barrido
            logger.exception("[LIQUIDACIONES] error procesando pago %s", pago_id)
            db.rollback()
            resumen["intentadas"] += 1
            resumen["fallidas"] += 1
            continue
        if resultado == "omitida":
            continue
        resumen["intentadas"] += 1
        if resultado == "pagada":
            resumen["pagadas"] += 1
        elif resultado == "fallida":
            resumen["fallidas"] += 1
        else:
            resumen["sin_cuenta"] += 1
    if resumen["intentadas"]:
        logger.info("[LIQUIDACIONES] %s", resumen)
    return resumen


def intentar_liquidar(db: Session, pago: Pago) -> None:
    """Best-effort para un pago recién creado (delivery). Nunca propaga."""
    if pago.tipo != "liquidacion_dueno" or pago.estado != "pendiente":
        return
    # El aviso "tu plata está lista" va SIEMPRE, incluso con BCI apagado (la
    # configuración de producción hoy): si no, al cerrar una devolución limpia
    # el dueño no se entera de nada.
    try:
        _notificar_liquidacion_lista(db, pago)
    except Exception as e:  # noqa: BLE001
        logger.error("[LIQUIDACIONES] aviso de liquidación lista falló para %s: %s", pago.id, e)
        db.rollback()

    if not settings.BCI_PAYOUTS_HABILITADO:
        return
    # Recién creada nunca pasó la retención; la paga el barrido de fondo cuando corresponda.
    if settings.LIQUIDACION_RETENCION_DIAS > 0:
        return
    try:
        if int(pago.monto or 0) >= settings.BCI_PAYOUT_MIN_CLP:
            _procesar_uno(db, pago)
    except Exception as e:  # noqa: BLE001
        logger.error("[LIQUIDACIONES] intentar_liquidar falló para %s: %s", pago.id, e)


def _admins(db: Session) -> List[Usuario]:
    return (
        db.query(Usuario)
        .filter(cast(Usuario.roles_activos, String).ilike('%"admin"%'))
        .all()
    )


def _ya_notificado_liquidacion_lista(db: Session, pago: Pago) -> bool:
    return (
        db.query(Notificacion.id)
        .filter(
            Notificacion.usuario_id == pago.usuario_id,
            Notificacion.entidad_tipo == "pago",
            Notificacion.entidad_id == pago.id,
            Notificacion.titulo == TITULO_LIQUIDACION_LISTA,
        )
        .first()
        is not None
    )


def _notificar_liquidacion_lista(db: Session, pago: Pago, cuenta: Optional[dict] = "auto") -> None:
    """Avisa al dueño que su ganancia quedó lista. Idempotente por pago.

    La idempotencia se resuelve mirando si ya existe una Notificacion con este
    título para este pago — así el camino de devolución y el barrido pueden
    llamarlo sin coordinarse y el dueño nunca recibe "agregá tu cuenta" cada
    10 minutos. `cuenta=None` fuerza el texto de "falta cuenta".
    """
    if _ya_notificado_liquidacion_lista(db, pago):
        return
    if cuenta == "auto":
        cuenta = _cuenta_predeterminada(db, pago.usuario_id)
    monto = f"${int(pago.monto or 0):,} CLP".replace(",", ".")
    if cuenta:
        mensaje = (
            f"Tu ganancia de {monto} quedó lista. "
            "El depósito va en camino a tu cuenta de cobro."
        )
    else:
        mensaje = (
            f"Tu ganancia de {monto} quedó lista. "
            "Agregá una cuenta de cobro en Ganancias para recibir el depósito."
        )
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo=TITULO_LIQUIDACION_LISTA, mensaje=mensaje,
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    db.commit()


def _notificar_pagada(
    db: Session,
    pago: Pago,
    cuenta: dict,
    compensado: int = 0,
    neto_transferido: Optional[int] = None,
) -> None:
    ult4 = str(cuenta.get("numero", ""))[-4:]
    neto = int(pago.monto or 0) if neto_transferido is None else neto_transferido
    if neto == 0 and compensado > 0:
        titulo = "Liquidación compensada"
        mensaje = (
            f"Tu liquidación de ${int(pago.monto or 0):,} CLP fue compensada íntegramente contra multas pendientes "
            f"por cancelación tardía o inasistencia (Art. 1655 Código Civil). No quedan saldos pendientes a transferir."
        ).replace(",", ".")
    elif compensado > 0:
        titulo = "Depósito enviado (con compensación de multas)"
        mensaje = (
            f"Depositamos ${neto:,} CLP en tu cuenta {cuenta.get('banco','')} ····{ult4}. "
            f"Se compensaron ${compensado:,} CLP por multas pendientes según Art. 1655 del Código Civil."
        ).replace(",", ".")
    else:
        titulo = "Depósito enviado"
        mensaje = f"Depositamos ${neto:,} CLP en tu cuenta {cuenta.get('banco','')} ····{ult4}.".replace(",", ".")

    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo=titulo,
        mensaje=mensaje,
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == pago.usuario_id).first()
    if usuario:
        try:
            enviar_deposito_realizado(
                email=usuario.email,
                monto=neto,
                banco=cuenta.get("banco", ""),
                numero_enmascarado=ult4,
            )
        except Exception as e:  # noqa: BLE001 — best-effort, nunca romper la liquidación
            logger.info("No se pudo encolar el correo de depósito: %s", e)


def _notificar_fallo_final(db: Session, pago: Pago) -> None:
    logger.error(
        "[LIQUIDACIONES] Fallo final de liquidación %s (dueño %s, monto %s) "
        "tras %s intentos — requiere revisión manual",
        pago.id, pago.usuario_id, pago.monto, pago.intentos_liquidacion,
    )
    crear_notificacion(
        db, usuario_id=pago.usuario_id, tipo="pago",
        titulo="No pudimos depositar tu liquidación",
        mensaje="Revisá los datos de tu cuenta de cobro en Ganancias. Nuestro equipo también fue avisado.",
        entidad_tipo="pago", entidad_id=pago.id, commit=False,
    )
    for admin in _admins(db):
        crear_notificacion(
            db, usuario_id=admin.id, tipo="pago",
            titulo="Liquidación a dueño falló definitivamente",
            mensaje=(
                f"El pago {pago.id} al dueño {pago.usuario_id} por "
                f"${int(pago.monto or 0):,} CLP falló {pago.intentos_liquidacion} veces. "
                "Requiere revisión manual."
            ).replace(",", "."),
            entidad_tipo="pago", entidad_id=pago.id, commit=False,
        )
    db.commit()
