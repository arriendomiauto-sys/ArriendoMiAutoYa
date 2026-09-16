"""
Envío del contrato firmado por correo (Resend). Se dispara desde
firmar_contrato la PRIMERA vez que ambas partes quedan firmadas — no en cada
firma individual. Apagado por defecto (sin RESEND_API_KEY) para no salir a
la red en dev/tests.
"""
import base64
from unittest.mock import MagicMock, patch

from app.models.entities import Reserva, Usuario, Auto
from app.core.config import settings
from app.features.communications.email.service import (
    enviar_contrato_firmado,
    _post_contrato_firmado,
)


def _partes(db_session):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    return reserva, cliente, dueno, auto


# --------------------------------------------------------------------------- #
# Disparo desde firmar_contrato
# --------------------------------------------------------------------------- #
def test_ambas_partes_dispara_el_envio_del_contrato(db_session, auth_as):
    reserva, cliente, dueno, auto = _partes(db_session)

    with patch(
        "app.features.bookings.reservations.router.enviar_contrato_firmado"
    ) as mock_enviar:
        auth_as(cliente).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "huella", "acepta_terminos": True},
        )
        mock_enviar.assert_not_called()  # falta el arrendador

        r = auth_as(dueno).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "facial", "acepta_terminos": True},
        )
        assert r.status_code == 200
        mock_enviar.assert_called_once()

    _, kwargs = mock_enviar.call_args
    assert set(kwargs["destinatarios"]) == {cliente.email, dueno.email}
    assert kwargs["patente"] == auto.patente
    assert kwargs["reserva_id"] == reserva.id
    assert isinstance(kwargs["pdf_bytes"], (bytes, bytearray)) and kwargs["pdf_bytes"]


def test_re_firmar_no_reenvia_el_contrato(db_session, auth_as):
    """Solo se manda la PRIMERA vez que se completan las dos firmas — no en
    cada re-firma posterior (p. ej. si alguien vuelve a firmar el mismo rol)."""
    reserva, cliente, dueno, _ = _partes(db_session)

    with patch(
        "app.features.bookings.reservations.router.enviar_contrato_firmado"
    ) as mock_enviar:
        auth_as(cliente).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "huella", "acepta_terminos": True},
        )
        auth_as(dueno).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "facial", "acepta_terminos": True},
        )
        assert mock_enviar.call_count == 1

        # El dueño vuelve a firmar (p. ej. cambia el método): ambas_partes
        # sigue True, pero fecha_firma_biometrica ya estaba puesta.
        auth_as(dueno).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "huella", "acepta_terminos": True},
        )
        assert mock_enviar.call_count == 1


# --------------------------------------------------------------------------- #
# enviar_contrato_firmado / _post_contrato_firmado (unidad)
# --------------------------------------------------------------------------- #
def test_sin_api_key_no_encola_nada(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    with patch(
        "app.features.communications.email.service._email_executor"
    ) as mock_executor:
        enviar_contrato_firmado(
            destinatarios=["cliente@test.cl", "dueno@test.cl"],
            patente="ABCD-12",
            reserva_id="res-123",
            pdf_bytes=b"%PDF-1.4 fake",
        )
        mock_executor.submit.assert_not_called()


def test_con_api_key_encola_el_envio(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    with patch(
        "app.features.communications.email.service._email_executor"
    ) as mock_executor:
        enviar_contrato_firmado(
            destinatarios=["cliente@test.cl", None, "dueno@test.cl"],
            patente="ABCD-12",
            reserva_id="res-12345678",
            pdf_bytes=b"%PDF-1.4 fake",
        )
        mock_executor.submit.assert_called_once()
        args = mock_executor.submit.call_args[0]
        assert args[0] is _post_contrato_firmado
        destinatarios_pasados = args[1]
        assert destinatarios_pasados == ["cliente@test.cl", "dueno@test.cl"]  # sin el None
        assert "ABCD-12" in args[5]  # filename


def test_post_contrato_firmado_arma_el_payload_correcto(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", "contratos@arriendomiautoya.cl")

    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.return_value = MagicMock(status_code=200, text="")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        _post_contrato_firmado(
            ["cliente@test.cl", "dueno@test.cl"],
            "Tu contrato de arriendo — ABCD-12",
            "<p>hola</p>",
            b"contenido-pdf",
            "Contrato-Arriendo-ABCD-12-RES12345.pdf",
        )

        mock_instance.post.assert_called_once()
        _, kwargs = mock_instance.post.call_args
        body = kwargs["json"]
        assert body["from"] == "contratos@arriendomiautoya.cl"
        assert body["to"] == ["cliente@test.cl", "dueno@test.cl"]
        assert body["subject"] == "Tu contrato de arriendo — ABCD-12"
        adjunto = body["attachments"][0]
        assert adjunto["filename"] == "Contrato-Arriendo-ABCD-12-RES12345.pdf"
        assert base64.b64decode(adjunto["content"]) == b"contenido-pdf"
        assert kwargs["headers"]["Authorization"] == "Bearer re_test_key"


def test_post_contrato_firmado_tolerante_a_fallos_http(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    with patch("httpx.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.post.side_effect = Exception("Resend caído")
        mock_client_cls.return_value.__enter__.return_value = mock_instance

        # No debe lanzar excepción — best-effort.
        _post_contrato_firmado(["cliente@test.cl"], "asunto", "<p>x</p>", b"pdf", "c.pdf")
