"""
Chat en vivo de una reserva, sobre WebSocket.

El REST de `mensajes.py` sigue siendo la fuente de verdad: acá se guarda con el
mismo modelo y se difunde a quien tenga la conversación abierta. El WebSocket
es un acelerador, no un canal paralelo — si se cae, la app vuelve a REST y no
se pierde ni un mensaje.

Autenticación: el token va por query string (`?token=`). Ni el navegador ni
React Native permiten mandar cabeceras propias al abrir un WebSocket, así que
no hay alternativa. Se valida contra Supabase igual que cualquier request.
"""
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Auto, Mensaje, Reserva, Usuario
from app.schemas.schemas import MessageOut
from app.services.auth import autenticar_token
from app.services.chat_hub import hub

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Mensajería (Chat por Reserva)"])

# Mismo tope que `MessageCreate.texto`: el WebSocket no puede ser la puerta
# ancha por la que entra lo que el REST rechaza.
MAX_LARGO_TEXTO = 2000


async def autenticar_websocket(token: str, db: Session) -> Usuario:
    """Devuelve el usuario del token, o `None` si no es válido."""
    try:
        return await autenticar_token(token, db)
    except Exception:
        return None


def _es_parte_de_la_reserva(reserva: Reserva, usuario: Usuario, db: Session) -> bool:
    if "admin" in (usuario.roles_activos or []):
        return True
    if reserva.cliente_id == usuario.id:
        return True
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    return bool(auto and auto.dueno_id == usuario.id)


@router.websocket("/ws/reservas/{reserva_id}/mensajes")
async def chat_en_vivo(
    websocket: WebSocket,
    reserva_id: str,
    token: str = "",
    db: Session = Depends(get_db),
):
    usuario = await autenticar_websocket(token, db)
    if not usuario:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="No autenticado")
        return

    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva or not _es_parte_de_la_reserva(reserva, usuario, db):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Sin acceso a esta conversación")
        return

    await websocket.accept()
    await hub.conectar(reserva_id, websocket)
    # Confirmar la conexión le permite a la app apagar el polling recién
    # cuando el canal está realmente arriba, y no antes.
    await websocket.send_json({"tipo": "conectado", "reserva_id": reserva_id})

    try:
        while True:
            datos = await websocket.receive_json()

            if datos.get("tipo") == "ping":
                await websocket.send_json({"tipo": "pong"})
                continue

            texto = (datos.get("texto") or "").strip()
            if not texto:
                continue
            if len(texto) > MAX_LARGO_TEXTO:
                await websocket.send_json(
                    {"tipo": "error", "detalle": "El mensaje es demasiado largo."}
                )
                continue

            mensaje = Mensaje(reserva_id=reserva_id, autor_id=usuario.id, texto=texto)
            db.add(mensaje)
            db.commit()
            db.refresh(mensaje)

            await hub.difundir(
                reserva_id,
                {
                    "tipo": "mensaje",
                    "mensaje": MessageOut.model_validate(mensaje).model_dump(mode="json"),
                },
            )

            # La notificación push/campana solo si el otro no está mirando la
            # conversación: si está conectado ya vio el mensaje aparecer, y
            # avisarle de algo que tiene en pantalla es ruido.
            if hub.conectados(reserva_id) < 2:
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
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.warning("[WS-CHAT] Conexión terminada con error en la reserva %s", reserva_id, exc_info=True)
    finally:
        await hub.desconectar(reserva_id, websocket)
