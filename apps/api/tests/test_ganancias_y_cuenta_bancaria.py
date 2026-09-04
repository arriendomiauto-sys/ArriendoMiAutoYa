"""
Ganancias reales del dueño (a partir de Pago tipo liquidacion_dueno) y
persistencia real de la cuenta bancaria de depósito.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, Pago, Reserva, Usuario


def test_mis_ganancias_en_cero_sin_liquidaciones(usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    data = resp.json()
    assert data["saldo_disponible_clp"] == 0
    assert data["total_pagado_clp"] == 0
    assert data["historial"] == []
    assert data["por_auto"] == []


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


def test_mis_ganancias_incluye_rendimiento_por_auto(db_session, usuario_factory, auth_as):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    cliente = usuario_factory(roles_activos=["cliente"])

    hace_30_dias = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    auto_top = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="RIOX12",
        tarifa_dia=30000, ubicacion_base="Los Ángeles", estado="activo",
        fecha_publicacion=hace_30_dias,
    )
    auto_sin_uso = Auto(
        dueno_id=dueno.id, marca="Suzuki", modelo="Alto", anio=2020, patente="ALTO34",
        tarifa_dia=20000, ubicacion_base="Los Ángeles", estado="activo",
        fecha_publicacion=hace_30_dias,
    )
    db_session.add_all([auto_top, auto_sin_uso])
    db_session.commit()

    inicio = hace_30_dias + timedelta(days=5)
    reserva = Reserva(
        auto_id=auto_top.id, cliente_id=cliente.id, fecha_inicio=inicio,
        fecha_fin=inicio + timedelta(days=6), estado="finalizada",
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)

    db_session.add(Pago(usuario_id=dueno.id, reserva_id=reserva.id, tipo="liquidacion_dueno", monto=144000, estado="pagado"))
    db_session.commit()

    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    por_auto = {a["auto_id"]: a for a in resp.json()["por_auto"]}

    assert por_auto[auto_top.id]["ganancia_total_clp"] == 144000
    assert por_auto[auto_top.id]["reservas_finalizadas"] == 1
    assert por_auto[auto_top.id]["dias_arrendado"] == 6
    # 6 días arrendado de 30 publicados ~ 20%.
    assert 18 <= por_auto[auto_top.id]["tasa_ocupacion_pct"] <= 22

    assert por_auto[auto_sin_uso.id]["ganancia_total_clp"] == 0
    assert por_auto[auto_sin_uso.id]["tasa_ocupacion_pct"] == 0

    # El de mayor ganancia va primero.
    assert resp.json()["por_auto"][0]["auto_id"] == auto_top.id


def test_mis_ganancias_flota_con_reserva_finalizada_sin_pago_registrado(db_session, usuario_factory, auth_as):
    """
    Una reserva puede quedar "finalizada" sin que su liquidación ya se haya
    registrado (p.ej. proceso manual, o el Pago se crea en un paso
    posterior). El auto debe seguir contando el arriendo y los días
    ocupados aunque su ganancia acumulada en pagos sea 0 — no debe
    desaparecer de la lista ni reventar.
    """
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    cliente = usuario_factory(roles_activos=["cliente"])

    auto = Auto(
        dueno_id=dueno.id, marca="Nissan", modelo="Versa", anio=2021, patente="VERS12",
        tarifa_dia=25000, ubicacion_base="Los Ángeles", estado="activo",
        fecha_publicacion=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=10),
    )
    db_session.add(auto)
    db_session.commit()

    inicio = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=5)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id, fecha_inicio=inicio,
        fecha_fin=inicio + timedelta(days=2), estado="finalizada",
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    # A propósito: no se crea ningún Pago liquidacion_dueno para esta reserva.

    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    fila = next(a for a in resp.json()["por_auto"] if a["auto_id"] == auto.id)
    assert fila["ganancia_total_clp"] == 0
    assert fila["reservas_finalizadas"] == 1
    assert fila["dias_arrendado"] == 2
    assert fila["tasa_ocupacion_pct"] > 0


def test_mis_ganancias_flota_con_fecha_publicacion_nula_no_revienta(db_session, usuario_factory, auth_as):
    """Filas de antes de que existiera la columna fecha_publicacion pueden
    traer NULL (ver schema_sync) — no debe romper el cálculo de ocupación."""
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    auto = Auto(
        dueno_id=dueno.id, marca="Chevrolet", modelo="Sail", anio=2019, patente="SAIL12",
        tarifa_dia=18000, ubicacion_base="Los Ángeles", estado="activo",
        fecha_publicacion=None,
    )
    db_session.add(auto)
    db_session.commit()

    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    assert resp.status_code == 200
    fila = next(a for a in resp.json()["por_auto"] if a["auto_id"] == auto.id)
    assert fila["tasa_ocupacion_pct"] == 0
    assert fila["ganancia_total_clp"] == 0


def test_mis_ganancias_flota_no_cuenta_liquidaciones_falladas_o_reembolsadas(db_session, usuario_factory, auth_as):
    """Mismo criterio que saldo_disponible_clp/total_pagado_clp: una
    liquidación fallida o reembolsada no es plata que el auto generó."""
    dueno = usuario_factory(roles_activos=["dueno", "cliente"])
    cliente = usuario_factory(roles_activos=["cliente"])

    auto = Auto(
        dueno_id=dueno.id, marca="Toyota", modelo="Yaris", anio=2020, patente="YARI12",
        tarifa_dia=22000, ubicacion_base="Los Ángeles", estado="activo",
    )
    db_session.add(auto)
    db_session.commit()

    inicio = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=10)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id, fecha_inicio=inicio,
        fecha_fin=inicio + timedelta(days=2), estado="finalizada",
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)

    db_session.add_all([
        Pago(usuario_id=dueno.id, reserva_id=reserva.id, tipo="liquidacion_dueno", monto=999999, estado="fallido"),
        Pago(usuario_id=dueno.id, reserva_id=reserva.id, tipo="liquidacion_dueno", monto=888888, estado="reembolsado"),
        Pago(usuario_id=dueno.id, reserva_id=reserva.id, tipo="liquidacion_dueno", monto=50000, estado="pendiente"),
    ])
    db_session.commit()

    resp = auth_as(dueno).get("/api/v1/pagos/mis-ganancias")
    fila = next(a for a in resp.json()["por_auto"] if a["auto_id"] == auto.id)
    assert fila["ganancia_total_clp"] == 50000


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
