"""
=============================================================================
BLOQUE TEMPORAL — BORRAR CUANDO LA CUENTA DE MERCADO PAGO ESTÉ CONFIGURADA
=============================================================================

Sin credenciales de Mercado Pago el flujo de reserva queda trancado: la
reserva nace `pendiente` y solo pasa a `confirmada` cuando la pasarela
autoriza la garantía. Sin `MERCADOPAGO_ACCESS_TOKEN`, `POST
/pagos/mercadopago/iniciar` falla y no hay forma de probar nada aguas abajo
(entrega, checklist, cargos, liquidación).

Este módulo reemplaza esas llamadas por respuestas que **dan el pago y la
retención por aprobados**, con la misma forma que devuelve
`MercadoPagoService`, para que el resto del sistema no note la diferencia.

Cómo eliminarlo cuando llegue la cuenta real
--------------------------------------------
1. Borrar este archivo.
2. Borrar `PAGOS_SIMULADOS` de `app/core/config.py`.
3. Borrar los bloques marcados con `BLOQUE TEMPORAL` en
   `app/routers/pagos.py`.
4. Borrar `apps/api/tests/test_pagos_simulados.py`.
5. En la app móvil, borrar la rama `inicio.simulado` de `irAPagar`
   (`apps/mobile/src/renter/screens/PaymentMethodsScreen.js`).

Después de eso no queda ningún rastro: nada del resto del código importa este
módulo.

Salvaguardas
------------
* **Nunca se activa en producción**, aunque la variable venga en `true`: un
  pago falso en producción es un arriendo gratis.
* Cada pago simulado queda con referencia `SIMULADO-…` en la tabla `pagos` y
  con un evento en la auditoría de seguridad, para poder distinguirlos
  después de los reales.
"""
import logging
import uuid
from typing import Any, Dict

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIJO_TOKEN = "SIMULADO-"


def pagos_simulados_activos() -> bool:
    """
    `True` solo si la simulación está encendida y NO estamos en producción.
    """
    if not settings.PAGOS_SIMULADOS:
        return False

    if (settings.ENVIRONMENT or "").lower() in ("production", "produccion", "prod"):
        logger.error(
            "PAGOS_SIMULADOS viene activado en un entorno de producción: se ignora. "
            "Configura las credenciales reales de Mercado Pago."
        )
        return False

    return True


def es_pago_simulado(payment_id: str) -> bool:
    """
    Un pago simulado se reconoce por su prefijo, así que un payment_id real de
    Mercado Pago que llegue mientras la simulación está encendida se sigue
    consultando contra la API de verdad.
    """
    return bool(payment_id) and str(payment_id).startswith(PREFIJO_TOKEN)


def crear_preferencia_simulada(referencia_externa: str, monto: int, return_url: str) -> Dict[str, Any]:
    """
    Equivalente de `MercadoPagoService.crear_preferencia`, sin salir a la red.

    Devuelve la misma forma que el servicio real más `simulado: True`, que es
    lo que mira el cliente para saltarse el checkout de Mercado Pago.
    """
    payment_id = f"{PREFIJO_TOKEN}{uuid.uuid4().hex[:16].upper()}"
    separador = "&" if "?" in (return_url or "") else "?"

    logger.warning(
        "[PAGOS SIMULADOS] Preferencia creada sin pasarela real: ref=%s monto=%s payment_id=%s",
        referencia_externa, monto, payment_id,
    )

    return {
        "success": True,
        "preferencia_id": payment_id,
        # Apunta al mismo retorno que usaría Checkout Pro, para que un flujo
        # web que siga la URL termine igual que con la pasarela real.
        "url": (
            f"{return_url}{separador}payment_id={payment_id}&status=approved&simulado=1"
            if return_url
            else None
        ),
        "monto": monto,
        "referencia_externa": referencia_externa,
        "simulado": True,
    }


def obtener_pago_simulado(payment_id: str, monto: int = 0, retenido: bool = False) -> Dict[str, Any]:
    """
    Equivalente de `MercadoPagoService.obtener_pago`: da el pago por aprobado,
    que es justamente lo que se necesita para que la reserva pase a
    `confirmada` y la garantía quede retenida.
    """
    logger.warning("[PAGOS SIMULADOS] Pago dado por aprobado sin pasarela real: %s", payment_id)

    estado = "authorized" if retenido else "approved"
    return {
        "success": True,
        "autorizada": True,
        "capturado": not retenido,
        "retenido": retenido,
        "estado": estado,
        "detalle_estado": "accredited",
        "payment_id": payment_id,
        "monto": monto,
        "referencia_externa": None,
        "medio_pago": "master",
        "tarjeta": {"ultimos4": "0000", "marca": "master"},
        "simulado": True,
        "raw": {"simulado": True, "id": payment_id, "status": estado},
    }
