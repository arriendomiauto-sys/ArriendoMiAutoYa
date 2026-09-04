"""
Validación del medio de pago del usuario.

Una tarjeta validada es **requisito para operar**: sin ella no se puede
arrendar (no hay de dónde retener la garantía) ni publicar un auto (no hay de
dónde cobrar el deducible, los cargos de la devolución ni los peajes que llegan
semanas después a nombre de la patente).

La tarjeta se captura junto con el KYC, no en una pantalla aparte, para que
cuando algo no se pueda verificar automáticamente **todo el caso viaje a
soporte en un solo ticket** en vez de dejar al usuario a medio camino entre dos
flujos.

Nunca se guarda el número de la tarjeta: solo el token que devuelve la pasarela
y los últimos cuatro dígitos, que son los que el usuario reconoce.
"""
import logging
import re
import unicodedata
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Estados posibles de `Usuario.tarjeta_estado`.
PENDIENTE = "pendiente"
VALIDADA = "validada"
RECHAZADA = "rechazada"
REVISION_MANUAL = "requiere_revision_manual"

MARCAS_CONOCIDAS = {"visa", "mastercard", "amex", "diners", "magna", "otra"}


def _marca_normalizada(marca: Optional[str]) -> str:
    m = (marca or "").strip().lower()
    return m if m in MARCAS_CONOCIDAS else "otra"


def _normalizar_nombre(nombre: Optional[str]) -> str:
    """Mayúsculas, sin tildes, espacios de más colapsados — para comparar
    nombres escritos con variaciones menores de tipeo, no de identidad."""
    if not nombre:
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", sin_tildes.strip().upper())


def nombres_coinciden(titular: Optional[str], nombre_cuenta: Optional[str]) -> bool:
    """
    Protocolo de seguridad: la tarjeta tiene que ser del dueño de la cuenta,
    no de un tercero — si no, cualquiera podría poner la tarjeta de otra
    persona como garantía de su propio arriendo.

    No exige mismo orden de palabras (una tarjeta puede venir impresa
    "APELLIDO NOMBRE") ni nombre completo de los dos lados: alcanza con que
    las palabras de uno estén contenidas en el otro.
    """
    palabras_titular = set(_normalizar_nombre(titular).split())
    palabras_cuenta = set(_normalizar_nombre(nombre_cuenta).split())
    if not palabras_titular or not palabras_cuenta:
        return False
    return palabras_titular.issubset(palabras_cuenta) or palabras_cuenta.issubset(palabras_titular)


def validar_tarjeta(
    token: Optional[str],
    ultimos4: Optional[str],
    marca: Optional[str],
    titular: Optional[str] = None,
    nombre_cuenta: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Valida los datos de la tarjeta que llegan desde la app.

    La app nunca manda el número: tokeniza contra la pasarela y envía el token.
    Acá se comprueba que ese token y los últimos cuatro dígitos vengan bien
    formados, y que el titular declarado sea el dueño de la cuenta. Devuelve
    `{estado, motivo, marca}`.

    Un dato mal formado (o un nombre que no coincide) no se rechaza de
    plano: va a revisión manual, porque normalmente significa que la
    tokenización se cortó a medias, o que el nombre viene con una variación
    razonable (apellido materno, segundo nombre) — no necesariamente que el
    usuario esté haciendo algo raro.
    """
    if not token or not str(token).strip():
        return {
            "estado": PENDIENTE,
            "motivo": "No se registró ninguna tarjeta.",
            "marca": None,
        }

    limpio4 = re.sub(r"\D", "", ultimos4 or "")
    if len(limpio4) != 4:
        logger.warning("[TARJETAS] Últimos 4 dígitos con formato inesperado: %r", ultimos4)
        return {
            "estado": REVISION_MANUAL,
            "motivo": "No pudimos leer los últimos 4 dígitos de la tarjeta.",
            "marca": _marca_normalizada(marca),
        }

    # Solo se exige si se declaró un titular — mantiene compatible el caso
    # (hoy inexistente) de una integración que no lo mande.
    if titular and nombre_cuenta and not nombres_coinciden(titular, nombre_cuenta):
        logger.warning(
            "[TARJETAS] Titular declarado no coincide con el dueño de la cuenta: %r vs %r",
            titular, nombre_cuenta,
        )
        return {
            "estado": REVISION_MANUAL,
            "motivo": (
                "El nombre del titular de la tarjeta no coincide con tu nombre registrado. "
                "Por seguridad, solo se aceptan tarjetas a tu propio nombre."
            ),
            "marca": _marca_normalizada(marca),
        }

    return {"estado": VALIDADA, "motivo": None, "marca": _marca_normalizada(marca)}


def puede_operar(usuario) -> bool:
    """`True` si el usuario tiene una tarjeta validada."""
    return getattr(usuario, "tarjeta_estado", None) == VALIDADA


def motivo_bloqueo(usuario, accion: str) -> str:
    """
    Mensaje para explicarle al usuario por qué no puede continuar, según en qué
    estado quedó su tarjeta. Genérico en `accion` para servir tanto al arriendo
    como a la publicación de un auto.
    """
    estado = getattr(usuario, "tarjeta_estado", None)

    if estado == REVISION_MANUAL:
        return (
            f"Tu tarjeta está en revisión. Te avisamos apenas quede lista y podrás {accion}."
        )
    if estado == RECHAZADA:
        return (
            f"Tu tarjeta fue rechazada. Registra otra desde tu perfil para {accion}."
        )
    return (
        f"Necesitas registrar una tarjeta de crédito para {accion}. "
        "Puedes hacerlo desde tu perfil, en Métodos de pago."
    )
