from datetime import timedelta

import pytest
from app.core.config import settings
from app.features.payments import liquidaciones_service as liq
from app.features.payments import cuentas_cobro_service as cc
from app.models.entities import Notificacion, Pago, Usuario


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
    # La notificación al dueño se persiste de verdad.
    notis = (
        db_session.query(Notificacion)
        .filter(Notificacion.usuario_id == u.id, Notificacion.tipo == "pago")
        .all()
    )
    assert any("Depósito enviado" == n.titulo for n in notis)


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
    p.referencia_pago = "BCI-MOCK-YAEXISTE"
    db_session.commit()
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    assert resumen["intentadas"] == 0
    db_session.refresh(p)
    assert p.estado == "pagado"
    assert p.referencia_pago == "BCI-MOCK-YAEXISTE"


def test_intentar_liquidar_directo_paga(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)
    liq.intentar_liquidar(db_session, p)
    db_session.refresh(p)
    assert p.estado == "pagado"
    assert p.referencia_pago.startswith("BCI-MOCK-")


def test_intentar_liquidar_noop_flag_off(db_session, monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", False)
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)
    liq.intentar_liquidar(db_session, p)  # no debe lanzar
    db_session.refresh(p)
    assert p.estado == "pendiente"


def test_procesando_huerfano_se_reconcilia(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, estado="procesando")
    p.referencia_pago = "BCI-MOCK-HUERFANO01"  # mock -> "acreditada"
    db_session.commit()
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "pagado"
    assert p.liquidado_en is not None
    assert resumen["pagadas"] == 1


# ---------------------------------------------------------------------------
# CRITICAL 1 — un 'procesando' fresco es una transferencia EN VUELO, no un
# huérfano: re-tomarla sería depositarle dos veces al dueño.
# ---------------------------------------------------------------------------
def test_procesando_fresco_no_se_retransfiere(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, estado="procesando")
    p.procesando_desde = liq._ahora()  # recién reclamada, sin referencia_pago
    db_session.commit()

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "procesando"
    assert p.referencia_pago is None
    assert resumen == {"intentadas": 0, "pagadas": 0, "fallidas": 0, "sin_cuenta": 0}


def test_procesando_viejo_sin_referencia_se_reclama(db_session, bci_on):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, estado="procesando")
    p.procesando_desde = liq._ahora() - timedelta(
        minutes=liq._minutos_stale_procesando() + 1
    )
    db_session.commit()

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "pagado"
    assert p.referencia_pago.startswith("BCI-MOCK-")
    assert p.procesando_desde is None
    assert resumen["pagadas"] == 1


def test_dos_barridos_solapados_transfieren_una_sola_vez(db_session, bci_on, monkeypatch):
    """El escenario del doble pago: mientras transferir() está en vuelo entra
    otro barrido. transferir() debe llamarse exactamente una vez."""
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)

    llamadas = {"n": 0}
    real = liq.bci_payouts.transferir

    def transferir_reentrante(cuenta, monto, ref):
        llamadas["n"] += 1
        # Segundo barrido concurrente justo mientras el primero está en vuelo:
        # la fila ya está en 'procesando' con procesando_desde fresco.
        liq.ejecutar_liquidaciones_pendientes(db_session)
        return real(cuenta, monto, ref)

    monkeypatch.setattr(liq.bci_payouts, "transferir", transferir_reentrante)

    liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert llamadas["n"] == 1
    assert p.estado == "pagado"


# ---------------------------------------------------------------------------
# CRITICAL 2 — el barrido acotado a un dueño no toca la plata de los demás.
# ---------------------------------------------------------------------------
def test_barrido_por_usuario_no_toca_a_otros(db_session, bci_on, usuario_factory):
    u1 = _dueno_con_cuenta(db_session)
    u2 = usuario_factory(roles_activos=["dueno", "cliente"])
    cc.agregar(db_session, u2, banco="BancoEstado", tipo_cuenta="CuentaRUT",
               numero="87654321", titular="Otro", rut="11.111.111-1")
    p1 = _liquidacion(db_session, u1)
    p2 = _liquidacion(db_session, u2)

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session, usuario_id=u1.id)
    db_session.refresh(p1); db_session.refresh(p2)
    assert resumen["pagadas"] == 1
    assert p1.estado == "pagado"
    assert p2.estado == "pendiente"  # intacto

    # Sin usuario_id (loop de fondo / admin) sí barre a todos.
    resumen_global = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p2)
    assert resumen_global["pagadas"] == 1
    assert p2.estado == "pagado"


# ---------------------------------------------------------------------------
# IMPORTANT 3 — el dueño se entera de su liquidación aunque BCI esté apagado.
# ---------------------------------------------------------------------------
def _notis_liq_lista(db, usuario_id):
    return (
        db.query(Notificacion)
        .filter(
            Notificacion.usuario_id == usuario_id,
            Notificacion.titulo == liq.TITULO_LIQUIDACION_LISTA,
        )
        .all()
    )


def test_intentar_liquidar_avisa_al_dueno_con_bci_apagado(db_session, monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", False)
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u)

    liq.intentar_liquidar(db_session, p)
    notis = _notis_liq_lista(db_session, u.id)
    assert len(notis) == 1
    assert "85.000" in notis[0].mensaje

    # Idempotente: un segundo intento (reintento del delivery) no duplica.
    liq.intentar_liquidar(db_session, p)
    assert len(_notis_liq_lista(db_session, u.id)) == 1


def test_sin_cuenta_avisa_una_sola_vez_aunque_barra_muchas_veces(db_session, bci_on):
    u = db_session.query(Usuario).first()
    u.cuenta_bancaria = None; db_session.commit()
    p = _liquidacion(db_session, u)

    for _ in range(3):
        liq.ejecutar_liquidaciones_pendientes(db_session)

    notis = _notis_liq_lista(db_session, u.id)
    assert len(notis) == 1
    assert "cuenta de cobro" in notis[0].mensaje
    db_session.refresh(p)
    assert p.estado == "pendiente"


def test_procesando_huerfano_todavia_en_proceso_se_deja_como_esta(db_session, bci_on, monkeypatch):
    """Fila 'procesando' vieja + con referencia_pago, pero BCI dice que la
    transferencia sigue en curso -> no se paga, no se marca fallida, no cuenta."""
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, estado="procesando")
    p.referencia_pago = "BCI-REAL-EN-CURSO"
    p.procesando_desde = liq._ahora() - timedelta(hours=2)  # ya es "huérfana" por antigüedad
    db_session.commit()

    monkeypatch.setattr(
        liq.bci_payouts, "consultar_transferencia",
        lambda tid: {"estado": "en_proceso"},
    )

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.refresh(p)
    assert p.estado == "procesando"
    assert p.referencia_pago == "BCI-REAL-EN-CURSO"
    assert resumen["intentadas"] == 0
