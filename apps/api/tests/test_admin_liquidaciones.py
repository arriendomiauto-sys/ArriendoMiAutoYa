"""
Panel de Finanzas — `GET /admin/liquidaciones` (agrupado por dueño) y
`POST /admin/liquidaciones/{dueno_id}/pagar` (marcado manual con rastro,
sin pisar el depósito automático).
"""
from datetime import datetime, timedelta

import pytest

from app.models.entities import Pago, Reserva, Usuario


def _liq(db, dueno_id, monto, estado="pendiente", reserva_id=None):
    p = Pago(
        usuario_id=dueno_id, tipo="liquidacion_dueno",
        monto=monto, estado=estado, reserva_id=reserva_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _reserva_con_compensaciones(db, dueno):
    """Una reserva finalizada con $10.000 de compensaciones (limpieza + adicionales)."""
    cliente = db.query(Usuario).filter(Usuario.id != dueno.id).first()
    auto = db.query(Reserva).first().auto if db.query(Reserva).first() else None
    from app.models.entities import Auto
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2021, patente="LIQ-99",
        tarifa_dia=30000, estado="activo", ubicacion_base="Los Ángeles",
    )
    db.add(auto)
    db.commit()
    inicio = datetime.utcnow() - timedelta(days=10)
    r = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=4),
        estado="finalizada", lugar_entrega_acordado="Plaza",
        cargo_limpieza_clp=4000, cargos_adicionales_clp=6000,
    )
    db.add(r)
    db.commit()
    return r


# ---------------------------------------------------------------- GET (Task B)

def test_get_agrupa_por_dueno_con_cuenta_legible(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d1 = usuario_factory(roles_activos=["arrendador"], nombre="Ana Díaz")
    d1.rut = "11.111.111-1"
    d1.cuenta_bancaria = {
        "banco": "Banco de Chile", "tipo_cuenta": "Cuenta Corriente",
        "numero": "1234567", "titular": "Ana Díaz", "rut": "11.111.111-1",
    }
    db_session.commit()
    _liq(db_session, d1.id, 100000, "pendiente")
    _liq(db_session, d1.id, 50000, "pagado")

    r = auth_as(admin).get("/api/v1/admin/liquidaciones")
    assert r.status_code == 200
    filas = r.json()
    mia = next(f for f in filas if f["id"] == d1.id)
    assert mia["dueno_nombre"] == "Ana Díaz"
    assert mia["dueno_rut"] == "11.111.111-1"
    assert mia["cuenta_bancaria"] == "Banco de Chile · Cuenta Corriente"
    assert mia["neto_clp"] == 150000          # suma de las 2
    assert mia["bruto_clp"] >= mia["neto_clp"]
    assert mia["comision_clp"] == mia["bruto_clp"] - mia["neto_clp"]
    assert mia["estado"] == "pendiente"       # una sigue pendiente
    assert mia["pagada_en"] is None


def test_get_estado_pagada_y_pagada_en(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    p = _liq(db_session, d.id, 80000, "pagado")
    p.liquidado_en = datetime(2026, 9, 1, 12, 0, 0)
    db_session.commit()

    fila = next(f for f in auth_as(admin).get("/api/v1/admin/liquidaciones").json() if f["id"] == d.id)
    assert fila["estado"] == "pagada"
    assert fila["pagada_en"].startswith("2026-09-01")


def test_get_comision_descuenta_compensaciones(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    r = _reserva_con_compensaciones(db_session, d)
    # monto = base_dueno (24000) + compensaciones (10000)
    _liq(db_session, d.id, 34000, "pendiente", reserva_id=r.id)

    fila = next(f for f in auth_as(admin).get("/api/v1/admin/liquidaciones").json() if f["id"] == d.id)
    # comisión solo sobre la base: 24000 base -> subtotal 30000 -> comisión 6000
    assert fila["neto_clp"] == 34000
    assert fila["comision_clp"] == 6000
    assert fila["bruto_clp"] == 40000
    assert fila["reservas_count"] == 1


def test_get_requiere_admin(client, usuario_factory, auth_as):
    assert auth_as(usuario_factory(roles_activos=["arrendador"])).get("/api/v1/admin/liquidaciones").status_code == 403


# ---------------------------------------------------------------- PAGAR (Task A)

def test_pagar_marca_pendientes_con_rastro(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    p1 = _liq(db_session, d.id, 40000, "pendiente")
    p2 = _liq(db_session, d.id, 20000, "fallido")

    r = auth_as(admin).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar")
    assert r.status_code == 200
    assert r.json()["estado"] == "pagada"

    db_session.expire_all()
    for p in (db_session.get(Pago, p1.id), db_session.get(Pago, p2.id)):
        assert p.estado == "pagado"
        assert p.liquidado_en is not None
        assert p.referencia_pago.startswith("MANUAL-ADMIN-")


def test_pagar_no_repisa_una_pagada(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    p = _liq(db_session, d.id, 40000, "pagado")
    p.referencia_pago = "BCI-MOCK-ABC123"
    p.liquidado_en = datetime(2026, 8, 1)
    db_session.commit()

    r = auth_as(admin).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar")
    assert r.status_code == 409

    db_session.expire_all()
    p = db_session.get(Pago, p.id)
    assert p.referencia_pago == "BCI-MOCK-ABC123"          # intacta
    assert p.liquidado_en == datetime(2026, 8, 1)


def test_pagar_no_pisa_una_procesando(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    proc = _liq(db_session, d.id, 40000, "procesando")
    proc.procesando_desde = datetime.utcnow()
    db_session.commit()

    # solo hay una 'procesando' -> nada por pagar a mano
    assert auth_as(admin).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar").status_code == 409
    db_session.expire_all()
    assert db_session.get(Pago, proc.id).estado == "procesando"

    # con una 'pendiente' además: se paga esa y la 'procesando' queda como está
    pend = _liq(db_session, d.id, 10000, "pendiente")
    r = auth_as(admin).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar")
    assert r.status_code == 200
    db_session.expire_all()
    assert db_session.get(Pago, pend.id).estado == "pagado"
    assert db_session.get(Pago, proc.id).estado == "procesando"


def test_pagar_dueno_sin_liquidaciones_404(client, db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    d = usuario_factory(roles_activos=["arrendador"])
    assert auth_as(admin).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar").status_code == 404


def test_pagar_requiere_admin(client, db_session, usuario_factory, auth_as):
    d = usuario_factory(roles_activos=["arrendador"])
    _liq(db_session, d.id, 40000, "pendiente")
    assert auth_as(d).post(f"/api/v1/admin/liquidaciones/{d.id}/pagar").status_code == 403
