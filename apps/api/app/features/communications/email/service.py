"""
Correos transaccionales vía Resend (resend.com).

Hoy el único caso: el contrato de arriendo firmado por ambas partes, que se
manda por correo a arrendatario y arrendador apenas queda firmado. Sin
`RESEND_API_KEY` configurada, `enviar_contrato_firmado` no hace nada — el
flujo que la dispara (firmar_contrato) sigue funcionando igual, mismo
criterio best-effort que el push de Expo (ver notifications/service.py).
"""
import base64
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"

# El POST a Resend no debe demorar la respuesta de firmar_contrato — mismo
# patrón que el pool de push notifications: se despacha y se sigue.
_email_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="resend-email")


def _post_contrato_firmado(
    destinatarios: List[str], asunto: str, html: str, pdf_bytes: bytes, filename: str
) -> None:
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                RESEND_URL,
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": destinatarios,
                    "subject": asunto,
                    "html": html,
                    "attachments": [
                        {
                            "filename": filename,
                            "content": base64.b64encode(pdf_bytes).decode("ascii"),
                        }
                    ],
                },
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 300:
            logger.warning(
                "Resend rechazó el envío del contrato (%s): %s",
                resp.status_code, resp.text[:300],
            )
    except Exception as e:  # noqa: BLE001 — best-effort, nunca debe romper la firma
        logger.info("Envío del contrato por correo falló (no bloquea): %s", e)


def enviar_contrato_firmado(
    *,
    destinatarios: List[str],
    patente: str,
    reserva_id: str,
    pdf_bytes: bytes,
) -> None:
    """
    Encola el envío del contrato firmado por correo a arrendatario y
    arrendador, sin bloquear al llamador. No hace nada si Resend no está
    configurado (dev/tests) ni si no hay a quién mandarlo.
    """
    destinatarios_validos = [d for d in destinatarios if d]
    if not settings.RESEND_API_KEY or not destinatarios_validos:
        return

    asunto = f"Tu contrato de arriendo — {patente}"
    filename = f"Contrato-Arriendo-{patente}-{reserva_id[:8].upper()}.pdf"
    html = (
        "<p>Hola,</p>"
        "<p>Adjuntamos el contrato de arriendo firmado por ambas partes.</p>"
        f"<p>Vehículo: <strong>{patente}</strong></p>"
        "<p>Este correo se generó automáticamente, no hace falta responderlo.</p>"
    )
    try:
        _email_executor.submit(
            _post_contrato_firmado, destinatarios_validos, asunto, html, pdf_bytes, filename
        )
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el envío del contrato por correo: %s", e)
