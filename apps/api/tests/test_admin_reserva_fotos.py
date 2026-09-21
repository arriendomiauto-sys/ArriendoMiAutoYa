"""
El detalle de una reserva en el panel incluye las fotos del checklist de entrega y de devolución: son la
evidencia cuando hay una disputa. Antes solo llegaban km, combustible y limpieza.
"""
import pytest

from app.features.system.storage.service import StorageService
from app.models.entities import ChecklistAuto, Reserva


@pytest.fixture(autouse=True)
def firmas_caducadas(monkeypatch):
    def renovar(cls, url, margen_horas=24):
        return f"{url}?r=1" if url and url.startswith("https://x/") and "?r=1" not in url else url

    monkeypatch.setattr(StorageService, "renovar_si_vence_pronto", classmethod(renovar))


@pytest.fixture
def reserva_con_checklists(db_session):
    reserva = db_session.query(Reserva).first()
    db_session.add_all([
        ChecklistAuto(reserva_id=reserva.id, tipo="antes", fotos=["https://x/a1.jpg", "https://x/a2.jpg"],
                      kilometraje=25000, nivel_combustible="lleno", estado_limpieza="limpio",
                      notas="Auto impecable", selfie_entrega_url="https://x/selfie.jpg"),
        ChecklistAuto(reserva_id=reserva.id, tipo="despues", fotos=["https://x/d1.jpg"],
                      kilometraje=25400, nivel_combustible="1/2", estado_limpieza="sucio_estandar",
                      notas="Sucio"),
    ])
    db_session.commit()
    return reserva


def test_el_detalle_trae_las_fotos_del_checklist_con_urls_vigentes(usuario_factory, auth_as, reserva_con_checklists):
    admin = usuario_factory(roles_activos=["admin"])

    r = auth_as(admin).get(f"/api/v1/admin/reservas/{reserva_con_checklists.id}").json()

    assert r["checklist_entrega"]["fotos"] == ["https://x/a1.jpg?r=1", "https://x/a2.jpg?r=1"]
    assert r["checklist_entrega"]["notas"] == "Auto impecable"
    assert r["checklist_entrega"]["selfie_entrega_url"] == "https://x/selfie.jpg?r=1"
    assert r["checklist_devolucion"]["fotos"] == ["https://x/d1.jpg?r=1"]


def test_el_listado_no_carga_todas_las_fotos_pero_dice_cuantas_hay(usuario_factory, auth_as, reserva_con_checklists):
    admin = usuario_factory(roles_activos=["admin"])

    items = auth_as(admin).get("/api/v1/admin/reservas").json()["items"]

    fila = next(i for i in items if i["id"] == reserva_con_checklists.id)
    assert "fotos" not in fila["checklist_entrega"]
    assert fila["checklist_entrega"]["n_fotos"] == 2


def test_el_detalle_dice_hasta_cuando_confirma_el_dueno_y_por_que_se_cancelo(usuario_factory, auth_as, db_session):
    """Soporte necesita ver el plazo del dueño y el motivo de una cancelación automática."""
    from datetime import datetime, timedelta

    reserva = db_session.query(Reserva).first()
    plazo = datetime.utcnow() + timedelta(hours=5)
    reserva.confirmar_dueno_antes_de = plazo
    reserva.motivo_cancelacion = "no_presentacion"
    reserva.multas_detalle = [{"tipo": "no_presentacion", "monto_clp": 30000}]
    db_session.commit()
    admin = usuario_factory(roles_activos=["admin"])

    r = auth_as(admin).get(f"/api/v1/admin/reservas/{reserva.id}").json()

    assert r["confirmar_dueno_antes_de"] is not None
    assert r["motivo_cancelacion"] == "no_presentacion"
    assert r["multas_detalle"][0]["monto_clp"] == 30000


def test_el_detalle_muestra_quien_aviso_su_llegada(usuario_factory, auth_as, db_session):
    """Es la evidencia con la que el sistema decidió a quién multar por no presentarse."""
    from datetime import datetime

    reserva = db_session.query(Reserva).first()
    reserva.llegada_dueno_en = datetime(2026, 9, 20, 10, 5)
    db_session.commit()
    admin = usuario_factory(roles_activos=["admin"])

    r = auth_as(admin).get(f"/api/v1/admin/reservas/{reserva.id}").json()

    assert r["llegada_dueno_en"].startswith("2026-09-20T10:05")
    assert r["llegada_cliente_en"] is None
