import pytest
from app.core.config import settings
from app.features.payments import liquidaciones_service as liq
from app.features.payments import cuentas_cobro_service as cc
from app.models.entities import Notificacion, Pago, Usuario, Reserva, Auto
from datetime import datetime, timezone

@pytest.fixture
def bci_on(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)


def _dueno_con_cuenta(db, numero="12345678"):
    u = db.query(Usuario).first()
    u.cuenta_bancaria = None
    db.commit()
    cc.agregar(db, u, banco="BancoEstado", tipo_cuenta="CuentaRUT",
               numero=numero, titular=u.nombre or "X", rut="11.111.111-1")
    return u


def _multa(db, usuario, monto=30000, estado="pendiente"):
    p = Pago(usuario_id=usuario.id, tipo="multa_dueno", monto=monto, estado=estado)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _liquidacion(db, usuario, monto=100000, estado="pendiente"):
    p = Pago(usuario_id=usuario.id, tipo="liquidacion_dueno", monto=monto, estado=estado)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def test_compensacion_parcial_multa_en_barrido(db_session, bci_on):
    """
    Dueño tiene liquidación de $100.000 y una multa pendiente de $30.000.
    La multa debe quedar 'pagado', y la liquidación debe transferir $70.000 neto vía BCI.
    """
    u = _dueno_con_cuenta(db_session)
    multa = _multa(db_session, u, monto=30000)
    liq_pago = _liquidacion(db_session, u, monto=100000)

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(multa)
    db_session.refresh(liq_pago)

    assert resumen["pagadas"] == 1
    # La multa quedó pagada con referencia a la liquidación
    assert multa.estado == "pagado"
    assert multa.referencia_pago.startswith(f"COMPENSADO-LIQ-{liq_pago.id[:8]}")

    # La liquidación quedó pagada
    assert liq_pago.estado == "pagado"
    assert liq_pago.referencia_pago.startswith("BCI-MOCK-")

    # Notificación al dueño menciona la compensación
    notis = (
        db_session.query(Notificacion)
        .filter(Notificacion.usuario_id == u.id, Notificacion.tipo == "pago")
        .all()
    )
    assert any("compensaron $30.000 CLP por multas" in n.mensaje for n in notis)


def test_compensacion_total_sin_transferencia_bci(db_session, bci_on):
    """
    Dueño tiene liquidación de $30.000 y una multa pendiente de $30.000.
    Se compensa el 100%, no se llama a BCI y la liquidación queda pagada con referencia de compensación.
    """
    u = _dueno_con_cuenta(db_session)
    multa = _multa(db_session, u, monto=30000)
    liq_pago = _liquidacion(db_session, u, monto=30000)

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(multa)
    db_session.refresh(liq_pago)

    assert resumen["pagadas"] == 1
    assert multa.estado == "pagado"
    assert multa.referencia_pago.startswith(f"COMPENSADO-LIQ-{liq_pago.id[:8]}")

    assert liq_pago.estado == "pagado"
    assert liq_pago.referencia_pago.startswith(f"COMPENSACION-MULTAS-{liq_pago.id[:8]}")

    notis = (
        db_session.query(Notificacion)
        .filter(Notificacion.usuario_id == u.id, Notificacion.tipo == "pago")
        .all()
    )
    assert any("fue compensada íntegramente" in n.mensaje for n in notis)


def test_compensacion_con_deuda_mayor_que_liquidacion(db_session, bci_on):
    """
    Dueño tiene liquidación de $40.000 y una multa de $60.000.
    Se absorbe toda la liquidación ($40.000), se extingue esa parte y queda un saldo pendiente de $20.000.
    """
    u = _dueno_con_cuenta(db_session)
    multa = _multa(db_session, u, monto=60000)
    liq_pago = _liquidacion(db_session, u, monto=40000)

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(multa)
    db_session.refresh(liq_pago)

    assert resumen["pagadas"] == 1
    assert liq_pago.estado == "pagado"
    assert liq_pago.referencia_pago.startswith(f"COMPENSACION-MULTAS-{liq_pago.id[:8]}")

    # La multa original redujo su saldo a 20.000
    assert multa.monto == 20000
    assert multa.estado == "pendiente"

    # Se creó una fila de multa pagada por los 40.000 compensados
    multas_pagadas = (
        db_session.query(Pago)
        .filter(Pago.usuario_id == u.id, Pago.tipo == "multa_dueno", Pago.estado == "pagado")
        .all()
    )
    assert len(multas_pagadas) == 1
    assert multas_pagadas[0].monto == 40000


def test_admin_liquidaciones_reporta_multas_y_neto(db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    _multa(db_session, dueno, monto=30000)
    _liquidacion(db_session, dueno, monto=100000)

    resp = auth_as(admin).get("/api/v1/admin/liquidaciones")
    assert resp.status_code == 200
    filas = resp.json()
    fila = next(f for f in filas if f["id"] == dueno.id)

    assert fila["neto_clp"] == 100000
    assert fila["multas_pendientes_clp"] == 30000
    assert fila["neto_a_transferir_clp"] == 70000


def test_admin_listar_multas_duenos(db_session, usuario_factory, auth_as):
    admin = usuario_factory(roles_activos=["admin"])
    dueno = usuario_factory(roles_activos=["arrendador"])
    _multa(db_session, dueno, monto=35000)

    resp = auth_as(admin).get("/api/v1/admin/multas-duenos")
    assert resp.status_code == 200
    multas = resp.json()
    assert len(multas) >= 1
    m = next(row for row in multas if row["dueno_id"] == dueno.id)
    assert m["monto_clp"] == 35000
    assert m["estado"] == "pendiente"
