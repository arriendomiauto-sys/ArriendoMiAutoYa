"""
Rastreo GPS: consentimiento del dueño, consulta de posición y protocolo de
corte remoto de motor.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, Reserva

PAYLOAD_AUTO = {
    "marca": "Kia",
    "modelo": "Sportage",
    "anio": 2023,
    "patente": "GPSX-01",
    "tarifa_dia": 39000,
    "ubicacion_base": "Paillihue, Los Ángeles",
    "doc_inscripcion_url": "https://ejemplo.com/padron.jpg",
    "doc_permiso_circulacion_url": "https://ejemplo.com/permiso.jpg",
    "doc_soap_url": "https://ejemplo.com/soap.jpg",
    "doc_revision_tecnica_url": "https://ejemplo.com/revtec.jpg",
    "doc_certificado_gases_url": "https://ejemplo.com/gases.jpg",
}


def test_publicar_auto_sin_consentimiento_gps_se_rechaza(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post("/api/v1/autos", json={**PAYLOAD_AUTO, "gps_consentimiento": False})

    assert resp.status_code == 400
    assert "GPS" in resp.json()["detail"]


def test_publicar_auto_con_consentimiento_sella_la_fecha(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    resp = auth_as(dueno).post("/api/v1/autos", json={**PAYLOAD_AUTO, "gps_consentimiento": True})

    assert resp.status_code == 200, resp.text
    auto = db_session.query(Auto).filter(Auto.patente == "GPSX-01").first()
    assert auto.gps_consentimiento is True
    assert auto.gps_consentimiento_fecha is not None


def test_posicion_gps_del_auto_propio(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Kia",
        modelo="Sportage",
        anio=2023,
        patente="GPSX-02",
        tarifa_dia=39000,
        ubicacion_base="Paillihue, Los Ángeles",
        gps_consentimiento=True,
        gps_device_id="GPS-TEST-02",
        gps_instalado=True,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)

    resp = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/gps/posicion")
    assert resp.status_code == 200, resp.text
    posicion = resp.json()["posicion"]
    assert -38 < posicion["latitud"] < -36
    assert -73 < posicion["longitud"] < -71

    db_session.refresh(auto)
    assert auto.gps_ultima_posicion is not None


def test_posicion_gps_sin_consentimiento_da_403(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Kia",
        modelo="Sportage",
        anio=2023,
        patente="GPSX-03",
        tarifa_dia=39000,
        ubicacion_base="Paillihue, Los Ángeles",
        gps_consentimiento=False,
        gps_device_id="GPS-TEST-03",
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)

    resp = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/gps/posicion")
    assert resp.status_code == 403


def _auto_con_gps_y_reserva(db_session, dueno, cliente, estado_reserva, patente, vencida=False):
    auto = Auto(
        dueno_id=dueno.id,
        marca="Kia",
        modelo="Sportage",
        anio=2023,
        patente=patente,
        tarifa_dia=39000,
        ubicacion_base="Paillihue, Los Ángeles",
        gps_consentimiento=True,
        gps_device_id=f"GPS-{patente}",
        gps_instalado=True,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    fin = ahora - timedelta(days=2) if vencida else ahora + timedelta(days=2)
    reserva = Reserva(
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora - timedelta(days=5),
        fecha_fin=fin,
        estado=estado_reserva,
        monto_hold=100000,
        lugar_entrega_acordado="Paillihue, Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)
    return auto, reserva


def test_corte_de_motor_solo_para_admin(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"])
    auto, reserva = _auto_con_gps_y_reserva(db_session, dueno, cliente, "disputada", "GPSX-04")

    resp = auth_as(dueno).post(
        f"/api/v1/autos/{auto.id}/gps/cortar-motor",
        json={"motivo": "El arrendatario no devuelve el vehículo", "reserva_id": reserva.id},
    )
    assert resp.status_code == 403


def test_corte_de_motor_requiere_reserva_disputada_o_vencida(usuario_factory, auth_as, db_session):
    admin = usuario_factory(roles_activos=["admin"])
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"])
    auto, reserva = _auto_con_gps_y_reserva(db_session, dueno, cliente, "en_curso", "GPSX-05")

    resp = auth_as(admin).post(
        f"/api/v1/autos/{auto.id}/gps/cortar-motor",
        json={"motivo": "Quiero cortar el motor sin razón válida", "reserva_id": reserva.id},
    )
    assert resp.status_code == 400
    assert "disputada" in resp.json()["detail"]


def test_corte_de_motor_procede_con_reserva_vencida_sin_devolucion(usuario_factory, auth_as, db_session):
    admin = usuario_factory(roles_activos=["admin"])
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"])
    auto, reserva = _auto_con_gps_y_reserva(
        db_session, dueno, cliente, "en_curso", "GPSX-06", vencida=True
    )

    resp = auth_as(admin).post(
        f"/api/v1/autos/{auto.id}/gps/cortar-motor",
        json={
            "motivo": "Vehículo no devuelto 48 horas después del término del arriendo",
            "reserva_id": reserva.id,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ejecutado"] is True


def test_telemetria_celular_arrendatario_y_consulta_dueno(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"])
    auto, reserva = _auto_con_gps_y_reserva(db_session, dueno, cliente, "en_curso", "GPSX-07")
    auto.gps_device_id = None  # Sin equipo OBD, rastreo 100% por celular

    # 1. El arrendatario manda la ubicación desde su celular
    resp_tel = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/telemetria",
        json={"latitud": -33.4372, "longitud": -70.6506, "velocidad": 45.0, "precision": 10.0},
    )
    assert resp_tel.status_code == 200
    assert resp_tel.json()["ok"] is True

    # 2. El dueño consulta en vivo
    resp_dueno = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/gps/posicion")
    assert resp_dueno.status_code == 200
    data = resp_dueno.json()
    assert data["posicion"]["latitud"] == -33.4372
    assert data["posicion"]["fuente"] == "celular_arrendatario"
    assert data["estado_senal"] == "en_linea"
    assert data["alerta"] is None
    assert data["en_arriendo"] is True


def test_alertas_gps_30_minutos_y_1_hora(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"])
    auto, reserva = _auto_con_gps_y_reserva(db_session, dueno, cliente, "en_curso", "GPSX-08")
    auto.gps_device_id = None

    ahora = datetime.now(timezone.utc)

    # Caso A: 35 minutos sin señal -> Alerta preventiva
    hace_35m = (ahora - timedelta(minutes=35)).isoformat()
    auto.gps_ultima_posicion = {"latitud": -33.4, "longitud": -70.6, "timestamp": hace_35m}
    db_session.commit()

    resp_35 = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/gps/posicion")
    assert resp_35.status_code == 200
    assert resp_35.json()["estado_senal"] == "alerta_sin_senal"
    assert "preventiva" in resp_35.json()["alerta"]

    # Caso B: 75 minutos sin señal -> Alerta crítica (+1h)
    hace_75m = (ahora - timedelta(minutes=75)).isoformat()
    auto.gps_ultima_posicion = {"latitud": -33.4, "longitud": -70.6, "timestamp": hace_75m}
    db_session.commit()

    resp_75 = auth_as(dueno).get(f"/api/v1/autos/{auto.id}/gps/posicion")
    assert resp_75.status_code == 200
    assert resp_75.json()["estado_senal"] == "alerta_critica"
    assert "crítica" in resp_75.json()["alerta"]

