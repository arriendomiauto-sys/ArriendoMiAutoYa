import asyncio
import logging
from urllib.parse import parse_qs

import socketio
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.entities import Auto, Mensaje, Reserva, Usuario
from app.schemas.schemas import MessageOut
from app.features.auth.login.service import autenticar_token

logger = logging.getLogger(__name__)

# Servidor Socket.IO en modo ASGI con soporte CORS global
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

MAX_LARGO_TEXTO = 2000


def _es_parte_de_la_reserva(reserva: Reserva, usuario: Usuario, db: Session, auto: Auto | None = None) -> bool:
    if "admin" in (usuario.roles_activos or []):
        return True
    if reserva.cliente_id == usuario.id:
        return True
    # `auto` ya cargado por el llamador (enviar_mensaje) evita una segunda
    # consulta idéntica — este chequeo de acceso corre en el camino caliente
    # de cada mensaje enviado.
    if auto is None:
        auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    return bool(auto and auto.dueno_id == usuario.id)


def _notificar_nuevo_mensaje_en_segundo_plano(destinatario_id: str, texto_recortado: str, reserva_id: str) -> None:
    """
    Crea la notificación (campana + push) del mensaje nuevo con su PROPIA
    sesión de BD, en un hilo aparte del pool por defecto de asyncio.

    Antes esto corría de forma síncrona dentro de `enviar_mensaje`, así que
    el remitente esperaba un INSERT + commit extra (más un SELECT del token
    de push) antes de recibir el ACK que confirma "enviado" en su pantalla.
    El mensaje ya se persistió y ya se emitió a la sala — la notificación es
    de adorno para la otra parte y no debe demorar la confirmación de nadie.
    """
    from app.features.communications.notifications.service import crear_notificacion

    db = SessionLocal()
    try:
        crear_notificacion(
            db,
            usuario_id=destinatario_id,
            tipo="mensaje",
            titulo="Nuevo mensaje",
            mensaje=texto_recortado,
            entidad_tipo="reserva",
            entidad_id=reserva_id,
        )
    finally:
        db.close()


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
                "nombre": getattr(usuario, "nombre", "") or "",
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


def _cargar_acceso_reserva(db: Session, usuario_id: str, reserva_id: str):
    """Trabajo síncrono de `unir_reserva` — ver nota en `enviar_mensaje`."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    tiene_acceso = bool(usuario and reserva and _es_parte_de_la_reserva(reserva, usuario, db))
    return tiene_acceso


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
        tiene_acceso = await asyncio.to_thread(_cargar_acceso_reserva, db, usuario_id, reserva_id)
        if not tiene_acceso:
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


def _guardar_mensaje(db: Session, usuario_id: str, reserva_id: str, texto: str):
    """
    Todo el trabajo SÍNCRONO de `enviar_mensaje` (queries + commit), para
    correr en un hilo aparte vía `asyncio.to_thread` — ver nota grande más
    abajo, junto al `await` que lo dispara, sobre por qué hace falta.

    Devuelve `None` si el usuario no tiene permiso para escribir en la
    reserva (el llamador lo traduce al mismo error que antes).
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    # Se carga una sola vez: la usan tanto el chequeo de acceso como la
    # resolución del destinatario de la notificación, más abajo.
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first() if reserva else None

    if not usuario or not reserva or not _es_parte_de_la_reserva(reserva, usuario, db, auto=auto):
        return None

    mensaje = Mensaje(reserva_id=reserva_id, autor_id=usuario.id, texto=texto)
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)
    return mensaje, usuario, reserva, auto


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
        # `sio` corre en modo ASGI sobre UN solo event loop de un solo
        # worker (confirmado: el Start Command de Render no usa --workers).
        # Ese mismo loop atiende TODO — cada mensaje de chat, cada conexión
        # nueva, y el resto del tráfico HTTP de la API. `db.query`/`db.commit`
        # con la Session síncrona de SQLAlchemy son bloqueantes: sin
        # `asyncio.to_thread`, cada mensaje frenaba el proceso entero durante
        # esas 3 queries + el commit, no solo el chat. `db` es seguro de
        # pasar al hilo así porque el uso es estrictamente secuencial (este
        # `await` suspende hasta que el hilo termina, nunca hay dos hilos
        # tocándola a la vez).
        resultado = await asyncio.to_thread(_guardar_mensaje, db, usuario_id, reserva_id, texto)
        if resultado is None:
            return {"ok": False, "error": "Sin permisos para escribir en esta reserva"}
        mensaje, usuario, reserva, auto = resultado

        mensaje_dict = MessageOut.model_validate(mensaje).model_dump(mode="json")
        room_name = f"reserva_{reserva_id}"

        client_id = data.get("client_id") if isinstance(data, dict) else None
        payload_evento = {"reserva_id": reserva_id, "mensaje": mensaje_dict}
        if client_id:
            payload_evento["client_id"] = client_id

        # Emitir a todos los miembros de la sala. El remitente recibe su ACK
        # (ok + mensaje) apenas esto termina — la notificación a la otra
        # parte (campana + push) queda en segundo plano, después del return,
        # para no sumarle ni un milisegundo a la confirmación de "enviado".
        await sio.emit("nuevo_mensaje", payload_evento, room=room_name)

        destinatario_id = (
            auto.dueno_id if (auto and usuario.id == reserva.cliente_id) else reserva.cliente_id
        )
        if destinatario_id and destinatario_id != usuario.id:
            texto_recortado = (texto[:120] + "…") if len(texto) > 120 else texto
            try:
                asyncio.get_event_loop().run_in_executor(
                    None, _notificar_nuevo_mensaje_en_segundo_plano, destinatario_id, texto_recortado, reserva_id
                )
            except RuntimeError:
                # Sin loop corriendo (no debería pasar en producción, sí en
                # algún test síncrono): se crea la notificación igual, solo
                # que sin el beneficio de no bloquear.
                _notificar_nuevo_mensaje_en_segundo_plano(destinatario_id, texto_recortado, reserva_id)

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
    room_name = f"reserva_{reserva_id}"
    # Sin esto, cualquier sesión autenticada podía emitir "está escribiendo"
    # a la sala de una reserva ajena sin haberse unido nunca (unir_reserva es
    # lo único que valida pertenencia) — `sio.rooms(sid)` ya refleja esa
    # membresía sin otra consulta a la BD.
    if room_name not in sio.rooms(sid):
        return
    session = await sio.get_session(sid)
    usuario_id = session.get("usuario_id") if session else None
    await sio.emit("usuario_escribiendo", {"reserva_id": reserva_id, "usuario_id": usuario_id}, room=room_name, skip_sid=sid)


@sio.event
async def dejo_de_escribir(sid, data):
    """Avisa que el usuario dejó de escribir."""
    reserva_id = (data or {}).get("reserva_id") if isinstance(data, dict) else None
    if not reserva_id:
        return
    room_name = f"reserva_{reserva_id}"
    if room_name not in sio.rooms(sid):
        return
    session = await sio.get_session(sid)
    usuario_id = session.get("usuario_id") if session else None
    await sio.emit("usuario_dejo_de_escribir", {"reserva_id": reserva_id, "usuario_id": usuario_id}, room=room_name, skip_sid=sid)


@sio.event
async def disconnect(sid):
    logger.info("[SOCKET.IO] Cliente desconectado (sid: %s)", sid)


async def difundir_mensaje_socketio(reserva_id: str, mensaje_dict: dict, client_id: str = None):
    """
    Helper para emitir eventos Socket.IO desde controladores REST u otros servicios.
    """
    try:
        room_name = f"reserva_{reserva_id}"
        payload = {"reserva_id": reserva_id, "mensaje": mensaje_dict}
        if client_id:
            payload["client_id"] = client_id
        await sio.emit("nuevo_mensaje", payload, room=room_name)
    except Exception as e:
        logger.warning("[SOCKET.IO] No se pudo difundir mensaje externo: %s", e)
