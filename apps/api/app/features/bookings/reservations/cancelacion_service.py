"""
Cancelación de reservas y qué pasa con la plata.

Política (PENDIENTE DE CONFIRMAR CON EL CLIENTE — cambiar solo las constantes
y `_corresponde_reembolso_total`):
  · La garantía (hold) SIEMPRE se libera al cancelar.
  · Cancela el dueño, o rechaza una solicitud: reembolso total del arriendo.
  · Cancela el arrendatario con >= HORAS_REEMBOLSO_TOTAL de anticipación:
    reembolso total.
  · Cancela el arrendatario con menos anticipación: el arriendo NO se
    reembolsa solo; soporte lo coordina (es lo que ya le dice la app).

Si la pasarela falla, la reserva se cancela igual (es lo que el usuario pidió)
pero el `Pago` conserva su estado para que el dinero pendiente no se pierda de
vista; `liberar_garantias_colgadas` reintenta la liberación de las garantías.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.features.bookings.reservations import avisos
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Pago, Reserva, Usuario
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

# Antelación mínima (horas antes del retiro) para que el arrendatario recupere
# el arriendo completo al cancelar.
HORAS_REEMBOLSO_TOTAL = 24


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    """
    UTC sin zona. Postgres entrega las fechas de la reserva con zona y `_ahora()` no la lleva: sin esto,
    restarlas revienta con "can't compare offset-naive and offset-aware datetimes" (ya pasó en producción
    con los recordatorios).
    """
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _en_pasarela(pago: Pago) -> bool:
    """`True` si el pago existe de verdad en Mercado Pago (no simulado ni sin id)."""
    ref = pago.referencia_pago
    return bool(ref) and not pagos_simulados.es_pago_simulado(ref)


def _liberar(pago: Pago) -> bool:
    """Suelta un hold (o cancela un cobro que nunca se acreditó). `True` si quedó hecho."""
    if _en_pasarela(pago):
        res = MercadoPagoService.liberar_hold(pago.referencia_pago)
        if not res.get("success"):
            logger.error("[CANCELACION] No se pudo liberar el pago %s (%s): %s",
                         pago.id, pago.referencia_pago, res.get("error"))
            return False
    pago.estado = "liberado"
    return True


def _reembolsar(db: Session, pago: Pago) -> bool:
    """
    Devuelve un cobro ya capturado. `True` si quedó hecho; si la pasarela falla
    queda anotado un `reembolso_total` pendiente que el barrido reintenta.
    """
    from app.features.payments import estado_pagos

    return estado_pagos.reembolsar_total(db, pago)


def _corresponde_reembolso_total(reserva: Reserva, cancela_arrendatario: bool, ahora: datetime) -> bool:
    if not cancela_arrendatario:
        return True
    # Una solicitud que el dueño todavía no aceptó no compromete al arrendatario: se le devuelve todo, aunque
    # falte poco para el retiro (el plazo mínimo solo rige para reservas ya confirmadas).
    if reserva.estado == "pendiente":
        return True
    horas = (_naive(reserva.fecha_inicio) - ahora).total_seconds() / 3600
    return horas >= HORAS_REEMBOLSO_TOTAL


def _devolver_dinero(db: Session, reserva: Reserva, reembolso_total: bool) -> dict:
    """
    Suelta la garantía y, si corresponde, devuelve el arriendo. Devuelve
    `{"garantia": int, "reembolsado": int, "pendiente": bool}`; `pendiente`
    indica que la pasarela falló en algo.
    """
    resultado = {"garantia": 0, "reembolsado": 0, "pendiente": False}
    pagos = db.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    for pago in pagos:
        if pago.tipo == "hold_reserva" and pago.estado == "retenido":
            if _liberar(pago):
                resultado["garantia"] += pago.monto
            else:
                resultado["pendiente"] = True
        elif pago.tipo == "hold_reserva" and pago.estado == "capturado_disputa":
            # Garantía capturada al abrir una disputa: soltarla es devolverla.
            if _reembolsar(db, pago):
                resultado["garantia"] += pago.monto
            else:
                resultado["pendiente"] = True
        elif pago.tipo == "cobro_arriendo" and pago.estado == "pendiente":
            # Cobro que el banco nunca acreditó: se cancela, no se "reembolsa".
            if not _liberar(pago):
                resultado["pendiente"] = True
        elif pago.tipo == "cobro_arriendo" and pago.estado == "capturado" and reembolso_total:
            if _reembolsar(db, pago):
                resultado["reembolsado"] += pago.monto
            else:
                resultado["pendiente"] = True
    return resultado


def _clp(monto: int) -> str:
    return f"${monto:,}".replace(",", ".")


def _notificar(
    db: Session, reserva: Reserva, cancela_arrendatario: bool, reembolso_total: bool, r: dict, multa_dueno: int = 0,
) -> None:
    auto = reserva.auto
    nombre_auto = f"{auto.marca} {auto.modelo}" if auto else "el vehículo"

    partes = []
    if r["garantia"]:
        partes.append(f"Liberamos tu garantía de {_clp(r['garantia'])}.")
    if r["reembolsado"]:
        partes.append(f"Te devolvimos {_clp(r['reembolsado'])} del arriendo.")
    elif cancela_arrendatario and not reembolso_total and not r["pendiente"]:
        partes.append(
            f"Como cancelaste con menos de {HORAS_REEMBOLSO_TOTAL} horas de anticipación, "
            "soporte se comunicará contigo por el cobro del arriendo."
        )
    if r["pendiente"]:
        partes.append("La devolución quedó en proceso; si no la ves en unos días, escríbenos a soporte.")

    if cancela_arrendatario:
        titulo_cliente = "Reserva cancelada"
        cuerpo_cliente = f"Cancelaste tu reserva del {nombre_auto}. " + " ".join(partes)
        cuerpo_dueno = f"El arrendatario canceló la reserva del {nombre_auto}. El vehículo queda libre en esas fechas."
    else:
        titulo_cliente = "Tu reserva fue cancelada"
        cuerpo_cliente = f"El dueño canceló tu reserva del {nombre_auto}. " + " ".join(partes)
        cuerpo_dueno = f"Cancelaste la reserva del {nombre_auto}. El vehículo queda libre en esas fechas."
        if multa_dueno:
            cuerpo_cliente += " Como la canceló con poca anticipación, se le aplicó una multa."
            cuerpo_dueno += (
                f" Como la reserva estaba confirmada y cancelaste con menos de {HORAS_REEMBOLSO_TOTAL} horas de "
                f"anticipación, se te aplicó una multa de {_clp(multa_dueno)}."
            )

    # Correo solo a quien NO canceló: quien canceló ya sabe qué hizo; el otro puede no tener la app abierta.
    avisos.avisar(db, reserva, reserva.cliente_id, titulo_cliente, cuerpo_cliente.strip(), correo=not cancela_arrendatario)
    if auto:
        avisos.avisar(db, reserva, auto.dueno_id, "Reserva cancelada", cuerpo_dueno, correo=cancela_arrendatario)


def cancelar_reserva(db: Session, reserva: Reserva, actor: Usuario) -> Reserva:
    """
    Cancela la reserva, libera la garantía, devuelve el arriendo según la
    política y avisa a las dos partes. La validación de estado y permisos la
    hace el endpoint; acá solo se ejecuta.

    Si el dueño cancela una reserva ya CONFIRMADA con menos de HORAS_REEMBOLSO_TOTAL horas de anticipación
    (o ya pasada la hora de inicio), se le aplica la misma multa que al arrendatario ausente: el arrendatario
    lo esperaba y el dueño lo dejó plantado. Rechazar una solicitud (estado `pendiente`) nunca multa.
    """
    ahora = _ahora()
    cancela_arrendatario = actor.id == reserva.cliente_id
    estado_previo = reserva.estado
    reembolso_total = _corresponde_reembolso_total(reserva, cancela_arrendatario, ahora)

    resultado = _devolver_dinero(db, reserva, reembolso_total)
    multa_dueno = 0
    cancela_el_dueno = bool(reserva.auto) and reserva.auto.dueno_id == actor.id
    if (
        estado_previo == "confirmada"
        and cancela_el_dueno
        and (_naive(reserva.fecha_inicio) - ahora).total_seconds() / 3600 < HORAS_REEMBOLSO_TOTAL
    ):
        # Import local: confirmacion_service usa las utilidades de este módulo.
        from app.features.bookings.reservations import confirmacion_service

        multa_dueno = confirmacion_service.multar_al_dueno_por_cancelar(db, reserva, ahora)
    reserva.estado = "cancelada"
    _notificar(db, reserva, cancela_arrendatario, reembolso_total, resultado, multa_dueno)
    db.commit()
    db.refresh(reserva)
    return reserva


def expirar_reservas_vencidas(db: Session, ahora: Optional[datetime] = None) -> int:
    """
    Pasa a "cancelada" las reservas `pendiente_pago` cuyo TTL venció, soltando
    la garantía que hubiera quedado tomada (cobro en revisión del banco).
    Devuelve cuántas canceló.
    """
    ahora = ahora or _ahora()
    vencidas = (
        db.query(Reserva)
        .filter(
            Reserva.estado == "pendiente_pago",
            Reserva.expira_en.isnot(None),
            Reserva.expira_en < ahora,
        )
        .all()
    )
    for reserva in vencidas:
        _devolver_dinero(db, reserva, reembolso_total=True)
        reserva.estado = "cancelada"
    if vencidas:
        db.commit()
    return len(vencidas)


def liberar_garantias_colgadas(db: Session) -> int:
    """
    Suelta las garantías que siguen retenidas en reservas ya canceladas: las
    que dejó el flujo anterior (cancelar solo cambiaba el estado) y las que
    fallaron en la pasarela al cancelar. Devuelve cuántas liberó.
    """
    colgadas = (
        db.query(Pago)
        .join(Reserva, Reserva.id == Pago.reserva_id)
        .filter(Reserva.estado == "cancelada", Pago.tipo == "hold_reserva", Pago.estado == "retenido")
        .all()
    )
    liberadas = sum(1 for pago in colgadas if _liberar(pago))
    if colgadas:
        db.commit()
    return liberadas


def barrido_reservas(db: Session) -> dict:
    """Una pasada del bucle de fondo: expira lo vencido, cancela lo que el dueño no confirmó y suelta garantías colgadas."""
    # Import local: confirmacion_service usa las utilidades de este módulo.
    from app.features.bookings.reservations import confirmacion_service
    from app.features.payments import cargos_service, estado_pagos, garantia_renovacion

    return {
        "expiradas": expirar_reservas_vencidas(db),
        "confirmaciones_vencidas": confirmacion_service.expirar_confirmaciones_vencidas(db),
        # Los avisos van antes de decidir: quien no demostró su llegada se entera antes de que se le multe.
        "recordatorios": confirmacion_service.enviar_recordatorios_de_politica(db),
        "no_presentaciones": confirmacion_service.resolver_no_presentaciones(db),
        "garantias_liberadas": liberar_garantias_colgadas(db),
        "garantias_renovadas": garantia_renovacion.renovar_garantias_por_vencer(db),
        "reembolsos": estado_pagos.reintentar_reembolsos_pendientes(db),
        "garantias_por_saldar": cargos_service.reintentar_garantias(db),
        "conciliacion": estado_pagos.conciliar(db),
    }
