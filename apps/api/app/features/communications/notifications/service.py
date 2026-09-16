"""
Notificaciones. Se guardan siempre en la tabla `notificaciones` (el cliente
las lee con GET /notificaciones) y, si el usuario tiene un `expo_push_token`
registrado, se manda además un push vía Expo (best-effort, sin bloquear).

`crear_notificacion` es fire-and-forget: nunca debe romper el flujo que la
dispara (crear una reserva, enviar un mensaje, etc.), así que traga sus
propias excepciones y las deja en el log.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

import httpx
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.entities import Notificacion, Usuario

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# El POST a Expo tardaba hasta 6s DENTRO del request que disparó la
# notificación (enviar un mensaje, aceptar una reserva...). Ahora se despacha
# a este pool y el endpoint responde sin esperarlo. Pocos workers: el push es
# best-effort, no vale la pena reservar recursos para que sea rápido.
_push_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="expo-push")

# Razones de error de Expo que significan "este token ya no sirve, nunca más
# va a entregar nada" (desinstaló la app, token rotado, etc.) — a diferencia
# de errores transitorios (MessageRateExceeded, credenciales, tamaño del
# mensaje) que no dicen nada sobre si el token sigue vivo.
_RAZONES_TOKEN_MUERTO = {"DeviceNotRegistered"}


def _olvidar_token_muerto(token: str) -> None:
    """Corre en el mismo thread del pool de push: abre su propia sesión de
    BD (la del request que disparó la notificación ya se cerró hace rato)."""
    db = SessionLocal()
    try:
        db.query(Usuario).filter(Usuario.expo_push_token == token).update(
            {Usuario.expo_push_token: None}
        )
        db.commit()
    except Exception as e:  # noqa: BLE001 — best-effort, no hay nadie a quien avisar
        logger.warning("No se pudo limpiar el token push muerto: %s", e)
        db.rollback()
    finally:
        db.close()


def _post_push(token: str, titulo: str, mensaje: str, data: dict | None = None) -> None:
    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(
                EXPO_PUSH_URL,
                json={
                    "to": token,
                    "title": titulo,
                    "body": mensaje,
                    "sound": "default",
                    "data": data or {},
                },
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
        # Expo responde 200 aunque el push individual haya fallado — el
        # veredicto real está en data[].status/details.error, no en el
        # status code HTTP. Antes esto se descartaba entero: un token muerto
        # quedaba reintentándose para siempre en cada notificación futura.
        ticket = (resp.json().get("data") or [{}])[0]
        if ticket.get("status") == "error":
            razon = (ticket.get("details") or {}).get("error")
            logger.info("Push a Expo rechazado (%s): %s", razon, ticket.get("message"))
            if razon in _RAZONES_TOKEN_MUERTO:
                _olvidar_token_muerto(token)
    except Exception as e:  # noqa: BLE001
        logger.info("Push a Expo falló (no bloquea): %s", e)


def _enviar_push(token: str, titulo: str, mensaje: str, data: dict | None = None) -> None:
    """Encola el envío del push sin bloquear al llamador."""
    if not token or not token.startswith("ExponentPushToken"):
        return
    try:
        _push_executor.submit(_post_push, token, titulo, mensaje, data)
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el push: %s", e)


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

        # Push best-effort (solo si el usuario tiene token de dispositivo).
        try:
            token = db.query(Usuario.expo_push_token).filter(Usuario.id == usuario_id).scalar()
        except Exception as e:  # noqa: BLE001 — push es best-effort
            logger.warning("No se pudo leer expo_push_token del usuario %s: %s", usuario_id, e)
            token = None
        if token:
            _enviar_push(token, titulo, mensaje, {"tipo": tipo, "entidad_id": entidad_id})
        return n
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.warning("No se pudo crear la notificación (%s): %s", tipo, e)
        # Solo se limpia la sesión si esta llamada era dueña de su transacción;
        # si va dentro de otra (commit=False), el rollback lo maneja el caller.
        if commit:
            try:
                db.rollback()
            except Exception as e:  # noqa: BLE001 — no queda más: la sesión la descarta el caller
                logger.warning(
                    "Rollback falló tras error creando notificación (usuario %s, tipo %s): %s",
                    usuario_id, tipo, e,
                )
        return None
