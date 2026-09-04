from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.schemas.schemas import ConversacionResumen, MessageCreate, MessageOut
import asyncio
from app.models.entities import Usuario, Reserva, Auto, Mensaje
from app.services.auth import get_current_user
from app.services.chat_hub import difundir_en_segundo_plano
from app.services.socketio_server import difundir_mensaje_socketio
from app.core.limiter import limiter

router = APIRouter(prefix="/reservas", tags=["Mensajería (Chat por Reserva)"])


def _obtener_reserva_o_404(reserva_id: str, db: Session) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return reserva


def _requerir_parte_de_la_reserva(reserva: Reserva, current_user: Usuario, db: Session):
    if "admin" in (current_user.roles_activos or []):
        return
    if reserva.cliente_id == current_user.id:
        return
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if auto and auto.dueno_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta conversación.")


# El reloj del sistema no tiene resolución infinita: en Windows avanza de a
# ~15 ms, así que dos mensajes seguidos pueden quedar con el MISMO timestamp.
# Ordenando solo por fecha, el motor los devuelve en el orden que se le antoje
# y la lista de conversaciones podía mostrar como "último" un mensaje distinto
# del que se ve abajo de todo en el chat.
#
# El id como desempate no da el orden real de escritura (es un uuid), pero sí
# da un orden TOTAL y estable: las dos consultas coinciden siempre y la vista
# previa nunca contradice a la conversación.
ORDEN_CRONOLOGICO = (Mensaje.timestamp.asc(), Mensaje.id.asc())
ORDEN_INVERSO = (Mensaje.timestamp.desc(), Mensaje.id.desc())


def _contraparte(reserva: Reserva, usuario: Usuario, db: Session):
    """El otro extremo de la conversación: dueño si escribe el cliente, y al revés."""
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if usuario.id == reserva.cliente_id:
        return auto.dueno_id if auto else None
    return reserva.cliente_id


@router.get(
    "/{reserva_id}/mensajes",
    response_model=List[MessageOut],
    summary="Listar los mensajes de coordinación de una reserva",
)
def listar_mensajes(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_parte_de_la_reserva(reserva, current_user, db)

    mensajes = (
        db.query(Mensaje)
        .filter(Mensaje.reserva_id == reserva_id)
        .order_by(*ORDEN_CRONOLOGICO)
        .all()
    )

    # Abrir la conversación es haberla leído: se marcan los del otro extremo.
    # Así el punto rojo de la pestaña se apaga solo, sin pedirle al usuario un
    # gesto extra que nadie hace.
    pendientes = [m for m in mensajes if m.autor_id != current_user.id and not m.leido]
    if pendientes:
        for m in pendientes:
            m.leido = True
        db.commit()
        for m in pendientes:
            db.refresh(m)

    return mensajes


@router.post(
    "/{reserva_id}/mensajes",
    response_model=MessageOut,
    summary="Enviar un mensaje de coordinación en una reserva",
)
@limiter.limit("60/minute")
def enviar_mensaje(
    request: Request,
    reserva_id: str,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = _obtener_reserva_o_404(reserva_id, db)
    _requerir_parte_de_la_reserva(reserva, current_user, db)

    mensaje = Mensaje(reserva_id=reserva_id, autor_id=current_user.id, texto=payload.texto)
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)

    # El mismo mensaje sale por Socket.IO y WebSocket para quien tenga la
    # conversación abierta. Se difunde también desde acá — y no solo desde el
    # socket — para que da igual por dónde se envió: quien está mirando lo ve al toque.
    mensaje_dict = MessageOut.model_validate(mensaje).model_dump(mode="json")
    difundir_en_segundo_plano(
        reserva_id,
        {"tipo": "mensaje", "mensaje": mensaje_dict},
    )
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(difundir_mensaje_socketio(reserva_id, mensaje_dict))
    except Exception:
        pass

    # Avisar a la otra parte de la reserva (dueño <-> cliente).
    destinatario_id = _contraparte(reserva, current_user, db)
    if destinatario_id and destinatario_id != current_user.id:
        from app.services.notificaciones import crear_notificacion
        crear_notificacion(
            db,
            usuario_id=destinatario_id,
            tipo="mensaje",
            titulo="Nuevo mensaje",
            mensaje=(payload.texto[:120] + "…") if len(payload.texto) > 120 else payload.texto,
            entidad_tipo="reserva",
            entidad_id=reserva_id,
        )
    return mensaje


@router.get(
    "/mensajes/resumen",
    response_model=List[ConversacionResumen],
    summary="Resumen de las conversaciones del usuario, con no leídos",
)
def resumen_conversaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Una fila por reserva con mensajes: el último texto y cuántos quedan sin
    leer. Es lo que necesita la lista de Mensajes y el globo de la pestaña,
    que hasta ahora abría la conversación entera solo para saber si había algo
    nuevo.
    """
    # Reservas donde el usuario es cliente o dueño del auto.
    ids_como_dueno = [
        r.id
        for r in db.query(Reserva.id)
        .join(Auto, Auto.id == Reserva.auto_id)
        .filter(Auto.dueno_id == current_user.id)
        .all()
    ]
    ids_como_cliente = [
        r.id for r in db.query(Reserva.id).filter(Reserva.cliente_id == current_user.id).all()
    ]
    ids = set(ids_como_dueno) | set(ids_como_cliente)
    if not ids:
        return []

    no_leidos_por_reserva = dict(
        db.query(Mensaje.reserva_id, func.count(Mensaje.id))
        .filter(
            Mensaje.reserva_id.in_(ids),
            Mensaje.autor_id != current_user.id,
            Mensaje.leido.is_(False),
        )
        .group_by(Mensaje.reserva_id)
        .all()
    )

    resumen = []
    for reserva_id in ids:
        ultimo = (
            db.query(Mensaje)
            .filter(Mensaje.reserva_id == reserva_id)
            .order_by(*ORDEN_INVERSO)
            .first()
        )
        if not ultimo:
            continue
        resumen.append(
            ConversacionResumen(
                reserva_id=reserva_id,
                ultimo_mensaje=ultimo.texto,
                ultimo_timestamp=ultimo.timestamp,
                ultimo_autor_id=ultimo.autor_id,
                no_leidos=no_leidos_por_reserva.get(reserva_id, 0),
            )
        )

    resumen.sort(key=lambda c: (c.ultimo_timestamp, c.reserva_id), reverse=True)
    return resumen
