"""
Notificaciones in-app. No hay push ni email todavía: se guardan en la tabla
`notificaciones` y el cliente las lee con GET /notificaciones (polling / al
abrir la pantalla).

`crear_notificacion` es fire-and-forget: nunca debe romper el flujo que la
dispara (crear una reserva, enviar un mensaje, etc.), así que traga sus
propias excepciones y las deja en el log.
"""
import logging

from sqlalchemy.orm import Session

from app.models.entities import Notificacion

logger = logging.getLogger(__name__)


def crear_notificacion(
    db: Session,
    *,
    usuario_id: str,
    tipo: str,
    titulo: str,
    mensaje: str,
    entidad_tipo: str | None = None,
    entidad_id: str | None = None,
    commit: bool = True,
) -> Notificacion | None:
    if not usuario_id:
        return None
    try:
        n = Notificacion(
            usuario_id=usuario_id,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
        )
        db.add(n)
        if commit:
            db.commit()
            db.refresh(n)
        return n
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.warning("No se pudo crear la notificación (%s): %s", tipo, e)
        # Solo se limpia la sesión si esta llamada era dueña de su transacción;
        # si va dentro de otra (commit=False), el rollback lo maneja el caller.
        if commit:
            try:
                db.rollback()
            except Exception:
                pass
        return None
