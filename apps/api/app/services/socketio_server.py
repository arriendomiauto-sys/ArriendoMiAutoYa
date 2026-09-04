import logging
from urllib.parse import parse_qs

import socketio
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.entities import Auto, Mensaje, Reserva, Usuario
from app.schemas.schemas import MessageOut
from app.services.auth import autenticar_token

logger = logging.getLogger(__name__)

# Servidor Socket.IO en modo ASGI con soporte CORS global
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

MAX_LARGO_TEXTO = 2000


def _es_parte_de_la_reserva(reserva: Reserva, usuario: Usuario, db: Session) -> bool:
    if "admin" in (usuario.roles_activos or []):
        return True
    if reserva.cliente_id == usuario.id:
        return True
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    return bool(auto and auto.dueno_id == usuario.id)


def _obtener_token(environ: dict, auth: dict = None) -> str:
    if isinstance(auth, dict) and auth.get("token"):
        return auth["token"]
    query_string = environ.get("QUERY_STRING", "")
    params = parse_qs(query_string)
    if "token" in params and params["token"]:
        return params["token"][0]
    return ""


@sio.event
async def connect(sid, environ, auth=None):
    token = _obtener_token(environ, auth)
    if not token:
        logger.warning("[SOCKET.IO] Intento de conexión sin token (sid: %s)", sid)
        return False

    db: Session = SessionLocal()
    try:
        usuario = await autenticar_token(token, db)
        if not usuario:
            logger.warning("[SOCKET.IO] Token inválido en conexión (sid: %s)", sid)
            return False

        await sio.save_session(
            sid,
            {
                "usuario_id": usuario.id,
                "nombre": usuario.nombre_completo,
                "roles": usuario.roles_activos or [],
            },
        )
        logger.info("[SOCKET.IO] Conectado usuario %s (sid: %s)", usuario.id, sid)
        return True
    except Exception as e:
        logger.error("[SOCKET.IO] Error durante connect: %s", e)
        return False
    finally:
        db.close()


@sio.event
async def unir_reserva(sid, data):
    """
    Une al cliente a la sala de la reserva: `reserva_{reserva_id}`.
    Valida pertenencia antes de permitir escuchar la conversación.
    """
    reserva_id = (data or {}).get("reserva_id") if isinstance(data, dict) else str(data)
    if not reserva_id:
        return {"ok": False, "error": "Falta reserva_id"}

    session = await sio.get_session(sid)
    if not session or not session.get("usuario_id"):
        return {"ok": False, "error": "No autenticado"}

    usuario_id = session["usuario_id"]
    db: Session = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()

        if not usuario or not reserva or not _es_parte_de_la_reserva(reserva, usuario, db):
            return {"ok": False, "error": "Sin acceso a esta reserva"}

        room_name = f"reserva_{reserva_id}"
        await sio.enter_room(sid, room_name)
        logger.info("[SOCKET.IO] %s unido a room %s", usuario_id, room_name)

        await sio.emit("reserva_unida", {"reserva_id": reserva_id}, to=sid)
        return {"ok": True, "reserva_id": reserva_id}
    except Exception as e:
        logger.error("[SOCKET.IO] Error al unir_reserva: %s", e)
        return {"ok": False, "error": str(e)}
    finally:
        db.close()


@sio.event
async def enviar_mensaje(sid, data):
    """
    Recibe un mensaje, lo persiste en la base de datos y lo emite a la sala.
    """
    if not isinstance(data, dict):
        return {"ok": False, "error": "Payload inválido"}

    reserva_id = data.get("reserva_id")
    texto = (data.get("texto") or "").strip()

    if not reserva_id or not texto:
        return {"ok": False, "error": "reserva_id y texto son obligatorios"}

    if len(texto) > MAX_LARGO_TEXTO:
        return {"ok": False, "error": "El mensaje excede el largo máximo"}

    session = await sio.get_session(sid)
    if not session or not session.get("usuario_id"):
        return {"ok": False, "error": "No autenticado"}

    usuario_id = session["usuario_id"]
    db: Session = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()

        if not usuario or not reserva or not _es_parte_de_la_reserva(reserva, usuario, db):
            return {"ok": False, "error": "Sin permisos para escribir en esta reserva"}

        mensaje = Mensaje(reserva_id=reserva_id, autor_id=usuario.id, texto=texto)
        db.add(mensaje)
        db.commit()
        db.refresh(mensaje)

        mensaje_dict = MessageOut.model_validate(mensaje).model_dump(mode="json")
        room_name = f"reserva_{reserva_id}"

        # Emitir a todos los miembros de la sala
        await sio.emit("nuevo_mensaje", {"reserva_id": reserva_id, "mensaje": mensaje_dict}, room=room_name)

        # Notificación push/campana al destinatario si corresponde
        auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
        destinatario_id = (
            auto.dueno_id if (auto and usuario.id == reserva.cliente_id) else reserva.cliente_id
        )
        if destinatario_id and destinatario_id != usuario.id:
            from app.services.notificaciones import crear_notificacion

            crear_notificacion(
                db,
                usuario_id=destinatario_id,
                tipo="mensaje",
                titulo="Nuevo mensaje",
                mensaje=(texto[:120] + "…") if len(texto) > 120 else texto,
                entidad_tipo="reserva",
                entidad_id=reserva_id,
            )

        return {"ok": True, "mensaje": mensaje_dict}
    except Exception as e:
        db.rollback()
        logger.error("[SOCKET.IO] Error guardando mensaje: %s", e)
        return {"ok": False, "error": str(e)}
    finally:
        db.close()


@sio.event
async def escribiendo(sid, data):
    """Avisa a los demás miembros de la sala que el usuario está escribiendo."""
    reserva_id = (data or {}).get("reserva_id") if isinstance(data, dict) else None
    if not reserva_id:
        return
    session = await sio.get_session(sid)
    usuario_id = session.get("usuario_id") if session else None
    room_name = f"reserva_{reserva_id}"
    await sio.emit("usuario_escribiendo", {"reserva_id": reserva_id, "usuario_id": usuario_id}, room=room_name, skip_sid=sid)


@sio.event
async def dejo_de_escribir(sid, data):
    """Avisa que el usuario dejó de escribir."""
    reserva_id = (data or {}).get("reserva_id") if isinstance(data, dict) else None
    if not reserva_id:
        return
    session = await sio.get_session(sid)
    usuario_id = session.get("usuario_id") if session else None
    room_name = f"reserva_{reserva_id}"
    await sio.emit("usuario_dejo_de_escribir", {"reserva_id": reserva_id, "usuario_id": usuario_id}, room=room_name, skip_sid=sid)


@sio.event
async def disconnect(sid):
    logger.info("[SOCKET.IO] Cliente desconectado (sid: %s)", sid)


async def difundir_mensaje_socketio(reserva_id: str, mensaje_dict: dict):
    """
    Helper para emitir eventos Socket.IO desde controladores REST u otros servicios.
    """
    try:
        room_name = f"reserva_{reserva_id}"
        await sio.emit("nuevo_mensaje", {"reserva_id": reserva_id, "mensaje": mensaje_dict}, room=room_name)
    except Exception as e:
        logger.warning("[SOCKET.IO] No se pudo difundir mensaje externo: %s", e)
