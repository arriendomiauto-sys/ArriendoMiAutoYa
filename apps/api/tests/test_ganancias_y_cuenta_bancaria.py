"""
Ganancias reales del dueño (a partir de Pago tipo liquidacion_dueno) y
persistencia real de la cuenta bancaria de depósito.
"""
from app.models.entities import Pago, Usuario


def test_mis_ganancias_en_cero_sin_liquidaciones(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    data = resp.json()
    assert data["saldo_disponible_clp"] == 0
    assert data["total_pagado_clp"] == 0
    assert data["historial"] == []


def test_mis_ganancias_suma_solo_las_liquidaciones_propias(db_session, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    otro_dueno = usuario_factory(roles_activos=["dueno", "cliente"])

    db_session.add_all([
        Pago(usuario_id=dueno.id, tipo="liquidacion_dueno", monto=100000, estado="pendiente"),
        Pago(usuario_id=dueno.id, tipo="liquidacion_dueno", monto=50000, estado="pagado"),
        Pago(usuario_id=dueno.id, tipo="hold_reserva", monto=999999, estado="capturado"),  # no debe contar
        Pago(usuario_id=otro_dueno.id, tipo="liquidacion_dueno", monto=777777, estado="pendiente"),  # no es del dueno
    ])
    db_session.commit()

    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    data = resp.json()
    assert data["saldo_disponible_clp"] == 100000
    assert data["total_pagado_clp"] == 50000
    assert data["cantidad_liquidaciones"] == 2


def test_actualizar_cuenta_bancaria_persiste_y_valida_rut(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    c = auth_as(dueno)

    resp_invalido = c.put(
        "/api/v1/usuarios/me/cuenta-bancaria",
        json={"banco": "Banco Estado", "tipo_cuenta": "CuentaRUT", "numero": "123", "titular": "Test", "rut": "11.111.111-5"},
    )
    assert resp_invalido.status_code == 422

    resp = c.put(
        "/api/v1/usuarios/me/cuenta-bancaria",
        json={"banco": "Banco Estado", "tipo_cuenta": "CuentaRUT", "numero": "123", "titular": "Test", "rut": "17.123.456-5"},
    )
    assert resp.status_code == 200
    assert resp.json()["cuenta_bancaria"]["banco"] == "Banco Estado"

    resp_me = c.get("/api/v1/usuarios/me")
    assert resp_me.json()["cuenta_bancaria"]["numero"] == "123"
