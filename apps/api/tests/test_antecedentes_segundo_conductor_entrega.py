"""
Si la reserva tiene segundo conductor, sus antecedentes también tienen que estar aprobados para
entregar el auto (con ANTECEDENTES_OBLIGATORIOS activo). Antes su `antecedentes_estado` no
impedía nada.
"""
import pytest

from app.core.config import settings
from app.models.entities import ConductorAdicional, Reserva, Usuario


@pytest.fixture
def escenario(db_session):
    reserva = db_session.query(Reserva).first()
    reserva.estado = "confirmada"
    db_session.commit()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()
    return reserva, dueno


def _con_conductor(db_session, reserva, estado):
    c = ConductorAdicional(reserva_id=reserva.id, nombre="Segundo Conductor", rut="16.789.012-1",
                           estado_kyc="verificado", antecedentes_estado=estado)
    db_session.add(c)
    db_session.commit()
    return c


def _entregar(auth_as, dueno, reserva):
    return auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={"tipo": "antes", "fotos": ["https://ej.com/1.jpg"], "kilometraje": 25000,
              "nivel_combustible": "lleno", "firma_svg": "M1 1L2 2"},
    )


@pytest.mark.parametrize("estado", [None, "pendiente", "revision", "bloqueado"])
def test_no_se_entrega_si_el_segundo_conductor_no_esta_limpio(db_session, auth_as, escenario, monkeypatch, estado):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)
    reserva, dueno = escenario
    _con_conductor(db_session, reserva, estado)

    resp = _entregar(auth_as, dueno, reserva)

    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["codigo"] == "ANTECEDENTES_PENDIENTES_CONDUCTOR"
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"


def test_se_entrega_si_el_segundo_conductor_esta_limpio(db_session, auth_as, escenario, monkeypatch):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)
    reserva, dueno = escenario
    _con_conductor(db_session, reserva, "limpio")

    assert _entregar(auth_as, dueno, reserva).status_code == 200


def test_sin_segundo_conductor_no_cambia_nada(db_session, auth_as, escenario, monkeypatch):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", True)
    reserva, dueno = escenario

    assert _entregar(auth_as, dueno, reserva).status_code == 200


def test_con_el_bloqueo_apagado_no_se_exige(db_session, auth_as, escenario, monkeypatch):
    monkeypatch.setattr(settings, "ANTECEDENTES_OBLIGATORIOS", False)
    reserva, dueno = escenario
    _con_conductor(db_session, reserva, "pendiente")

    assert _entregar(auth_as, dueno, reserva).status_code == 200
