"""
Vigilancia de la señal GPS del celular del arrendatario.

No hay dispositivo GPS instalado en el auto: mientras el arriendo está
"en_curso", el celular del arrendatario manda su posición cada pocos minutos
(`POST /reservas/{id}/telemetria`, ver `useTelemetriaArriendo` en el móvil).
Acá se vigila que esa señal no se corte:

- 30 minutos sin reportar: aviso preventivo al dueño (puede ser cobertura o
  batería — no se penaliza todavía).
- 60 minutos sin reportar: alerta crítica al dueño, aviso al arrendatario, y
  se aplica la multa `gps_sin_senal` (ver `fines_service.py`) por incumplir la
  cláusula de monitoreo del contrato.

Corre dentro del mismo bucle de `reminders_service` (no hay un segundo
`asyncio.create_task` para esto) — ver la nota ahí sobre la limitación de una
sola instancia del backend.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.entities import Auto, Pago, Reserva
from app.features.communications.notifications.service import crear_notificacion
from app.features.auth.onboarding.fines_service import FinesService

logger = logging.getLogger(__name__)

UMBRAL_ALERTA_MINUTOS = 30
UMBRAL_CRITICO_MINUTOS = 60


def _minutos_sin_senal(auto: Auto, ahora: datetime) -> Optional[int]:
    """
    Minutos desde el último reporte de posición, o `None` si el auto nunca
    reportó (nada que medir todavía — recién empezó el arriendo, por ejemplo).
    """
    posicion: Dict[str, Any] = auto.gps_ultima_posicion or {}
    ts_str = posicion.get("timestamp")
    if not ts_str:
        return None
    try:
        ts = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except Exception:
        return None
    return max(0, int((ahora - ts).total_seconds() / 60))


def _resetear_flags(db: Session, reserva: Reserva) -> None:
    """Señal recuperada: se limpian los flags para que la próxima ventana de silencio pueda re-avisar."""
    if reserva.gps_alerta_30m_enviada or reserva.gps_alerta_60m_enviada:
        reserva.gps_alerta_30m_enviada = False
        reserva.gps_alerta_60m_enviada = False
        db.commit()


def _avisar_preventivo(db: Session, reserva: Reserva, auto: Auto, minutos: int) -> None:
    crear_notificacion(
        db,
        usuario_id=auto.dueno_id,
        tipo="gps",
        titulo="Sin señal del arrendatario",
        mensaje=(
            f"El {auto.marca} {auto.modelo} ({auto.patente}) lleva {minutos} min sin reportar "
            "ubicación. Puede ser cobertura o batería del celular — todavía no hay cargo."
        ),
        entidad_tipo="reserva",
        entidad_id=reserva.id,
    )
    reserva.gps_alerta_30m_enviada = True
    db.commit()


def _aplicar_penalizacion(db: Session, reserva: Reserva) -> int:
    """Registra la multa `gps_sin_senal` con el mismo patrón que `aplicar_multa_reserva`
    (POST /reservas/{id}/aplicar-multa): se liquida contra la garantía al devolver, no se
    intenta cobrar en el momento."""
    item_multa = FinesService.validar_y_calcular_multa(
        tipo="gps_sin_senal",
        monto_clp=None,
        motivo=f"El celular no reportó ubicación por más de {UMBRAL_CRITICO_MINUTOS} minutos durante el arriendo.",
    )
    monto = item_multa["monto_clp"]

    detalles = list(reserva.multas_detalle or [])
    detalles.append(item_multa)
    reserva.multas_detalle = detalles

    reserva.cargo_falta_grave_clp = (reserva.cargo_falta_grave_clp or 0) + monto
    reserva.cargos_adicionales_clp = (reserva.cargos_adicionales_clp or 0) + monto
    reserva.monto_cobro_final = (reserva.monto_cobro_final or 0) + monto
    reserva.liquidacion_dueno_clp = (reserva.liquidacion_dueno_clp or 0) + monto

    desglose_txt = f"[{item_multa['nombre']}: ${monto:,} CLP - {item_multa['motivo']}]"
    reserva.motivo_multas = f"{reserva.motivo_multas} | {desglose_txt}" if reserva.motivo_multas else desglose_txt

    db.add(Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo="cargo_gps_sin_senal",
        monto=monto,
        estado="capturado",
        referencia_pago=f"MP-GPS-{uuid.uuid4().hex[:8].upper()}",
    ))
    return monto


def _avisar_critico(db: Session, reserva: Reserva, auto: Auto, minutos: int, monto: int) -> None:
    crear_notificacion(
        db,
        usuario_id=auto.dueno_id,
        tipo="gps",
        titulo="Alerta: 1 hora sin señal",
        mensaje=(
            f"El {auto.marca} {auto.modelo} ({auto.patente}) lleva más de 1 hora ({minutos} min) sin "
            f"reportar ubicación. Se aplicó un cargo de ${monto:,} CLP por incumplimiento del contrato."
        ),
        entidad_tipo="reserva",
        entidad_id=reserva.id,
    )
    crear_notificacion(
        db,
        usuario_id=reserva.cliente_id,
        tipo="gps",
        titulo="Cargo por pérdida de señal GPS",
        mensaje=(
            f"Tu celular no reportó ubicación por más de 1 hora durante el arriendo del "
            f"{auto.marca} {auto.modelo}. Se aplicó un cargo de ${monto:,} CLP según el contrato."
        ),
        entidad_tipo="reserva",
        entidad_id=reserva.id,
    )
    reserva.gps_alerta_30m_enviada = True
    reserva.gps_alerta_60m_enviada = True
    db.commit()


def revisar_reservas_en_curso(db: Session, ahora: Optional[datetime] = None) -> Dict[str, int]:
    """
    Recorre las reservas "en_curso" con GPS consentido y avisa/penaliza según
    cuánto lleven sin reportar señal. Devuelve conteos para logging/tests.
    """
    ahora = ahora or datetime.now(timezone.utc)
    conteos = {"alertas_30m": 0, "alertas_60m": 0}

    reservas = (
        db.query(Reserva)
        .filter(Reserva.estado == "en_curso")
        .options(joinedload(Reserva.auto))
        .all()
    )

    for reserva in reservas:
        auto = reserva.auto
        # Sin consentimiento GPS del dueño no hay nada que vigilar (ni la app
        # debería estar mandando telemetría — ver POST .../telemetria).
        if not auto or not auto.gps_consentimiento:
            continue

        minutos = _minutos_sin_senal(auto, ahora)
        if minutos is None:
            continue  # nunca reportó: sin una primera señal no hay "silencio" que medir

        if minutos < UMBRAL_ALERTA_MINUTOS:
            _resetear_flags(db, reserva)
            continue

        if minutos >= UMBRAL_CRITICO_MINUTOS:
            if reserva.gps_alerta_60m_enviada:
                continue
            monto = _aplicar_penalizacion(db, reserva)
            _avisar_critico(db, reserva, auto, minutos, monto)
            conteos["alertas_60m"] += 1
        elif not reserva.gps_alerta_30m_enviada:
            _avisar_preventivo(db, reserva, auto, minutos)
            conteos["alertas_30m"] += 1

    return conteos
