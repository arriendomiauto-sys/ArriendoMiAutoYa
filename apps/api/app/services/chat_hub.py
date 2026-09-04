"""
Reparto en vivo de los mensajes de una reserva.

Antes el chat funcionaba por polling cada 4 segundos: el teléfono preguntaba
"¿hay algo nuevo?" 15 veces por minuto aunque nadie escribiera, y un mensaje
podía tardar hasta 4 segundos en aparecer. Para coordinar una entrega ("estoy
llegando", "¿en qué esquina?") esa demora se nota.

El hub mantiene las conexiones abiertas agrupadas por reserva. No guarda nada:
la fuente de verdad sigue siendo la tabla `mensajes`. Si el WebSocket se cae,
el cliente vuelve a pedir el historial por REST y no pierde ningún mensaje.

Vive en memoria del proceso, así que con más de una instancia del backend cada
una reparte solo a sus propios conectados. Es aceptable hoy (una instancia) y
el día que haya varias, el reemplazo es publicar a Redis desde `difundir()`
sin tocar a quien lo llama.
"""
import asyncio
import logging
from typing import Any, Dict, Set

logger = logging.getLogger(__name__)


class ChatHub:
    def __init__(self) -> None:
        # reserva_id -> conexiones abiertas de esa conversación
        self._salas: Dict[str, Set[Any]] = {}
        self._lock = asyncio.Lock()

    async def conectar(self, reserva_id: str, websocket) -> None:
        async with self._lock:
            self._salas.setdefault(reserva_id, set()).add(websocket)

    async def desconectar(self, reserva_id: str, websocket) -> None:
        async with self._lock:
            sala = self._salas.get(reserva_id)
            if not sala:
                return
            sala.discard(websocket)
            if not sala:
                self._salas.pop(reserva_id, None)

    def conectados(self, reserva_id: str) -> int:
        return len(self._salas.get(reserva_id, ()))

    async def difundir(self, reserva_id: str, evento: Dict[str, Any]) -> None:
        """
        Manda un evento a todos los conectados a esa reserva.

        Una conexión muerta no puede frenar al resto: se envía una por una y
        las que fallan se descartan. Sin esto, un teléfono que perdió señal
        dejaba colgado el envío del otro extremo.
        """
        async with self._lock:
            destinos = list(self._salas.get(reserva_id, ()))

        caidas = []
        for ws in destinos:
            try:
                await ws.send_json(evento)
            except Exception:
                caidas.append(ws)

        for ws in caidas:
            await self.desconectar(reserva_id, ws)


hub = ChatHub()


def difundir_en_segundo_plano(reserva_id: str, evento: Dict[str, Any]) -> None:
    """
    Difunde desde código síncrono (los endpoints REST lo son).

    Si no hay loop corriendo — por ejemplo en un test síncrono — no hay nadie
    conectado a quien avisar y no vale la pena levantar uno: se ignora. El
    mensaje ya quedó guardado, que es lo que importa.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(hub.difundir(reserva_id, evento))
