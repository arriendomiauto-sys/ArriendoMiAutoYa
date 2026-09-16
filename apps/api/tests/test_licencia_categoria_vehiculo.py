"""
Cruce clase de licencia ↔ categoría del vehículo al crear una reserva
(reservations/router.py::crear_reserva). Confirmado con el cliente: las 5
categorías actuales (economico/sedan/suv/camioneta/premium) exigen Clase B
sin excepción — normativa chilena: B habilita particulares hasta 3.500 kg de
peso bruto vehicular. Solo aplica a licencias chilenas; las extranjeras las
gobierna evaluar_licencia_usuario (Convenio de Viena, PIC, homologación), que
no tiene un concepto de "clase" equivalente.
"""
from app.models.entities import Auto


def _auto(db_session, dueno, **kw):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022,
        patente=kw.get("patente", "LICE-01"), tarifa_dia=kw.get("tarifa_dia", 20000),
        estado="activo", ubicacion_base="Los Ángeles",
        categoria=kw.get("categoria", "economico"),
    )
    db_session.add(auto)
    db_session.commit()
    return auto


def _crear_reserva(auth_as, cliente, auto):
    return auth_as(cliente).post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": "2027-01-05T10:00:00",
            "fecha_fin": "2027-01-08T10:00:00",
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )


def test_licencia_clase_b_reserva_cualquier_categoria(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(licencia_clase="B")
    auto = _auto(db_session, dueno, categoria="camioneta", patente="LICE-02")

    resp = _crear_reserva(auth_as, cliente, auto)
    assert resp.status_code == 200, resp.text


def test_licencia_clase_no_b_rechaza_con_400(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    # Licencia solo profesional (A2, taxis): no habilita el auto particular.
    cliente = usuario_factory(licencia_clase="A2")
    auto = _auto(db_session, dueno, categoria="suv", patente="LICE-03")

    resp = _crear_reserva(auth_as, cliente, auto)
    assert resp.status_code == 400
    assert "clase B" in resp.json()["detail"]


def test_licencia_sin_clase_registrada_rechaza_con_400(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(licencia_clase=None)
    auto = _auto(db_session, dueno, categoria="sedan", patente="LICE-04")

    resp = _crear_reserva(auth_as, cliente, auto)
    assert resp.status_code == 400
    assert "no registrada" in resp.json()["detail"]


def test_licencia_extranjera_no_se_valida_por_clase(usuario_factory, auth_as, db_session):
    """
    El cruce clase↔categoría es una taxonomía chilena; para un renter con
    licencia extranjera (que no trae "clase B" en su documento) el gate
    correspondiente es evaluar_licencia_usuario, no este.
    """
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(
        licencia_clase=None,
        licencia_pais_emisor="ES",  # convenio de Viena, no requiere PIC
    )
    auto = _auto(db_session, dueno, categoria="premium", patente="LICE-05")

    resp = _crear_reserva(auth_as, cliente, auto)
    assert resp.status_code == 200, resp.text


def test_auto_sin_categoria_no_bloquea_la_reserva(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(licencia_clase=None)
    auto = _auto(db_session, dueno, categoria=None, patente="LICE-06")

    resp = _crear_reserva(auth_as, cliente, auto)
    assert resp.status_code == 200, resp.text
