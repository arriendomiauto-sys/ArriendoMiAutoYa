"""
PATCH /reservas/{id}/estado aceptaba cualquier string como nuevo_estado sin
validar que la transición tuviera sentido (ej. saltar de "pendiente" a
"finalizada" sin haber pasado por el checklist de entrega/devolución).
Ahora valida contra una whitelist de transiciones — el resto de los
estados (confirmada->en_curso, en_curso->finalizada/disputada) los sigue
fijando el flujo de entrega/checklist, que valida sus propias condiciones.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, Reserva


def _crear_reserva(db_session, cliente, dueno, estado, patente="TRAN-01"):
    auto = Auto(
        dueno_id=dueno.id,
        marca="Suzuki",
        modelo="Swift",
        anio=2023,
        patente=patente,
        tarifa_dia=30000,
        ubicacion_base="Plaza de Armas, Los Ángeles",
        doc_inscripcion_url="https://ejemplo.com/padron.jpg",
        doc_permiso_circulacion_url="https://ejemplo.com/permiso.jpg",
        doc_soap_url="https://ejemplo.com/soap.jpg",
        doc_revision_tecnica_url="https://ejemplo.com/prt.jpg",
        documentos_verificados=True,
        gps_consentimiento=True,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora,
        fecha_fin=ahora + timedelta(days=3),
        estado=estado,
        monto_hold=100000,
        lugar_entrega_acordado="Plaza de Armas, Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)
    return reserva


def test_pendiente_puede_cancelarse(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    reserva = _crear_reserva(db_session, cliente, dueno, "pendiente", patente="TRAN-01")

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "cancelada"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "cancelada"


def test_en_curso_no_admite_cambios_manuales(usuario_factory, auth_as, db_session):
    """
    Con el auto ya retirado, saltar directo a "finalizada" por acá se
    saltaría el checklist de devolución (kilometraje, combustible, daños,
    cálculo del cobro final) -- eso lo fija DeliveryService, no este
    endpoint genérico.
    """
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    reserva = _crear_reserva(db_session, cliente, dueno, "en_curso", patente="TRAN-02")

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "finalizada"}
    )
    assert resp.status_code == 400
    assert "no admite cambios manuales" in resp.json()["detail"]


def test_finalizada_es_terminal(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    reserva = _crear_reserva(db_session, cliente, dueno, "finalizada", patente="TRAN-03")

    resp = auth_as(dueno).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )
    assert resp.status_code == 400


def test_confirmada_no_puede_saltar_a_en_curso_por_este_endpoint(usuario_factory, auth_as, db_session):
    """en_curso lo fija confirmar_verificacion_identidad (flujo QR), no este endpoint."""
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    reserva = _crear_reserva(db_session, cliente, dueno, "confirmada", patente="TRAN-04")

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "en_curso"}
    )
    assert resp.status_code == 400
    assert "pendiente" not in resp.json()["detail"]  # el mensaje refleja el estado real

    # Pero cancelar antes de retirar el auto sigue permitido.
    resp_cancel = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "cancelada"}
    )
    assert resp_cancel.status_code == 200
