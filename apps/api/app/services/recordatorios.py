"""
Recordatorios push de entrega y devolución.

Sin esto, un arrendatario que arma su día alrededor de "el retiro es a las
18:00" no tiene ningún aviso de la app hasta que efectivamente son las 18:00
— y para un dueño que coordina la entrega en persona, un recordatorio 24h y
2h antes es lo que evita el "se me olvidó" de ambos lados.

No hay Celery ni Redis en este proyecto (aunque `celery` esté en
requirements.txt, no hay worker ni broker configurados en ningún lado — es
una dependencia sin usar). Levantar esa infraestructura solo para esto sería
desproporcionado. En su lugar, `iniciar_bucle_recordatorios()` corre un
`asyncio.create_task` liviano dentro del propio proceso de FastAPI (ver
lifespan en app/main.py), que se despierta cada `INTERVALO_MINUTOS` y llama a
`enviar_recordatorios_pendientes()`.

Limitación conocida y aceptada: esto asume una sola instancia del backend. Si
algún día se escala a múltiples workers/instancias, cada uno correría su
propio bucle y un recordatorio podría mandarse más de una vez — para eso
haría falta coordinación externa (lock distribuido, o sí, un scheduler real
como Celery beat). No es el caso hoy.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import Auto, Reserva
from app.services.notificaciones import crear_notificacion

logger = logging.getLogger(__name__)

# Cada cuánto se revisa si hay recordatorios pendientes. 15 minutos es
# suficientemente fino para no dejar pasar la ventana de una hora que define
# cada aviso (ver _DEBE_ENVIARSE) sin encender el proceso todo el tiempo.
INTERVALO_MINUTOS = 15

# Ventana alrededor de las 24h/2h dentro de la cual se considera "es momento
# de avisar". Tiene que ser al menos tan ancha como INTERVALO_MINUTOS o
# quedarían huecos sin cubrir entre una revisión y la siguiente.
_VENTANA = timedelta(minutes=30)

ESTADOS_CON_RECORDATORIO = ("confirmada", "en_curso")


def _debe_enviarse(objetivo: datetime, ahora: datetime, horas_antes: int) -> bool:
    """`True` si `objetivo` cae dentro de la ventana alrededor de `horas_antes` horas desde `ahora`."""
    momento_aviso = objetivo - timedelta(hours=horas_antes)
    return momento_aviso - _VENTANA <= ahora <= momento_aviso + _VENTANA


def _nombre_auto(auto: Optional[Auto]) -> str:
    if not auto:
        return "tu auto"
    return f"{auto.marca} {auto.modelo} ({auto.patente})"


def enviar_recordatorios_pendientes(db: Session, ahora: Optional[datetime] = None) -> int:
    """
    Revisa las reservas activas y manda los push de 24h/2h que correspondan.

    Es la función que hace el trabajo real — `iniciar_bucle_recordatorios()`
    solo la llama periódicamente. Separarlas así es lo que la hace testeable
    sin necesidad de un event loop ni de esperar minutos reales.

    Devuelve cuántos recordatorios se mandaron, para logging/tests.
    """
    ahora = ahora or datetime.utcnow()
    enviados = 0

    reservas = (
        db.query(Reserva)
        .filter(Reserva.estado.in_(ESTADOS_CON_RECORDATORIO))
        .filter(Reserva.fecha_fin >= ahora)
        .all()
    )

    for reserva in reservas:
        auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
        nombre_auto = _nombre_auto(auto)

        avisos = [
            (
                "recordatorio_entrega_24h_enviado", reserva.fecha_inicio, 24,
                "Tu arriendo es mañana", f"Retiras el {nombre_auto} mañana. Revisa el punto de entrega acordado.",
            ),
            (
                "recordatorio_entrega_2h_enviado", reserva.fecha_inicio, 2,
                "Tu arriendo es en 2 horas", f"Retiras el {nombre_auto} en 2 horas.",
            ),
            (
                "recordatorio_devolucion_24h_enviado", reserva.fecha_fin, 24,
                "Devuelves el auto mañana", f"Mañana termina tu arriendo del {nombre_auto}. Recuerda dejarlo con el combustible acordado.",
            ),
            (
                "recordatorio_devolucion_2h_enviado", reserva.fecha_fin, 2,
                "Devuelves el auto en 2 horas", f"Te quedan 2 horas para devolver el {nombre_auto}.",
            ),
        ]

        for campo_flag, objetivo, horas_antes, titulo, mensaje in avisos:
            if getattr(reserva, campo_flag):
                continue
            if not _debe_enviarse(objetivo, ahora, horas_antes):
                continue

            crear_notificacion(
                db,
                usuario_id=reserva.cliente_id,
                tipo="recordatorio_entrega",
                titulo=titulo,
                mensaje=mensaje,
                entidad_tipo="reserva",
                entidad_id=reserva.id,
            )
            setattr(reserva, campo_flag, True)
            db.commit()
            enviados += 1

    return enviados


async def _bucle(session_factory) -> None:
    while True:
        try:
            await asyncio.sleep(INTERVALO_MINUTOS * 60)
            db = session_factory()
            try:
                cantidad = enviar_recordatorios_pendientes(db)
                if cantidad:
                    logger.info("[recordatorios] %s recordatorio(s) enviado(s)", cantidad)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — un fallo puntual no debe matar el bucle
            logger.exception("[recordatorios] Falló una pasada del bucle; se reintenta en la próxima")


def iniciar_bucle_recordatorios(session_factory) -> asyncio.Task:
    """Arranca el bucle en segundo plano. El caller (lifespan) guarda la Task para cancelarla al apagar."""
    return asyncio.create_task(_bucle(session_factory))
