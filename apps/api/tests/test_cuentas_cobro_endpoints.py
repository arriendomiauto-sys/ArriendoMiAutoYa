DATOS = {"banco": "BancoEstado", "tipo_cuenta": "CuentaRUT",
         "numero": "98765432", "titular": "Juan Perez", "rut": "11.111.111-1"}


def _dueno(usuario_factory):
    return usuario_factory(roles_activos=["arrendador"])


def test_alta_listado_y_predeterminada(client, usuario_factory, auth_as):
    u = _dueno(usuario_factory)
    r = auth_as(u).post("/api/v1/usuarios/me/cuentas-cobro", json=DATOS)
    assert r.status_code == 201
    assert r.json()["cuenta_cobro"]["predeterminada"] is True
    assert r.json()["cuenta_cobro"]["numero"] == "••••5432"

    r2 = auth_as(u).post("/api/v1/usuarios/me/cuentas-cobro",
                         json={**DATOS, "numero": "22223333"})
    id2 = r2.json()["cuenta_cobro"]["id"]

    lista = auth_as(u).get("/api/v1/usuarios/me/cuentas-cobro").json()["cuentas_cobro"]
    assert len(lista) == 2

    p = auth_as(u).patch(f"/api/v1/usuarios/me/cuentas-cobro/{id2}/predeterminada")
    assert p.status_code == 200 and p.json()["cuenta_cobro"]["predeterminada"] is True


def test_rut_invalido_422(client, usuario_factory, auth_as):
    u = _dueno(usuario_factory)
    r = auth_as(u).post("/api/v1/usuarios/me/cuentas-cobro",
                        json={**DATOS, "rut": "11.111.111-5"})
    assert r.status_code == 422


def test_no_puede_borrar_cuenta_ajena(client, usuario_factory, auth_as):
    a = _dueno(usuario_factory); b = _dueno(usuario_factory)
    cid = auth_as(a).post("/api/v1/usuarios/me/cuentas-cobro", json=DATOS).json()["cuenta_cobro"]["id"]
    r = auth_as(b).delete(f"/api/v1/usuarios/me/cuentas-cobro/{cid}")
    assert r.status_code == 404


def test_put_cuenta_bancaria_legacy_crea_predeterminada(client, usuario_factory, auth_as):
    u = _dueno(usuario_factory)
    r = auth_as(u).put("/api/v1/usuarios/me/cuenta-bancaria", json=DATOS)
    assert r.status_code == 200
    lista = auth_as(u).get("/api/v1/usuarios/me/cuentas-cobro").json()["cuentas_cobro"]
    assert len(lista) == 1 and lista[0]["predeterminada"] is True


def test_agregar_misma_cuenta_dos_veces_no_duplica(client, usuario_factory, auth_as):
    """
    Un reintento automático del cliente HTTP tras un timeout (la request sí
    había llegado y se guardó, solo se perdió la respuesta) no debe crear una
    segunda fila idéntica — a diferencia de antes, que no tenía ningún
    chequeo de duplicados acá.
    """
    u = _dueno(usuario_factory)
    r1 = auth_as(u).post("/api/v1/usuarios/me/cuentas-cobro", json=DATOS)
    assert r1.status_code == 201

    r2 = auth_as(u).post("/api/v1/usuarios/me/cuentas-cobro", json=DATOS)
    assert r2.status_code == 409
    assert r2.json()["detail"]["codigo"] == "CUENTA_DUPLICADA"

    lista = auth_as(u).get("/api/v1/usuarios/me/cuentas-cobro").json()["cuentas_cobro"]
    assert len(lista) == 1


def test_put_cuenta_bancaria_reintentado_no_duplica(client, usuario_factory, auth_as):
    """Mismo escenario que arriba pero contra el endpoint legacy PUT, que
    borra la predeterminada anterior antes de re-agregar — el reintento debe
    seguir dejando una sola cuenta, no reventar con un 500 sin manejar."""
    u = _dueno(usuario_factory)
    r1 = auth_as(u).put("/api/v1/usuarios/me/cuenta-bancaria", json=DATOS)
    assert r1.status_code == 200

    r2 = auth_as(u).put("/api/v1/usuarios/me/cuenta-bancaria", json=DATOS)
    assert r2.status_code == 200

    lista = auth_as(u).get("/api/v1/usuarios/me/cuentas-cobro").json()["cuentas_cobro"]
    assert len(lista) == 1
