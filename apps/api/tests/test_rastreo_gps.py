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
