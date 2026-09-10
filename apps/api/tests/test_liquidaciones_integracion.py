import pytest
from app.core.config import settings
from app.features.payments import cuentas_cobro_service as cc
from app.models.entities import Pago, Usuario


@pytest.fixture
def bci_on(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)


def test_admin_ejecutar_liquidaciones(client, usuario_factory, auth_as, db_session, bci_on):
    admin = usuario_factory(roles_activos=["admin"])
    dueno = db_session.query(Usuario).first()
    dueno.cuenta_bancaria = None; db_session.commit()
    cc.agregar(db_session, dueno, banco="BancoEstado", tipo_cuenta="CuentaRUT",
               numero="12345678", titular="X", rut="11.111.111-1")
    p = Pago(usuario_id=dueno.id, tipo="liquidacion_dueno", monto=50000, estado="pendiente")
    db_session.add(p); db_session.commit()

    r = auth_as(admin).post("/api/v1/admin/liquidaciones/ejecutar")
    assert r.status_code == 200
    assert r.json()["resumen"]["pagadas"] == 1
    db_session.refresh(p)
    assert p.estado == "pagado"


def test_admin_ejecutar_requiere_admin(client, usuario_factory, auth_as):
    u = usuario_factory(roles_activos=["arrendador"])
    assert auth_as(u).post("/api/v1/admin/liquidaciones/ejecutar").status_code == 403
