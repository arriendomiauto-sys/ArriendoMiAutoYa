"""
=============================================================================
BLOQUE TEMPORAL — BORRAR CUANDO LA PASARELA DE PAGO ESTÉ CONFIGURADA
=============================================================================

Mientras no exista la cuenta real de Transbank Webpay, el flujo de reserva
queda trancado: la reserva nace `pendiente` y solo pasa a `confirmada` cuando
Transbank autoriza el hold. Sin credenciales, `POST /pagos/webpay/iniciar`
falla contra la red y no hay forma de probar nada aguas abajo (entrega,
checklist, cargos, liquidación).

Este módulo reemplaza esas dos llamadas por respuestas que **dan el pago y la
retención por aprobados**, con la misma forma que devuelve `TransbankService`,
para que el resto del sistema no note la diferencia.

Cómo eliminarlo cuando llegue la pasarela real
----------------------------------------------
1. Borrar este archivo.
2. Borrar `PAGOS_SIMULADOS` de `app/core/config.py`.
3. Borrar los dos bloques marcados con `BLOQUE TEMPORAL` en
   `app/routers/pagos.py`.
4. Borrar `apps/api/tests/test_pagos_simulados.py`.
5. En la app móvil, borrar la rama `inicio.simulado` de `irAWebpay`
   (`apps/mobile/src/renter/screens/PaymentMethodsScreen.js`).

Después de eso no queda ningún rastro: nada del resto del código importa este
módulo.

Salvaguardas
------------
* Está **apagado por defecto** (`PAGOS_SIMULADOS=False`).
* **Nunca se activa en producción**, aunque la variable venga en `true`: un
  pago falso en producción es un arriendo gratis.
* Cada pago simulado queda con referencia `SIMULADO-…` en la tabla `pagos` y
  con un evento en la auditoría de seguridad, para poder distinguirlos después
  de los reales.
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
            "Configura las credenciales reales de Transbank."
        )
        return False

    return True


def es_token_simulado(token_ws: str) -> bool:
    """
    Un token simulado se reconoce por su prefijo, así que un token real que
    llegue mientras la simulación está encendida sigue yendo a Transbank.
    """
    return bool(token_ws) and str(token_ws).startswith(PREFIJO_TOKEN)


def crear_transaccion_simulada(buy_order: str, amount: int, return_url: str) -> Dict[str, Any]:
    """
    Equivalente de `TransbankService.crear_transaccion`, sin salir a la red.

    Devuelve la misma forma que el servicio real más `simulado: True`, que es
    lo que mira el cliente para saltarse el navegador de Webpay.
    """
    token = f"{PREFIJO_TOKEN}{uuid.uuid4().hex[:16].upper()}"
    separador = "&" if "?" in (return_url or "") else "?"

    logger.warning(
        "[PAGOS SIMULADOS] Transacción creada sin pasarela real: buy_order=%s monto=%s token=%s",
        buy_order, amount, token,
    )

    return {
        "success": True,
        "token": token,
        # Apunta al mismo retorno que usaría Webpay, para que un flujo web que
        # siga la URL termine igual que con la pasarela real.
        "url": f"{return_url}{separador}token_ws={token}&simulado=1" if return_url else None,
        "buy_order": buy_order,
        "amount": amount,
        "simulado": True,
    }


def confirmar_transaccion_simulada(token_ws: str, monto: int = 0) -> Dict[str, Any]:
    """
    Equivalente de `TransbankService.confirmar_transaccion`: da la transacción
    por autorizada, que es justamente lo que se necesita para que la reserva
    pase a `confirmada` y el hold quede `capturado`.
    """
    logger.warning("[PAGOS SIMULADOS] Transacción dada por autorizada sin pasarela real: token=%s", token_ws)

    return {
        "success": True,
        "autorizada": True,
        "status": "AUTHORIZED",
        "response_code": 0,
        "amount": monto,
        "buy_order": f"ORD-{token_ws[-8:]}",
        "authorization_code": "SIMULADO",
        "card_detail": {"card_number": "XXXXXXXXXXXX0000"},
        "transaction_date": None,
        "simulado": True,
        "raw": {"simulado": True, "token": token_ws},
    }
