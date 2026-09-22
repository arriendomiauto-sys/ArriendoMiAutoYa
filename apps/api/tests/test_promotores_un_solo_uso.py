"""
Tests para el sistema de Promotores con Códigos de Un Solo Uso:
- Creación de invitaciones a promotores por parte del Admin.
- Registro/canje del código: asignación de rol promotor.
- Un solo uso: el segundo usuario no puede usar el mismo código.
- Acceso exclusivo a programa de referidos para usuarios con rol promotor.
- Códigos de referido de un solo uso para promotores: una vez canjeado se renueva automáticamente.
"""
import pytest


def test_admin_crea_invitacion_promotor_y_no_admin_es_rechazado(usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    admin = usuario_factory(roles_activos=["admin"], estado_documentos="verificado")

    # Cliente regular no puede crear invitaciones a promotor (403)
    resp_cliente = auth_as(cliente).post(
        "/api/v1/admin/promotores/invitaciones",
        json={"nota": "Promotor Zona Norte"}
    )
    assert resp_cliente.status_code == 403

    # Admin crea invitación exitosamente
    resp_admin = auth_as(admin).post(
        "/api/v1/admin/promotores/invitaciones",
        json={"nota": "Promotor Santiago Centro"}
    )
    assert resp_admin.status_code == 200, resp_admin.text
    data = resp_admin.json()
    assert data["codigo"]
    assert data["tipo"] == "promotor"
    assert data["usado"] is False
    assert "/invitacion/" in data["link"]

    # Admin puede listar las invitaciones
    resp_list = auth_as(admin).get("/api/v1/admin/promotores/invitaciones")
    assert resp_list.status_code == 200
    items = resp_list.json()
    assert any(i["codigo"] == data["codigo"] for i in items)


def test_usuario_canjea_codigo_promotor_y_obtiene_rol(usuario_factory, auth_as, db_session):
    admin = usuario_factory(roles_activos=["admin"], estado_documentos="verificado")
    resp_admin = auth_as(admin).post(
        "/api/v1/admin/promotores/invitaciones",
        json={"nota": "Promotor Test"}
    )
    codigo_promotor = resp_admin.json()["codigo"]

    # Validar públicamente el código
    resp_val = auth_as(admin).get(f"/api/v1/usuarios/codigo-referido/{codigo_promotor}/validar")
    assert resp_val.status_code == 200
    val_data = resp_val.json()
    assert val_data["valido"] is True
    assert val_data["tipo"] == "promotor"
    assert val_data["usado"] is False

    # Usuario regular sin rol promotor no puede acceder al panel
    candidato = usuario_factory(roles_activos=["cliente"], es_promotor=False, estado_documentos="verificado")
    resp_panel_antes = auth_as(candidato).get("/api/v1/usuarios/me/programa-referidos")
    assert resp_panel_antes.status_code == 403

    # Canjea el código
    resp_canje = auth_as(candidato).put(
        "/api/v1/usuarios/me/codigo-referido",
        json={"codigo": codigo_promotor}
    )
    assert resp_canje.status_code == 200, resp_canje.text
    db_session.refresh(candidato)
    assert candidato.es_promotor is True
    assert "promotor" in (candidato.roles_activos or [])

    # Ahora sí tiene acceso al panel de promotor
    resp_panel_despues = auth_as(candidato).get("/api/v1/usuarios/me/programa-referidos")
    assert resp_panel_despues.status_code == 200
    assert resp_panel_despues.json()["es_promotor"] is True
    assert resp_panel_despues.json()["es_un_solo_uso"] is True


def test_codigo_promotor_es_de_un_solo_uso(usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"], estado_documentos="verificado")
    resp_admin = auth_as(admin).post("/api/v1/admin/promotores/invitaciones")
    codigo = resp_admin.json()["codigo"]

    user1 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    user2 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    # Primer canje exitoso
    resp1 = auth_as(user1).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo})
    assert resp1.status_code == 200

    # Segundo intento con el mismo código es rechazado
    resp2 = auth_as(user2).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo})
    assert resp2.status_code == 400
    assert "ya fue utilizado" in resp2.json()["detail"]

    # Validación pública indica que ya fue usado
    resp_val = auth_as(user2).get(f"/api/v1/usuarios/codigo-referido/{codigo}/validar")
    assert resp_val.status_code == 200
    assert resp_val.json()["valido"] is False
    assert resp_val.json()["usado"] is True


def test_promotor_genera_codigos_dinamicos_de_un_solo_uso(usuario_factory, auth_as, db_session):
    promotor = usuario_factory(roles_activos=["cliente", "promotor"], es_promotor=True, estado_documentos="verificado")

    # El promotor obtiene su primer código activo
    resp_panel1 = auth_as(promotor).get("/api/v1/usuarios/me/programa-referidos")
    assert resp_panel1.status_code == 200
    codigo1 = resp_panel1.json()["codigo"]
    assert codigo1

    # Un invitado usa el código 1
    invitado1 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp_inv1 = auth_as(invitado1).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo1})
    assert resp_inv1.status_code == 200
    db_session.refresh(invitado1)
    assert invitado1.referido_por_id == promotor.id

    # El código 1 ahora está quemado para terceros
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp_intruso = auth_as(intruso).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo1})
    assert resp_intruso.status_code == 400
    assert "ya fue utilizado" in resp_intruso.json()["detail"]

    # Al volver al panel, el promotor obtiene automáticamente un nuevo código fresco
    resp_panel2 = auth_as(promotor).get("/api/v1/usuarios/me/programa-referidos")
    assert resp_panel2.status_code == 200
    codigo2 = resp_panel2.json()["codigo"]
    assert codigo2 != codigo1
    assert resp_panel2.json()["referidos_totales"] == 1

    # Un segundo invitado puede usar el nuevo código 2
    invitado2 = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    resp_inv2 = auth_as(invitado2).put("/api/v1/usuarios/me/codigo-referido", json={"codigo": codigo2})
    assert resp_inv2.status_code == 200
    db_session.refresh(invitado2)
    assert invitado2.referido_por_id == promotor.id

    # Estadísticas se actualizan
    resp_panel3 = auth_as(promotor).get("/api/v1/usuarios/me/programa-referidos")
    assert resp_panel3.status_code == 200
    assert resp_panel3.json()["referidos_totales"] == 2
