"""
Árbol de decisión de licencias extranjeras y edad mínima.

Reglas cubiertas: Convenio de Viena 1968, Permiso Internacional de Conducir
(PIC), residencia continua mayor a un año, homologación España/Perú/Corea,
vigencia hasta el término del arriendo y edad mínima de la plataforma.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, ConfiguracionPlataforma
from app.services.licencias import evaluar_licencia

AHORA = datetime(2026, 9, 2)
FIN_ARRIENDO = AHORA + timedelta(days=5)


def test_pais_del_convenio_de_viena_no_necesita_pic():
    res = evaluar_licencia(
        pais_licencia="ES",
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is True
    assert res["requiere_pic"] is False


def test_pais_fuera_del_convenio_sin_pic_se_rechaza():
    # Colombia firmó pero no ratificó: en la práctica se le exige PIC.
    res = evaluar_licencia(
        pais_licencia="CO",
        tiene_pic=False,
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["requiere_pic"] is True
    assert "Permiso Internacional" in res["motivo"]


def test_pais_fuera_del_convenio_con_pic_vigente_se_permite():
    res = evaluar_licencia(
        pais_licencia="VE",
        tiene_pic=True,
        pic_vencimiento=AHORA + timedelta(days=200),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is True
    assert res["requiere_pic"] is True


def test_pic_que_vence_durante_el_arriendo_se_rechaza():
    res = evaluar_licencia(
        pais_licencia="CO",
        tiene_pic=True,
        pic_vencimiento=AHORA + timedelta(days=2),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["vence_durante_arriendo"] is True


def test_residente_hace_mas_de_un_ano_necesita_licencia_chilena():
    res = evaluar_licencia(
        pais_licencia="AR",
        es_residente=True,
        fecha_inicio_residencia=AHORA - timedelta(days=400),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["requiere_licencia_chilena"] is True


def test_residente_reciente_de_pais_del_convenio_puede_conducir():
    res = evaluar_licencia(
        pais_licencia="BR",
        es_residente=True,
        fecha_inicio_residencia=AHORA - timedelta(days=90),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is True


def test_residente_con_homologacion_recibe_el_aviso_de_canje():
    res = evaluar_licencia(
        pais_licencia="PE",
        es_residente=True,
        fecha_inicio_residencia=AHORA - timedelta(days=800),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["requiere_licencia_chilena"] is True
    assert "canjearla" in res["motivo"]


def test_licencia_que_vence_antes_del_termino_del_arriendo_se_rechaza():
    res = evaluar_licencia(
        pais_licencia="CL",
        licencia_vencimiento=AHORA + timedelta(days=1),
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["vence_durante_arriendo"] is True


def test_menor_de_la_edad_minima_se_rechaza():
    res = evaluar_licencia(
        pais_licencia="CL",
        fecha_nacimiento=AHORA - timedelta(days=365 * 19),
        fecha_fin_reserva=FIN_ARRIENDO,
        edad_minima=21,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert "21 años" in res["motivo"]


def test_pais_desconocido_va_a_revision_manual():
    res = evaluar_licencia(
        pais_licencia="XX",
        fecha_fin_reserva=FIN_ARRIENDO,
        ahora=AHORA,
    )
    assert res["permitido"] is False
    assert res["revision_manual"] is True


# ==============================================================================
# Aplicación en el flujo de reservas
# ==============================================================================
def _auto_publicado(db_session, dueno, patente="LICX-01"):
    auto = Auto(
        dueno_id=dueno.id,
        marca="Hyundai",
        modelo="Tucson",
        anio=2022,
        patente=patente,
        tarifa_dia=35000,
        ubicacion_base="Av. Alemania, Los Ángeles",
        estado="activo",
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
    return auto


def _payload_reserva(auto, dias=3):
    inicio = datetime.now(timezone.utc) + timedelta(days=2)
    return {
        "auto_id": auto.id,
        "fecha_inicio": inicio.isoformat(),
        "fecha_fin": (inicio + timedelta(days=dias)).isoformat(),
        "lugar_entrega_acordado": "Plaza de Armas, Los Ángeles",
    }


def test_reserva_bloqueada_si_el_pic_vence_durante_el_arriendo(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto_publicado(db_session, dueno)

    cliente = usuario_factory(roles_activos=["cliente"])
    cliente.tipo_documento = "pasaporte"
    cliente.numero_documento = "AB1234567"
    cliente.pais_documento = "CO"
    cliente.licencia_pais_emisor = "CO"
    cliente.pic_url = "https://ejemplo.com/pic.jpg"
    cliente.pic_vencimiento = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3)
    db_session.commit()

    resp = auth_as(cliente).post("/api/v1/reservas", json=_payload_reserva(auto))
    assert resp.status_code == 400
    assert "Permiso Internacional" in resp.json()["detail"]


def test_reserva_bloqueada_por_edad_minima_configurada(usuario_factory, auth_as, db_session):
    config = db_session.query(ConfiguracionPlataforma).first()
    config.edad_minima_arriendo = 25
    db_session.commit()

    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto_publicado(db_session, dueno, patente="LICX-02")

    cliente = usuario_factory(roles_activos=["cliente"], rut="16.123.456-2")
    cliente.fecha_nacimiento = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=365 * 22)
    db_session.commit()

    resp = auth_as(cliente).post("/api/v1/reservas", json=_payload_reserva(auto))
    assert resp.status_code == 400
    assert "25 años" in resp.json()["detail"]


def test_cliente_extranjero_del_convenio_puede_reservar(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto_publicado(db_session, dueno, patente="LICX-03")

    cliente = usuario_factory(roles_activos=["cliente"])
    cliente.tipo_documento = "pasaporte"
    cliente.numero_documento = "ESP998877"
    cliente.pais_documento = "ES"
    cliente.licencia_pais_emisor = "ES"
    cliente.licencia_vencimiento = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=900)
    db_session.commit()

    resp = auth_as(cliente).post("/api/v1/reservas", json=_payload_reserva(auto))
    assert resp.status_code == 200, resp.text


def test_cuenta_antigua_sin_datos_de_licencia_sigue_reservando(usuario_factory, auth_as, db_session):
    """Las cuentas verificadas antes de este flujo no se bloquean retroactivamente."""
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto_publicado(db_session, dueno, patente="LICX-04")
    cliente = usuario_factory(roles_activos=["cliente"], rut="17.345.678-1")

    resp = auth_as(cliente).post("/api/v1/reservas", json=_payload_reserva(auto))
    assert resp.status_code == 200, resp.text
