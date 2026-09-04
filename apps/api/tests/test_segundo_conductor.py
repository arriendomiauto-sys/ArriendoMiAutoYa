from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, engine, get_db
from app.models.entities import Usuario, Auto, Reserva, ConductorAdicional, TicketSoporte
from app.services.auth import get_current_user

client = TestClient(app)


def _crear_datos_base(db):
    db.query(TicketSoporte).delete()
    db.query(ConductorAdicional).delete()
    db.query(Reserva).delete()
    db.query(Auto).delete()
    db.query(Usuario).delete()
    db.commit()

    dueno = Usuario(
        id="user-dueno-sc",
        nombre="Dueño Prueba",
        rut="15.892.341-6",
        email="dueno.sc@rentacar.cl",
        telefono="+56911112222",
        estado_documentos="verificado",
        roles_activos=["dueno"],
        tarjeta_estado="validada",
        tarjeta_token="tok_test_dueno",
        tarjeta_ultimos4="1234",
        tarjeta_marca="visa",
        licencia_vencimiento=datetime.now(timezone.utc) + timedelta(days=365),
    )
    cliente = Usuario(
        id="user-cliente-sc",
        nombre="Cliente Titular",
        rut="19.234.567-7",
        email="cliente.sc@rentacar.cl",
        telefono="+56933334444",
        estado_documentos="verificado",
        roles_activos=["cliente"],
        tarjeta_estado="validada",
        tarjeta_token="tok_test_cliente",
        tarjeta_ultimos4="5678",
        tarjeta_marca="visa",
        fecha_nacimiento=datetime(1995, 5, 10, tzinfo=timezone.utc),
        licencia_pais_emisor="CL",
        licencia_numero="19234567-7",
        licencia_clase="B",
        licencia_vencimiento=datetime.now(timezone.utc) + timedelta(days=365),
    )
    cliente2 = Usuario(
        id="user-cliente-otro",
        nombre="Otro Cliente",
        rut="18.765.432-1",
        email="otro@rentacar.cl",
        telefono="+56955556666",
        estado_documentos="verificado",
        roles_activos=["cliente"],
        tarjeta_estado="validada",
        tarjeta_token="tok_test_otro",
        tarjeta_ultimos4="9999",
        tarjeta_marca="visa",
        fecha_nacimiento=datetime(1990, 1, 1, tzinfo=timezone.utc),
        licencia_vencimiento=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db.add_all([dueno, cliente, cliente2])
    db.commit()

    auto = Auto(
        id="auto-sc-01",
        dueno_id=dueno.id,
        marca="Toyota",
        modelo="RAV4",
        anio=2023,
        patente="SC-0001",
        tarifa_dia=40000,
        estado="activo",
        ubicacion_base="Los Ángeles, Chile",
        documentos_verificados=True,
    )
    db.add(auto)
    db.commit()

    return dueno, cliente, cliente2, auto


@pytest.fixture
def db_session():
    db = next(get_db())
    try:
        yield db
    finally:
        db.close()


def test_crear_reserva_con_segundo_conductor_chileno(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    f_inicio = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    f_fin = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    payload = {
        "auto_id": auto.id,
        "fecha_inicio": f_inicio,
        "fecha_fin": f_fin,
        "lugar_entrega_acordado": "Plaza de Armas, Los Ángeles",
        "segundo_conductor": {
            "nombre": "Carlos Conductor Segundo",
            "rut": "16.789.012-1",
            "email": "carlos.segundo@email.com",
            "telefono": "+56977778888",
            "tipo_documento": "rut",
            "fecha_nacimiento": "1992-04-15T00:00:00Z",
            "licencia_pais_emisor": "CL",
            "licencia_numero": "16789012-1",
            "licencia_clase": "B",
            "licencia_vencimiento": (datetime.now(timezone.utc) + timedelta(days=300)).isoformat(),
            "carnet_frontal_url": "https://storage.example.com/documentos-kyc/carlos-frente.jpg",
            "carnet_trasero_url": "https://storage.example.com/documentos-kyc/carlos-dorso.jpg",
            "licencia_url": "https://storage.example.com/documentos-kyc/carlos-licencia.jpg",
            "selfie_url": "https://storage.example.com/documentos-kyc/carlos-selfie.jpg",
        }
    }

    res = client.post("/api/v1/reservas", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["segundo_conductor"] is not None
    assert data["segundo_conductor"]["nombre"] == "Carlos Conductor Segundo"
    assert data["segundo_conductor"]["rut"] == "16.789.012-1"
    assert data["segundo_conductor"]["estado_kyc"] in ["verificado", "requiere_revision_manual"]

    app.dependency_overrides.clear()


def test_asignar_y_obtener_segundo_conductor(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-test-01",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    # Asignar segundo conductor
    payload = {
        "nombre": "Andrea Conductora Adicional",
        "rut": "17.654.321-3",
        "email": "andrea.sc@email.com",
        "telefono": "+56988889999",
        "tipo_documento": "rut",
        "fecha_nacimiento": "1994-08-20T00:00:00Z",
        "licencia_pais_emisor": "CL",
        "licencia_numero": "17654321-3",
        "licencia_clase": "B",
        "licencia_vencimiento": (datetime.now(timezone.utc) + timedelta(days=200)).isoformat(),
        "carnet_frontal_url": "https://storage.example.com/documentos-kyc/andrea-frente.jpg",
        "carnet_trasero_url": "https://storage.example.com/documentos-kyc/andrea-dorso.jpg",
        "licencia_url": "https://storage.example.com/documentos-kyc/andrea-licencia.jpg",
        "selfie_url": "https://storage.example.com/documentos-kyc/andrea-selfie.jpg",
    }

    res_post = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor", json=payload)
    assert res_post.status_code == 200, res_post.text
    data_post = res_post.json()
    assert data_post["nombre"] == "Andrea Conductora Adicional"
    assert data_post["rut"] == "17.654.321-3"

    # Obtener segundo conductor
    res_get = client.get(f"/api/v1/reservas/{reserva.id}/segundo-conductor")
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["nombre"] == "Andrea Conductora Adicional"
    assert data_get["reserva_id"] == reserva.id

    app.dependency_overrides.clear()


def test_segundo_conductor_menor_de_edad_deriva_a_soporte(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-test-edad",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    # Segundo conductor con 18 años (menor a la edad mínima de 21)
    menor_nacimiento = (datetime.now(timezone.utc) - timedelta(days=18 * 365 + 10)).isoformat()

    payload = {
        "nombre": "Joven Conductor",
        "rut": "20.123.456-5",
        "email": "joven@email.com",
        "telefono": "+56911223344",
        "tipo_documento": "rut",
        "fecha_nacimiento": menor_nacimiento,
        "licencia_pais_emisor": "CL",
        "licencia_numero": "20123456-5",
        "licencia_clase": "B",
        "licencia_vencimiento": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "carnet_frontal_url": "https://storage.example.com/documentos-kyc/joven-frente.jpg",
        "carnet_trasero_url": "https://storage.example.com/documentos-kyc/joven-dorso.jpg",
        "licencia_url": "https://storage.example.com/documentos-kyc/joven-licencia.jpg",
        "selfie_url": "https://storage.example.com/documentos-kyc/joven-selfie.jpg",
    }

    res = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["estado_kyc"] == "requiere_revision_manual"
    assert "edad" in data["notas_auditoria"].lower() or "licencia" in data["notas_auditoria"].lower()

    # Verificar que se creó ticket de soporte
    ticket = db_session.query(TicketSoporte).filter(TicketSoporte.usuario_id == cliente.id).first()
    assert ticket is not None
    assert "Segundo Conductor" in ticket.asunto

    app.dependency_overrides.clear()


def test_segundo_conductor_licencia_vencida_deriva_a_soporte(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-test-licencia",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    # Licencia vencida antes de fin de reserva
    licencia_vencida = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()

    payload = {
        "nombre": "Conductor Licencia Vencida",
        "rut": "15.678.901-1",
        "email": "vencido@email.com",
        "tipo_documento": "rut",
        "fecha_nacimiento": "1990-01-01T00:00:00Z",
        "licencia_pais_emisor": "CL",
        "licencia_numero": "15678901-1",
        "licencia_clase": "B",
        "licencia_vencimiento": licencia_vencida,
        "carnet_frontal_url": "https://storage.example.com/documentos-kyc/vencido-frente.jpg",
        "carnet_trasero_url": "https://storage.example.com/documentos-kyc/vencido-dorso.jpg",
        "licencia_url": "https://storage.example.com/documentos-kyc/vencido-licencia.jpg",
        "selfie_url": "https://storage.example.com/documentos-kyc/vencido-selfie.jpg",
    }

    res = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["estado_kyc"] == "requiere_revision_manual"
    assert "vencida" in data["notas_auditoria"].lower() or "licencia" in data["notas_auditoria"].lower()

    app.dependency_overrides.clear()


def test_eliminar_segundo_conductor(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-test-del",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id,
        nombre="Conductor Borrable",
        rut="17.654.321-3",
    )
    db_session.add(conductor)
    db_session.commit()

    res_del = client.delete(f"/api/v1/reservas/{reserva.id}/segundo-conductor")
    assert res_del.status_code == 200

    # Comprobar que ya no existe
    res_get = client.get(f"/api/v1/reservas/{reserva.id}/segundo-conductor")
    assert res_get.status_code == 404

    app.dependency_overrides.clear()


def test_segundo_conductor_en_contrato_pdf(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-pdf-01",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id,
        nombre="Segundo Piloto",
        rut="16.789.012-1",
        telefono="+56999887766",
        licencia_numero="16789012-1",
        estado_kyc="verificado",
    )
    db_session.add(conductor)
    db_session.commit()

    res_pdf = client.get(f"/api/v1/reservas/{reserva.id}/contrato-pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 1000

    app.dependency_overrides.clear()


def test_segundo_conductor_en_qr_entrega(db_session):
    dueno, cliente, _, auto = _crear_datos_base(db_session)
    app.dependency_overrides[get_current_user] = lambda: cliente

    reserva = Reserva(
        id="res-sc-qr-01",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    conductor = ConductorAdicional(
        reserva_id=reserva.id,
        nombre="Segundo Verificado",
        rut="16.789.012-1",
        licencia_clase="B",
        licencia_numero="16789012-1",
        selfie_url="https://storage.example.com/documentos-kyc/segundo-selfie.jpg",
        estado_kyc="verificado",
    )
    db_session.add(conductor)
    db_session.commit()

    # Generar QR
    from app.services.delivery import DeliveryService
    qr_data = DeliveryService.generar_codigo_qr(reserva.id, db_session)
    assert qr_data["segundo_conductor"] is not None
    assert qr_data["segundo_conductor"]["nombre"] == "Segundo Verificado"
    assert qr_data["segundo_conductor"]["estado_kyc"] == "verificado"

    # Validar QR
    val_data = DeliveryService.validar_codigo_qr(qr_data["codigo_qr_hash"], db_session)
    assert val_data["segundo_conductor"] is not None
    assert val_data["segundo_conductor"]["nombre"] == "Segundo Verificado"

    app.dependency_overrides.clear()


def test_segundo_conductor_idor_seguridad(db_session):
    dueno, cliente, cliente_otro, auto = _crear_datos_base(db_session)

    reserva = Reserva(
        id="res-sc-idor-01",
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc) + timedelta(days=1),
        fecha_fin=datetime.now(timezone.utc) + timedelta(days=4),
        estado="confirmada",
        monto_hold=120000,
        lugar_entrega_acordado="Terminal Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()

    # Usuario ajeno intenta asignar segundo conductor a reserva de otro
    app.dependency_overrides[get_current_user] = lambda: cliente_otro

    payload = {
        "nombre": "Invasor Conductor",
        "rut": "17.654.321-3",
    }
    res = client.post(f"/api/v1/reservas/{reserva.id}/segundo-conductor", json=payload)
    assert res.status_code == 403

    app.dependency_overrides.clear()

