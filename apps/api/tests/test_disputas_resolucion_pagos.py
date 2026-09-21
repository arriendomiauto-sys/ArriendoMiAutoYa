import pytest
from datetime import datetime, timezone
from app.models.entities import Disputa, Reserva, Usuario, Pago, Auto
from app.features.payments import checkout_service

def _setup_reserva_con_pagos(db, cliente, dueno, monto_arriendo=100000, monto_garantia=250000, cargo_pendiente=50000):
    auto = Auto(
        patente="TEST99", marca="Toyota", modelo="Yaris", anio=2023,
        categoria="economico", dueno_id=dueno.id, tarifa_dia=35000,
        ubicacion_base="Santiago", estado="activo",
    )
    db.add(auto)
    db.flush()

    reserva = Reserva(
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=datetime.now(timezone.utc).replace(tzinfo=None),
        fecha_fin=datetime.now(timezone.utc).replace(tzinfo=None),
        estado="disputada",
        lugar_entrega_acordado="Metro Los Leones, Providencia",
        monto_cobro=monto_arriendo,
        monto_hold=monto_garantia,
    )
    db.add(reserva)
    db.flush()

    # Pago de arriendo capturado
    p_arriendo = Pago(
        reserva_id=reserva.id,
        usuario_id=cliente.id,
        tipo="cobro_arriendo",
        monto=monto_arriendo,
        estado="capturado",
        referencia_pago="SIMULADO-ARRIENDO-001",
    )
    db.add(p_arriendo)

    # Garantía retenida
    p_garantia = Pago(
        reserva_id=reserva.id,
        usuario_id=cliente.id,
        tipo="hold_reserva",
        monto=monto_garantia,
        estado="retenido",
        referencia_pago="SIMULADO-HOLD-001",
    )
    db.add(p_garantia)

    # Cargo pendiente (si se pide)
    if cargo_pendiente > 0:
        p_cargo = Pago(
            reserva_id=reserva.id,
            usuario_id=cliente.id,
            tipo="cargo_dano",
            monto=cargo_pendiente,
            estado="pendiente",
        )
        db.add(p_cargo)

    # Liquidación pendiente al dueño
    p_liq = Pago(
        reserva_id=reserva.id,
        usuario_id=dueno.id,
        tipo="liquidacion_dueno",
        monto=85000,
        estado="pendiente",
    )
    db.add(p_liq)

    db.commit()
    db.refresh(reserva)
    return reserva, auto


def test_resolver_disputa_reembolso_total(db_session, usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    admin = usuario_factory(roles_activos=["admin"])
    reserva, _ = _setup_reserva_con_pagos(db_session, cliente, dueno)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="dano",
        estado="abierta",
        motivo="El vehículo presentaba fallas previas no declaradas",
    )
    db_session.add(disputa)
    db_session.commit()

    resp = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "reembolso_total", "resolucion": "Falla mecánica preexistente acreditada."},
    )
    assert resp.status_code == 200
    db_session.refresh(reserva)
    db_session.refresh(disputa)

    assert disputa.estado == "resuelta"
    assert reserva.estado == "cancelada"

    # Pagos de la reserva
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    p_arriendo = next(p for p in pagos if p.tipo == "cobro_arriendo")
    p_garantia = next(p for p in pagos if p.tipo == "hold_reserva")
    p_liq = next(p for p in pagos if p.tipo == "liquidacion_dueno")
    p_cargo = next(p for p in pagos if p.tipo == "cargo_dano")

    assert p_arriendo.estado == "reembolsado"
    assert p_garantia.estado == "liberado"
    assert p_liq.estado == "cancelado"
    assert p_cargo.estado == "cancelado"


def test_resolver_disputa_sin_cobro(db_session, usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    admin = usuario_factory(roles_activos=["admin"])
    reserva, _ = _setup_reserva_con_pagos(db_session, cliente, dueno, cargo_pendiente=40000)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="dano",
        estado="abierta",
        motivo="Desacuerdo en rasguño menor",
    )
    db_session.add(disputa)
    db_session.commit()

    resp = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "sin_cobro", "resolucion": "Desgaste natural de uso, no imputable."},
    )
    assert resp.status_code == 200
    db_session.refresh(reserva)

    assert reserva.estado == "finalizada"
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    p_garantia = next(p for p in pagos if p.tipo == "hold_reserva")
    p_cargo = next(p for p in pagos if p.tipo == "cargo_dano")
    p_liq = next(p for p in pagos if p.tipo == "liquidacion_dueno")

    assert p_garantia.estado == "liberado"
    assert p_cargo.estado == "cancelado"
    # La liquidación original del arriendo sigue pendiente para pago
    assert p_liq.estado == "pendiente"


def test_resolver_disputa_cobro_cliente(db_session, usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    admin = usuario_factory(roles_activos=["admin"])
    reserva, _ = _setup_reserva_con_pagos(db_session, cliente, dueno, cargo_pendiente=60000)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="dano",
        estado="abierta",
        motivo="Abolladura en parachoques trasero",
    )
    db_session.add(disputa)
    db_session.commit()

    resp = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "cobro_cliente", "resolucion": "Daño verificado contra fotografías de entrega."},
    )
    assert resp.status_code == 200
    db_session.refresh(reserva)

    assert reserva.estado == "finalizada"
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    p_garantia = next(p for p in pagos if p.tipo == "hold_reserva")
    p_cargo = next(p for p in pagos if p.tipo == "cargo_dano")
    p_liq = next(p for p in pagos if p.tipo == "liquidacion_dueno")

    assert p_garantia.estado == "capturado"
    assert p_garantia.monto == 60000
    assert p_cargo.estado == "capturado"
    # Al dueño se le suman los 60.000 capturados: 85.000 + 60.000 = 145.000
    assert p_liq.monto == 145000
    assert p_liq.estado == "pendiente"


def test_resolver_disputa_division_50_50(db_session, usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    admin = usuario_factory(roles_activos=["admin"])
    # Garantía de 200.000, cargo de 100.000 en disputa
    reserva, _ = _setup_reserva_con_pagos(db_session, cliente, dueno, monto_garantia=200000, cargo_pendiente=100000)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="dano",
        estado="abierta",
        motivo="Daño dudoso, no atribuible a una sola parte",
    )
    db_session.add(disputa)
    db_session.commit()

    resp = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "division_deducible_50_50", "resolucion": "Acuerdo salomónico 50/50."},
    )
    assert resp.status_code == 200
    db_session.refresh(reserva)

    assert reserva.estado == "finalizada"
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    p_garantia = next(p for p in pagos if p.tipo == "hold_reserva")
    p_liq = next(p for p in pagos if p.tipo == "liquidacion_dueno")

    # Se capturan 50.000 (el 50% de 100.000) de la garantía
    assert p_garantia.estado == "capturado"
    assert p_garantia.monto == 50000
    assert p_liq.monto == 85000 + 50000


def test_no_permite_resolver_dos_veces(db_session, usuario_factory, auth_as):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    admin = usuario_factory(roles_activos=["admin"])
    reserva, _ = _setup_reserva_con_pagos(db_session, cliente, dueno)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="limpieza",
        estado="abierta",
        motivo="Disputa ya existente",
    )
    db_session.add(disputa)
    db_session.commit()

    r1 = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "sin_cobro", "resolucion": "Primera resolución."},
    )
    assert r1.status_code == 200

    r2 = auth_as(admin).post(
        f"/api/v1/disputas/{disputa.id}/resolver",
        json={"accion_pago": "reembolso_total", "resolucion": "Intento duplicado."},
    )
    assert r2.status_code == 400
    assert "ya se encuentra resuelta" in r2.json()["detail"]
