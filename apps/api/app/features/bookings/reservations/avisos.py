"""
Avisos de una reserva: notificación (que además sale como push si el usuario tiene token) y, solo en
los momentos críticos, correo.

El correo se despacha DESPUÉS de que la transacción se confirma (ver `enviar_aviso_tras_commit`): si el
cambio de estado se revierte, no sale un correo que lo anuncie. Sin `RESEND_API_KEY` no se manda ninguno.
"""
from sqlalchemy.orm import Session

from app.features.communications.email import service as email_service
from app.features.communications.notifications.service import crear_notificacion
from app.models.entities import Reserva, Usuario


def avisar(
    db: Session, reserva: Reserva, usuario_id, titulo: str, mensaje: str, correo: bool = False, tipo: str = "reserva",
) -> None:
    """Crea la notificación (sin commit: lo hace quien llama) y, si `correo`, encola el correo tras el commit."""
    if not usuario_id:
        return
    crear_notificacion(
        db, usuario_id=usuario_id, tipo=tipo, titulo=titulo, mensaje=mensaje,
        entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
    )
    if correo:
        destino = db.query(Usuario.email).filter(Usuario.id == usuario_id).scalar()
        email_service.enviar_aviso_tras_commit(db, email=destino, asunto=titulo, titulo=titulo, mensaje=mensaje)
