from app.services.pricing import PricingService
from app.models.entities import Usuario

def test_calculo_cargos_limpieza():
    # Limpio: $0 cargo
    calc_limpio = PricingService.calcular_cobro_final(tarifa_dia=40000, dias=2, estado_limpieza="limpio")
    assert calc_limpio["subtotal_arriendo"] == 80000
    assert calc_limpio["cargo_limpieza"] == 0
    assert calc_limpio["comision_empresa"] == 16000 # 20%
    assert calc_limpio["liquidacion_dueno"] == 64000 # 80%
    assert calc_limpio["monto_total_cobro"] == 80000

    # Sucio estándar: +$15.000 CLP transferido al dueño
    calc_estandar = PricingService.calcular_cobro_final(tarifa_dia=40000, dias=2, estado_limpieza="sucio_estandar")
    assert calc_estandar["cargo_limpieza"] == 15000
    assert calc_estandar["comision_empresa"] == 16000 # Solo sobre arriendo
    assert calc_estandar["liquidacion_dueno"] == 64000 + 15000 # 79.000
    assert calc_estandar["monto_total_cobro"] == 80000 + 15000 # 95.000

    # Sucio profundo: +$35.000 CLP transferido al dueño
    calc_profundo = PricingService.calcular_cobro_final(tarifa_dia=40000, dias=2, estado_limpieza="sucio_profundo")
    assert calc_profundo["cargo_limpieza"] == 35000
    assert calc_profundo["liquidacion_dueno"] == 64000 + 35000 # 99.000
    assert calc_profundo["monto_total_cobro"] == 80000 + 35000 # 115.000

def test_admin_revision_documentos_manual(db_session, auth_as):
    # Buscar usuario que requiere revisión manual y usuario admin del seed
    usuario_pendiente = db_session.query(Usuario).filter(Usuario.estado_documentos == "requiere_revision_manual").first()
    admin_user = db_session.query(Usuario).filter(Usuario.email == "admin@arriendatuauto.cl").first()
    assert usuario_pendiente is not None
    assert admin_user is not None
    c = auth_as(admin_user)

    # 1. Listar pendientes
    resp_list = c.get("/api/v1/admin/documentos/pendientes")
    assert resp_list.status_code == 200
    lista = resp_list.json()
    assert len(lista) >= 1
    assert any(u["id"] == usuario_pendiente.id for u in lista)

    # 2. Admin aprueba documento
    resp_aprobar = c.post(
        f"/api/v1/admin/documentos/{usuario_pendiente.id}/revisar",
        json={
            "accion": "aprobar",
            "notas": "Documento validado manualmente por Admin tras inspección de foto."
        }
    )
    assert resp_aprobar.status_code == 200
    data = resp_aprobar.json()
    assert data["estado_documentos"] == "verificado"
    assert "Aprobado por Admin" in data["notas_auditoria"]

def test_manager_no_puede_aprobar_documentos_solo_admin_rf31(db_session, auth_as):
    usuario_pendiente = db_session.query(Usuario).filter(Usuario.estado_documentos == "requiere_revision_manual").first()
    manager_user = db_session.query(Usuario).filter(Usuario.email == "manager.la@arriendatuauto.cl").first()
    assert usuario_pendiente is not None
    assert manager_user is not None

    resp = auth_as(manager_user).post(
        f"/api/v1/admin/documentos/{usuario_pendiente.id}/revisar",
        json={"accion": "aprobar", "notas": "intento no autorizado"}
    )
    assert resp.status_code == 403
