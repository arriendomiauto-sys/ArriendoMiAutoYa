import pytest
from app.core.config import settings
from app.features.payments import liquidaciones_service as liq
from app.features.payments import cuentas_cobro_service as cc
from app.models.entities import Pago, Usuario


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


def _liquidacion(db, usuario, monto=85000, estado="pendiente"):
    p = Pago(usuario_id=usuario.id, tipo="liquidacion_dueno", monto=monto, estado=estado)
    db.add(p); db.commit(); db.refresh(p)
    return p


def test_con_cuenta_paga_automatico(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "pagado"
    assert p.referencia_pago.startswith("BCI-MOCK-")
    assert p.liquidado_en is not None
    assert resumen["pagadas"] == 1


def test_sin_cuenta_queda_pendiente(db_session, bci_on):
    u = db_session.query(Usuario).first()
    u.cuenta_bancaria = None; db_session.commit()
    p = _liquidacion(db_session, u)
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "pendiente"
    assert resumen["sin_cuenta"] == 1


def test_rechazo_marca_fallido_y_reintenta(db_session, bci_on):
    u = _dueno_con_cuenta(db_session, numero="99990000")  # rechazo simulado
    p = _liquidacion(db_session, u)
    liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "fallido" and p.intentos_liquidacion == 1
    liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.intentos_liquidacion == 2


def test_max_intentos_deja_de_reintentar(db_session, bci_on):
    u = _dueno_con_cuenta(db_session, numero="99990000")
    p = _liquidacion(db_session, u)
    for _ in range(5):
        liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.intentos_liquidacion == liq.MAX_INTENTOS_LIQUIDACION


def test_habilitado_false_es_noop(db_session, monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", False)
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "pendiente"
    assert resumen == {"intentadas": 0, "pagadas": 0, "fallidas": 0, "sin_cuenta": 0}


def test_pago_ya_pagado_no_se_retransfiere(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, estado="pagado")
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    assert resumen["intentadas"] == 0
