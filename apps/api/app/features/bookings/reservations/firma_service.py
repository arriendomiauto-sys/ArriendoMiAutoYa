"""
Firma del contrato de arriendo.

El contrato se firma EN LA ENTREGA, con las dos partes juntas: después de que
el dueño verificó la identidad del arrendatario (QR + foto) y de registrar las
fotos del checklist. Antes se firmaba por separado —el arrendatario antes de
pagar y el dueño apenas llegaba la solicitud—, sin que nadie hubiera visto el
auto ni a la otra persona.

- `verificacion_entrega_confirmada`: se juntaron (el dueño confirmó la identidad).
- `registrar_firma`: guarda (o actualiza) la firma de una parte con el hash del
  contrato vigente, que prueba qué se firmó.
- `completar_si_corresponde`: con ambas partes firmadas marca el contrato como
  firmado. Quien llama hace el commit y después manda el correo con el PDF.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.entities import FirmaContrato, Reserva, Usuario, VerificacionEntrega

ROLES = ("arrendatario", "arrendador")


def verificacion_entrega_confirmada(db: Session, reserva_id: str) -> bool:
    return (
        db.query(VerificacionEntrega.id)
        .filter(
            VerificacionEntrega.reserva_id == reserva_id,
            VerificacionEntrega.tipo == "entrega",
            VerificacionEntrega.resultado == "confirmada",
        )
        .first()
        is not None
    )


def generar_pdf(db: Session, reserva: Reserva) -> bytes:
    # Import local: el generador vive en el router de reservas.
    from app.features.bookings.reservations.router import _generar_pdf_contrato

    return _generar_pdf_contrato(reserva, db)


def registrar_firma(
    db: Session,
    reserva: Reserva,
    usuario: Usuario,
    rol: str,
    metodo: str,
    firma_svg: Optional[str] = None,
    nombre_firmante: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    pdf_bytes: Optional[bytes] = None,
) -> Tuple[FirmaContrato, bytes]:
    """Guarda la firma de `rol` (una por rol). Devuelve `(firma, pdf_bytes del contrato firmado)`."""
    from app.features.auth.onboarding.contract_service import ContractService

    pdf_bytes = pdf_bytes or generar_pdf(db, reserva)
    pdf_hash = ContractService.calcular_hash_contrato(pdf_bytes)

    firma = (
        db.query(FirmaContrato)
        .filter(FirmaContrato.reserva_id == reserva.id, FirmaContrato.rol == rol)
        .first()
    )
    if not firma:
        firma = FirmaContrato(reserva_id=reserva.id, rol=rol)
        db.add(firma)
    firma.usuario_id = usuario.id
    firma.metodo = metodo
    firma.firma_svg = firma_svg if metodo == "escrita" else None
    firma.nombre_firmante = (nombre_firmante or usuario.nombre or "").strip() or None
    firma.hash_contrato_sha256 = pdf_hash
    firma.ip = ip
    firma.user_agent = (user_agent or "")[:500] or None
    firma.firmado_en = datetime.now(timezone.utc)
    reserva.hash_contrato_sha256 = pdf_hash
    db.flush()
    return firma, pdf_bytes


def ambas_partes_firmaron(db: Session, reserva: Reserva) -> bool:
    roles = {
        r for (r,) in db.query(FirmaContrato.rol).filter(FirmaContrato.reserva_id == reserva.id).all()
    }
    return set(ROLES).issubset(roles)


def completar_si_corresponde(db: Session, reserva: Reserva) -> bool:
    """`True` si con esto el contrato quedó firmado por ambas partes por primera vez (sin commit)."""
    if reserva.fecha_firma_biometrica or not ambas_partes_firmaron(db, reserva):
        return False
    reserva.fecha_firma_biometrica = datetime.now(timezone.utc)
    return True


def enviar_contrato(reserva: Reserva, pdf_bytes: bytes) -> None:
    """Correo con el contrato firmado a las dos partes (no hace nada sin Resend)."""
    from app.features.communications.email.service import enviar_contrato_firmado

    auto = reserva.auto
    dueno = auto.dueno if auto else None
    enviar_contrato_firmado(
        destinatarios=[
            reserva.cliente.email if reserva.cliente else None,
            dueno.email if dueno else None,
        ],
        patente=auto.patente if auto else "",
        reserva_id=reserva.id,
        pdf_bytes=pdf_bytes,
    )
