"""
Panel de "invita y gana": GET /usuarios/me/programa-referidos devuelve el
código propio, el link para compartir y las estadísticas del bono (ver
app/features/auth/onboarding/referrals_service.py).
"""


def test_genera_codigo_y_link_si_no_tenia(usuario_factory, auth_as):
    user = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    assert user.codigo_referido is None

    resp = auth_as(user).get("/api/v1/usuarios/me/programa-referidos")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["codigo"]
    assert data["link"].endswith(f"/invitacion/{data['codigo']}")
    assert data["referidos_totales"] == 0
    assert data["bono_activado_alguna_vez"] is False
    # El bono "invitado" decae desde la fecha de registro propia, sin
    # importar si de verdad usó el código de alguien (ver
    # calcular_bono_invitado_pct) — recién registrado, siempre es el mayor.
    assert data["bono_origen"] == "invitado"


def test_cuenta_los_referidos_que_usaron_mi_codigo(usuario_factory, auth_as, db_session):
    referente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    auth_as(referente).get("/api/v1/usuarios/me")  # autorepara el código propio
    db_session.refresh(referente)
    codigo = referente.codigo_referido
    assert codigo

    invitado1 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    invitado2 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    for invitado in (invitado1, invitado2):
        resp = auth_as(invitado).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo})
        assert resp.status_code == 200, resp.text

    resp = auth_as(referente).get("/api/v1/usuarios/me/programa-referidos")
    assert resp.status_code == 200
    assert resp.json()["referidos_totales"] == 2


def test_bono_del_invitado_vigente_recien_registrado(usuario_factory, auth_as):
    invitado = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp = auth_as(invitado).get("/api/v1/usuarios/me/programa-referidos")
    assert resp.status_code == 200
    data = resp.json()
    # fecha_registro recién puesta por el factory: dentro del primer tramo.
    assert data["bono_pct_vigente"] > 0
    assert data["bono_origen"] == "invitado"
