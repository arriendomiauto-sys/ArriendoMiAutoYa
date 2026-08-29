"""
La cuenta ahora se crea "simple" (sin RUT ni documentos) y el enrolamiento
KYC queda diferido hasta que el usuario realmente necesita publicar un auto
o reservar uno. Estas pruebas cubren esos dos gates del lado del servidor
(la fuente de verdad real, no solo la UI) y el nuevo endpoint /autos/mios.
"""
from app.models.entities import Auto


def test_publicar_auto_sin_identidad_verificada_da_403(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["cliente"], estado_documentos="pendiente")
    resp = auth_as(dueno).post(
        "/api/v1/autos",
        json={
            "marca": "Toyota",
            "modelo": "Yaris",
            "anio": 2022,
            "patente": "VRFY-01",
            "tarifa_dia": 20000,
            "ubicacion_base": "Los Angeles",
        },
    )
    assert resp.status_code == 403
    assert "identidad" in resp.json()["detail"].lower()


_DOCS_AUTO = {
    "doc_inscripcion_url": "https://ejemplo.com/padron.jpg",
    "doc_permiso_circulacion_url": "https://ejemplo.com/permiso.jpg",
    "doc_soap_url": "https://ejemplo.com/soap.jpg",
    "doc_revision_tecnica_url": "https://ejemplo.com/revtec.jpg",
}


def test_publicar_auto_con_identidad_verificada_funciona(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos",
        json={
            "marca": "Toyota",
            "modelo": "Yaris",
            "anio": 2022,
            "patente": "VRFY-02",
            "tarifa_dia": 20000,
            "ubicacion_base": "Los Angeles",
            **_DOCS_AUTO,
        },
    )
    assert resp.status_code == 200, resp.text


def test_publicar_auto_sin_documentos_da_400(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp = auth_as(dueno).post(
        "/api/v1/autos",
        json={
            "marca": "Toyota",
            "modelo": "Yaris",
            "anio": 2022,
            "patente": "VRFD-01",
            "tarifa_dia": 20000,
            "ubicacion_base": "Los Angeles",
            "doc_inscripcion_url": "https://ejemplo.com/padron.jpg",
            # faltan permiso, soap y revisión técnica
        },
    )
    assert resp.status_code == 400
    detalle = resp.json()["detail"].lower()
    assert "permiso de circulaci" in detalle
    assert "soap" in detalle
    assert "revisi" in detalle


def test_reservar_sin_identidad_verificada_da_403(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2021,
        patente="VRFY-03", tarifa_dia=18000, estado="activo",
        ubicacion_base="Los Angeles",
    )
    db_session.add(auto)
    db_session.commit()

    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="pendiente")
    resp = auth_as(cliente).post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": "2026-09-01T10:00:00",
            "fecha_fin": "2026-09-03T10:00:00",
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )
    assert resp.status_code == 403
    assert "identidad" in resp.json()["detail"].lower()


def test_mis_autos_solo_devuelve_los_propios_y_todo_estado(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")
    otro_dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado")

    activo = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2021, patente="MIOS-01", tarifa_dia=18000, estado="activo", ubicacion_base="LA")
    pausado = Auto(dueno_id=dueno.id, marca="Kia", modelo="Soul", anio=2020, patente="MIOS-02", tarifa_dia=17000, estado="pausado", ubicacion_base="LA")
    ajeno = Auto(dueno_id=otro_dueno.id, marca="Kia", modelo="Sportage", anio=2022, patente="MIOS-03", tarifa_dia=25000, estado="activo", ubicacion_base="LA")
    db_session.add_all([activo, pausado, ajeno])
    db_session.commit()

    resp = auth_as(dueno).get("/api/v1/autos/mios")
    assert resp.status_code == 200
    patentes = {a["patente"] for a in resp.json()}
    assert patentes == {"MIOS-01", "MIOS-02"}


def test_mis_autos_sin_auth_da_401(client):
    resp = client.get("/api/v1/autos/mios")
    assert resp.status_code == 401


def test_actualizar_perfil_basico_no_requiere_kyc_previo(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"], estado_documentos="pendiente", rut=None)
    resp = auth_as(usuario).put(
        "/api/v1/usuarios/me/perfil-basico",
        json={"nombre": "Juan Cuenta Simple", "telefono": "+56911112222"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["nombre"] == "Juan Cuenta Simple"
    assert data["telefono"] == "+56911112222"
    # No toca nada relacionado a identidad/KYC.
    assert data["rut"] is None
    assert data["estado_documentos"] == "pendiente"
