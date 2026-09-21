"""El estado de antecedentes es visible: la app del usuario lo conoce y el admin lo ve en su listado."""


def test_el_perfil_del_usuario_trae_su_estado_de_antecedentes(auth_as, usuario_factory, db_session):
    usuario = usuario_factory(roles_activos=["cliente"])
    usuario.antecedentes_estado = "pendiente"
    db_session.commit()

    resp = auth_as(usuario).get("/api/v1/usuarios/me")

    assert resp.status_code == 200
    assert resp.json()["antecedentes_estado"] == "pendiente"


def test_el_listado_de_admin_muestra_el_estado_de_antecedentes(auth_as, usuario_factory, db_session):
    admin = usuario_factory(roles_activos=["admin"])
    usuario = usuario_factory(roles_activos=["cliente"])
    usuario.antecedentes_estado = "bloqueado"
    db_session.commit()

    filas = auth_as(admin).get("/api/v1/admin/usuarios").json()
    fila = next(f for f in (filas["items"] if isinstance(filas, dict) else filas) if f["id"] == usuario.id)

    assert fila["antecedentes_estado"] == "bloqueado"
