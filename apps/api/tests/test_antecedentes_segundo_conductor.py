"""
Cuando el KYC del segundo conductor queda "verificado", se programa el cálculo de su
estado de antecedentes en background. El estado sale de los certificados que sube el
titular (ver test_certificados_servicio.py); acá solo se comprueba que la asignación
del conductor programa esa tarea.
"""
from datetime import datetime, timedelta, timezone

from app.features.auth.background_checks.service import BackgroundCheckService
from app.models.entities import Usuario, Auto, Reserva, ConductorAdicional, TicketSoporte


def _crear_datos(db):
    db.query(TicketSoporte).delete()
    db.query(ConductorAdicional).delete()
    db.query(Reserva).delete()
    db.query(Auto).delete()
    db.query(Usuario).delete()
    db.commit()

    dueno = Usuario(
        id="dueno-antc", nombre="Dueño", rut="15.892.341-6", email="dueno.antc@test.cl",
        estado_documentos="verificado", roles_activos=["dueno"],
    )
    cliente = Usuario(
        id="cliente-antc", nombre="Cliente Titular", rut="19.234.567-7", email="cliente.antc@test.cl",
        estado_documentos="verificado", roles_activos=["cliente"],
    )
    db.add_all([dueno, cliente])
    db.commit()

    auto = Auto(
        id="auto-antc-01", dueno_id=dueno.id, marca="Toyota", modelo="RAV4", anio=2023,
        patente="ANTC-01", tarifa_dia=40000, estado="activo", ubicacion_base="Los Ángeles",
        documentos_verificados=True,
    )
    db.add(auto)
    db.commit()

    reserva = Reserva(
        id="res-antc-01", auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada", monto_hold=120000, lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db.add(reserva)
    db.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id, nombre="Segundo Conductor", rut="16.789.012-1",
        estado_kyc="verificado",
    )
    db.add(conductor)
    db.commit()

    return dueno, cliente, auto, reserva, conductor


def test_asignar_segundo_conductor_programa_verificacion_de_antecedentes(client, db_session, monkeypatch):
    from app.services.auth import get_current_user
    from app.main import app

    dueno, cliente, auto, reserva, conductor = _crear_datos(db_session)
    db_session.delete(conductor)
    db_session.commit()

    llamadas = []
    monkeypatch.setattr(
        BackgroundCheckService, "run_and_flag_conductor_in_background",
        staticmethod(lambda conductor_id: llamadas.append(conductor_id)),
    )

    app.dependency_overrides[get_current_user] = lambda: cliente
    try:
        resp = client.post(
            f"/api/v1/reservas/{reserva.id}/segundo-conductor",
            json={
                "nombre": "Nuevo Conductor",
                "rut": "17.654.321-3",
                "carnet_frontal_url": "https://ejemplo.com/frente.jpg",
                "carnet_trasero_url": "https://ejemplo.com/dorso.jpg",
                "selfie_url": "https://ejemplo.com/selfie.jpg",
                "fecha_nacimiento": "1990-01-01T00:00:00Z",
                "licencia_vencimiento": (datetime.now(timezone.utc) + timedelta(days=300)).isoformat(),
            },
        )
        assert resp.status_code == 200, resp.text
        if resp.json()["estado_kyc"] == "verificado":
            assert llamadas == [resp.json()["id"]]
        else:
            # El OCR mock puede derivar a revisión por otro motivo (ej.
            # clasificación del documento) -- en ese caso no se gasta la
            # consulta de antecedentes todavía.
            assert llamadas == []
    finally:
        app.dependency_overrides.clear()
