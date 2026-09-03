"""
Pruebas de control de acceso (ownership) e IDOR en /autos y /reservas.
Cubre los fixes de la sesión: dueno_id/cliente_id del payload se ignoran
(siempre se usa el usuario autenticado), y un usuario no puede editar ni
ver recursos de otro.
"""

AUTO_BASE = {
    "marca": "Toyota",
    "modelo": "Yaris",
    "anio": 2022,
    "tarifa_dia": 20000,
    "ubicacion_base": "Los Angeles",
    "doc_inscripcion_url": "https://ejemplo.com/padron.jpg",
    "doc_permiso_circulacion_url": "https://ejemplo.com/permiso.jpg",
    "doc_soap_url": "https://ejemplo.com/soap.jpg",
    "doc_revision_tecnica_url": "https://ejemplo.com/revtec.jpg",
    "gps_consentimiento": True,
}


def _crear_auto(c, patente, **overrides):
    payload = {**AUTO_BASE, "patente": patente, **overrides}
    resp = c.post("/api/v1/autos", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_crear_auto_ignora_dueno_id_del_payload(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["cliente"])
    otro = usuario_factory(roles_activos=["cliente"])
    c = auth_as(owner)

    auto = _crear_auto(c, "TSTA-01", dueno_id=otro.id)

    assert auto["dueno_id"] == owner.id
    assert auto["dueno_id"] != otro.id


def test_crear_auto_sin_auth_da_401(client):
    resp = client.post("/api/v1/autos", json={**AUTO_BASE, "patente": "TSTA-02"})
    assert resp.status_code == 401


def test_patch_auto_de_otro_dueno_da_403(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    intruso = usuario_factory(roles_activos=["dueno"])

    auto = _crear_auto(auth_as(owner), "TSTA-03")

    resp = auth_as(intruso).patch(f"/api/v1/autos/{auto['id']}", json={"tarifa_dia": 1})
    assert resp.status_code == 403


def test_patch_auto_propio_funciona(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    c = auth_as(owner)
    auto = _crear_auto(c, "TSTA-04")

    resp = c.patch(f"/api/v1/autos/{auto['id']}", json={"tarifa_dia": 25000})
    assert resp.status_code == 200
    assert resp.json()["tarifa_dia"] == 25000


def test_crear_auto_persiste_equipamiento(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    auto = _crear_auto(
        auth_as(owner), "TSTA-06",
        equipamiento={"ac": True, "bluetooth": True, "isofix": False},
    )
    assert auto["equipamiento"] == {"ac": True, "bluetooth": True, "isofix": False}


def test_patch_auto_actualiza_equipamiento(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    c = auth_as(owner)
    auto = _crear_auto(c, "TSTA-07")
    assert auto["equipamiento"] == {}

    resp = c.patch(f"/api/v1/autos/{auto['id']}", json={"equipamiento": {"doble_traccion": True}})
    assert resp.status_code == 200
    assert resp.json()["equipamiento"] == {"doble_traccion": True}


def test_patch_auto_admin_puede_editar_de_cualquiera(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    admin = usuario_factory(roles_activos=["admin"])
    auto = _crear_auto(auth_as(owner), "TSTA-05")

    resp = auth_as(admin).patch(f"/api/v1/autos/{auto['id']}", json={"estado": "pausado"})
    assert resp.status_code == 200
    assert resp.json()["estado"] == "pausado"


def _crear_reserva(c, auto_id, **overrides):
    payload = {
        "auto_id": auto_id,
        "fecha_inicio": "2026-09-01T10:00:00",
        "fecha_fin": "2026-09-04T10:00:00",
        "lugar_entrega_acordado": "Plaza de Armas, Los Angeles",
        **overrides,
    }
    resp = c.post("/api/v1/reservas", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_crear_reserva_ignora_cliente_id_del_payload(usuario_factory, auth_as):
    owner = usuario_factory(roles_activos=["dueno"])
    auto = _crear_auto(auth_as(owner), "TSTR-01")

    cliente = usuario_factory(roles_activos=["cliente"])
    otro = usuario_factory(roles_activos=["cliente"])

    reserva = _crear_reserva(auth_as(cliente), auto["id"], cliente_id=otro.id)

    assert reserva["cliente_id"] == cliente.id
    assert reserva["cliente_id"] != otro.id


def test_reserva_de_otro_da_403_en_detalle_pdf_y_estado(usuario_factory, auth_as):
    # `auth_as` sobreescribe get_current_user en la app compartida por todo
    # el test: hay que invocarlo justo antes de cada request, no guardar un
    # cliente "ya autenticado como X" y reusarlo después de autenticar a
    # otro usuario — la última llamada a auth_as() gana para todos.
    owner = usuario_factory(roles_activos=["dueno"])
    cliente = usuario_factory(roles_activos=["cliente"])
    intruso = usuario_factory(roles_activos=["cliente"])

    auto = _crear_auto(auth_as(owner), "TSTR-02")
    reserva = _crear_reserva(auth_as(cliente), auto["id"])

    assert auth_as(intruso).get(f"/api/v1/reservas/{reserva['id']}").status_code == 403
    assert auth_as(intruso).get(f"/api/v1/reservas/{reserva['id']}/contrato-pdf").status_code == 403
    assert (
        auth_as(intruso)
        .patch(f"/api/v1/reservas/{reserva['id']}/estado", params={"nuevo_estado": "cancelada"})
        .status_code
        == 403
    )

    # El cliente de la reserva y el dueño del auto sí pueden ver el detalle
    assert auth_as(cliente).get(f"/api/v1/reservas/{reserva['id']}").status_code == 200
    assert auth_as(owner).get(f"/api/v1/reservas/{reserva['id']}").status_code == 200
    assert auth_as(owner).get(f"/api/v1/reservas/{reserva['id']}/contrato-pdf").status_code == 200


def test_reserva_sin_auth_da_401(client, db_session):
    from app.models.entities import Auto, Usuario
    import uuid

    dueno = Usuario(id=str(uuid.uuid4()), nombre="Dueño ORM", email="orm.dueno@test.cl", roles_activos=["dueno"])
    db_session.add(dueno)
    db_session.flush()
    auto = Auto(
        dueno_id=dueno.id, marca="Toyota", modelo="Yaris", anio=2022,
        patente="TSTR-03", tarifa_dia=20000, ubicacion_base="Los Angeles",
    )
    db_session.add(auto)
    db_session.commit()

    # Sin pasar por auth_as en absoluto: get_current_user sigue siendo la
    # dependencia real (no hay override activo), así que esto sí prueba el
    # camino sin autenticación de punta a punta.
    resp = client.post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": "2026-09-01T10:00:00",
            "fecha_fin": "2026-09-04T10:00:00",
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )
    assert resp.status_code == 401
