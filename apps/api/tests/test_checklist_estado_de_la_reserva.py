"""
El checklist de entrega/devolución solo puede registrarse en el momento que le
toca de la vida de la reserva.

Hallazgo de la revisión de QA (2026-09-20): `registrar_checklist` no miraba el
estado de la reserva. Como es el paso que la deja `en_curso`/`finalizada` y
crea la liquidación del dueño, el dueño (o alguien que se ponga de acuerdo con
un arrendatario) podía:

  · cerrar la devolución de una reserva CANCELADA, ya reembolsada al
    arrendatario, y cobrar igual el 85 % del arriendo;
  · cerrar la devolución de una reserva nunca entregada, o sin pagar;
  · repetir el cierre de una reserva ya finalizada: cada llamada creaba una
    liquidación nueva, y el barrido paga cada una.

Ciclo válido: confirmada --(antes)--> en_curso --(despues)--> finalizada.
"""
from sqlalchemy.orm import object_session
import pytest

from app.models.entities import Pago, Reserva, Usuario


def _escenario(db_session, estado):
    reserva = db_session.query(Reserva).first()
    reserva.estado = estado
    db_session.commit()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()
    return reserva, dueno


def _checklist(auth_as, dueno, reserva_id, tipo):
    cuerpo = {"tipo": tipo, "fotos": ["https://ej.com/1.jpg"], "kilometraje": 25000, "nivel_combustible": "lleno"}
    if tipo == "antes":
        from conftest import dejar_listo_para_firmar

        # Juntos en la entrega: identidad verificada y el dueño firmó; el arrendatario firma con el trazo.
        dejar_listo_para_firmar(object_session(dueno), reserva_id)
        cuerpo["firma_svg"] = "M1 1L2 2"
    return auth_as(dueno).post(f"/api/v1/entrega/{reserva_id}/checklist", json=cuerpo)


def _liquidaciones(db_session, reserva_id):
    db_session.expire_all()
    return db_session.query(Pago).filter(Pago.reserva_id == reserva_id, Pago.tipo == "liquidacion_dueno").count()


@pytest.mark.parametrize("estado", ["pendiente_pago", "pendiente", "cancelada", "finalizada", "disputada"])
def test_no_se_entrega_una_reserva_que_no_esta_confirmada(db_session, auth_as, estado):
    reserva, dueno = _escenario(db_session, estado)

    resp = _checklist(auth_as, dueno, reserva.id, "antes")

    assert resp.status_code in (400, 409), f"entregó una reserva en estado {estado}: {resp.text}"
    db_session.refresh(reserva)
    assert reserva.estado == estado


@pytest.mark.parametrize("estado", ["confirmada", "pendiente_pago", "pendiente", "cancelada", "disputada"])
def test_no_se_cierra_la_devolucion_de_una_reserva_que_no_esta_en_curso(db_session, auth_as, estado):
    reserva, dueno = _escenario(db_session, estado)

    resp = _checklist(auth_as, dueno, reserva.id, "despues")

    assert resp.status_code in (400, 409), f"cerró la devolución de una reserva {estado}: {resp.text}"
    db_session.refresh(reserva)
    assert reserva.estado == estado
    assert _liquidaciones(db_session, reserva.id) == 0, "se generó una liquidación para el dueño sin arriendo real"


def test_cerrar_la_devolucion_dos_veces_no_liquida_dos_veces(db_session, auth_as):
    reserva, dueno = _escenario(db_session, "en_curso")

    primera = _checklist(auth_as, dueno, reserva.id, "despues")
    segunda = _checklist(auth_as, dueno, reserva.id, "despues")

    assert primera.status_code == 200, primera.text
    assert segunda.status_code in (400, 409), segunda.text
    assert _liquidaciones(db_session, reserva.id) == 1


def test_entregar_dos_veces_no_reinicia_el_arriendo(db_session, auth_as):
    reserva, dueno = _escenario(db_session, "confirmada")

    primera = _checklist(auth_as, dueno, reserva.id, "antes")
    segunda = _checklist(auth_as, dueno, reserva.id, "antes")

    assert primera.status_code == 200, primera.text
    assert segunda.status_code in (400, 409), segunda.text
