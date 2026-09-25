"""
Retención de las liquidaciones al dueño (LIQUIDACION_RETENCION_DIAS).

Mientras dura la retención, la plata del arrendatario todavía puede volver
(contracargo, reembolso por disputa), así que no se le transfiere al dueño.
Una transferencia que ya salió ('procesando') no espera: hay que reconciliarla.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.features.payments import cuentas_cobro_service as cc
from app.features.payments import liquidaciones_service as liq
from app.models.entities import Notificacion, Pago, Usuario

RETENCION_DIAS = 7


@pytest.fixture
def bci_con_retencion(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)
    monkeypatch.setattr(settings, "LIQUIDACION_RETENCION_DIAS", RETENCION_DIAS)


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _dueno_con_cuenta(db):
    u = db.query(Usuario).first()
    u.cuenta_bancaria = None
    db.commit()
    cc.agregar(db, u, banco="BancoEstado", tipo_cuenta="CuentaRUT",
               numero="12345678", titular=u.nombre or "X", rut="11.111.111-1")
    return u


def _liquidacion(db, usuario, antiguedad, estado="pendiente", **extra):
    p = Pago(usuario_id=usuario.id, tipo="liquidacion_dueno", monto=85000, estado=estado,
             timestamp=_ahora() - antiguedad, **extra)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def test_liquidacion_reciente_espera_la_retencion(db_session, bci_con_retencion):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, antiguedad=timedelta(days=RETENCION_DIAS - 1))

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)

    db_session.refresh(p)
    assert p.estado == "pendiente"
    assert resumen["intentadas"] == 0


def test_liquidacion_que_cumplio_la_retencion_se_paga(db_session, bci_con_retencion):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, antiguedad=timedelta(days=RETENCION_DIAS, hours=1))

    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)

    db_session.refresh(p)
    assert p.estado == "pagado"
    assert resumen["pagadas"] == 1


def test_fallida_reciente_tambien_espera(db_session, bci_con_retencion):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, antiguedad=timedelta(hours=1), estado="fallido")

    liq.ejecutar_liquidaciones_pendientes(db_session)

    db_session.refresh(p)
    assert p.estado == "fallido"


def test_procesando_huerfano_se_reconcilia_aunque_sea_reciente(db_session, bci_con_retencion):
    # Una transferencia que quedó en vuelo (caída a mitad de camino) no espera la
    # retención: el depósito puede haber salido y hay que cerrar el registro.
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, antiguedad=timedelta(hours=1), estado="procesando",
                     procesando_desde=_ahora() - timedelta(days=1))

    liq.ejecutar_liquidaciones_pendientes(db_session)

    db_session.refresh(p)
    assert p.estado == "pagado"


def test_intentar_liquidar_no_transfiere_en_el_acto_con_retencion(db_session, bci_con_retencion):
    u = _dueno_con_cuenta(db_session)
    p = _liquidacion(db_session, u, antiguedad=timedelta(0))

    liq.intentar_liquidar(db_session, p)

    db_session.refresh(p)
    assert p.estado == "pendiente"
    # Pero el dueño sí se entera, y sabe cuándo le llega.
    aviso = (
        db_session.query(Notificacion)
        .filter(Notificacion.usuario_id == u.id, Notificacion.titulo == liq.TITULO_LIQUIDACION_LISTA)
        .one()
    )
    assert f"en {RETENCION_DIAS} días" in aviso.mensaje
