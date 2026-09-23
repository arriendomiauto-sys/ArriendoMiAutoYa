"""
Correos transaccionales vía Resend (resend.com): contrato firmado y depósito
de liquidación al dueño. Sin `RESEND_API_KEY` configurada, las funciones
`enviar_*` no hacen nada — el flujo que las dispara sigue funcionando igual,
mismo criterio best-effort que el push de Expo (ver notifications/service.py).
"""
import base64
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List

import httpx
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import settings
from app.features.communications.email import templates

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"

# El POST a Resend no debe demorar la respuesta de firmar_contrato — mismo
# patrón que el pool de push notifications: se despacha y se sigue.
_email_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="resend-email")


def _remitente(direccion: str) -> str:
    """Antepone el nombre de marca al remitente ("ArriendoMiAutoYa <x@dominio>"): un From
    con nombre visible en vez de la dirección pelada reduce la puntuación de spam."""
    if "<" in direccion:
        return direccion
    return f"ArriendoMiAutoYa <{direccion}>"


def _post_contrato_firmado(
    destinatarios: List[str], asunto: str, html: str, texto: str, pdf_bytes: bytes, filename: str
) -> None:
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                RESEND_URL,
                json={
                    "from": _remitente(settings.RESEND_FROM_EMAIL),
                    "to": destinatarios,
                    "subject": asunto,
                    "html": html,
                    "text": texto,
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
    html = templates.contrato_firmado(patente)
    texto = templates.contrato_firmado_texto(patente)
    try:
        _email_executor.submit(
            _post_contrato_firmado, destinatarios_validos, asunto, html, texto, pdf_bytes, filename
        )
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el envío del contrato por correo: %s", e)


_CLAVE_TRAS_COMMIT = "correos_tras_commit"


def _post_aviso(destinatarios: List[str], asunto: str, html: str, texto: str) -> None:
    try:
        remitente = getattr(settings, "RESEND_NOTIFICACIONES_EMAIL", None) or settings.RESEND_FROM_EMAIL
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                RESEND_URL,
                json={
                    "from": _remitente(remitente),
                    "to": destinatarios,
                    "subject": asunto,
                    "html": html,
                    "text": texto,
                },
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}", "Content-Type": "application/json"},
            )
        if resp.status_code >= 300:
            logger.warning("Resend rechazó un aviso de reserva (%s): %s", resp.status_code, resp.text[:300])
    except Exception as e:  # noqa: BLE001 — best-effort, nunca debe romper el flujo
        logger.info("Envío de un aviso de reserva por correo falló (no bloquea): %s", e)


def enviar_aviso_reserva(*, email: str, asunto: str, titulo: str, mensaje: str) -> None:
    """
    Encola un correo con el mismo texto que la notificación de la app, sin bloquear al llamador. No hace
    nada si Resend no está configurado ni si falta el correo del destinatario.
    """
    if not settings.RESEND_API_KEY or not email:
        return
    try:
        _email_executor.submit(
            _post_aviso, [email], asunto,
            templates.aviso_reserva(titulo, mensaje), templates.aviso_reserva_texto(titulo, mensaje),
        )
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el aviso de reserva por correo: %s", e)


def enviar_aviso_tras_commit(db, *, email: str, asunto: str, titulo: str, mensaje: str) -> None:
    """
    Guarda el correo en la sesión y lo manda cuando la transacción se confirma (listener más abajo). Si se
    revierte, se descarta: no sale un correo que anuncie algo que no ocurrió.
    """
    if not settings.RESEND_API_KEY or not email:
        return
    db.info.setdefault(_CLAVE_TRAS_COMMIT, []).append((email, asunto, titulo, mensaje))


@event.listens_for(Session, "after_commit")
def _despachar_correos_tras_commit(session) -> None:
    for email, asunto, titulo, mensaje in session.info.pop(_CLAVE_TRAS_COMMIT, []) or []:
        enviar_aviso_reserva(email=email, asunto=asunto, titulo=titulo, mensaje=mensaje)


@event.listens_for(Session, "after_rollback")
def _descartar_correos_tras_rollback(session) -> None:
    session.info.pop(_CLAVE_TRAS_COMMIT, None)


def _post_deposito_realizado(destinatarios: List[str], asunto: str, html: str, texto: str) -> None:
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                RESEND_URL,
                json={
                    "from": _remitente(settings.RESEND_FROM_EMAIL),
                    "to": destinatarios,
                    "subject": asunto,
                    "html": html,
                    "text": texto,
                },
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code >= 300:
            logger.warning(
                "Resend rechazó el envío del depósito (%s): %s",
                resp.status_code, resp.text[:300],
            )
    except Exception as e:  # noqa: BLE001 — best-effort, nunca debe romper la liquidación
        logger.info("Envío del depósito por correo falló (no bloquea): %s", e)


def enviar_deposito_realizado(
    *,
    email: str,
    monto: int,
    banco: str,
    numero_enmascarado: str,
) -> None:
    """
    Encola el correo de "depósito enviado" al dueño, sin bloquear al
    llamador. No hace nada si Resend no está configurado ni si falta el
    correo del destinatario.
    """
    if not settings.RESEND_API_KEY or not email:
        return

    monto_fmt = f"${int(monto or 0):,} CLP".replace(",", ".")
    asunto = f"Depositamos {monto_fmt} en tu cuenta"
    html = templates.deposito_realizado(monto_fmt=monto_fmt, banco=banco, numero_enmascarado=numero_enmascarado)
    texto = templates.deposito_realizado_texto(monto_fmt=monto_fmt, banco=banco, numero_enmascarado=numero_enmascarado)
    try:
        _email_executor.submit(_post_deposito_realizado, [email], asunto, html, texto)
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el envío del depósito por correo: %s", e)


def enviar_bienvenida(*, email: str) -> None:
    """
    Encola el correo de bienvenida al crear la fila local de Usuario (primer
    login tras registrarse en Supabase Auth), sin bloquear al llamador. No
    hace nada si Resend no está configurado ni si falta el correo.
    """
    if not settings.RESEND_API_KEY or not email:
        return
    try:
        _email_executor.submit(
            _post_aviso, [email], "¡Bienvenido a ArriendoMiAutoYa!",
            templates.bienvenida(), templates.bienvenida_texto(),
        )
    except Exception as e:  # noqa: BLE001 — nunca romper el flujo llamador
        logger.info("No se pudo encolar el correo de bienvenida: %s", e)
