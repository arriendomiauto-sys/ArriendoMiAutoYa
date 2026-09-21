"""
BUG-046: la comisión de la plataforma es 15 % (así lo dicen la app, la web y los
documentos del cliente), pero el backend arrancaba con 20 %: el dueño veía el
85 % y cobraba el 80 %. Todos los valores por defecto deben coincidir en 15 %.
"""
from app.core.config import settings
from app.models.entities import ConfiguracionPlataforma
from app.services.pricing import PricingService


def test_el_ajuste_por_defecto_es_15_por_ciento():
    assert settings.COMISION_PLATAFORMA_PORCENTAJE == 0.15


def test_la_columna_de_configuracion_arranca_en_15():
    columna = ConfiguracionPlataforma.__table__.c.comision_plataforma_pct
    assert columna.default.arg == 15.0


def test_sin_fila_de_configuracion_el_calculo_usa_15():
    # Sin `db` no hay fila: se usa el respaldo del sistema.
    calculo = PricingService.calcular_cobro_final(tarifa_dia=35000, dias=2)
    assert calculo["comision_empresa"] == 10500
    assert calculo["liquidacion_dueno"] == 59500


def test_el_panel_crea_la_configuracion_con_15_si_no_existe(db_session, usuario_factory, auth_as):
    db_session.query(ConfiguracionPlataforma).delete()
    db_session.commit()

    admin = usuario_factory(roles_activos=["admin"])
    datos = auth_as(admin).get("/api/v1/admin/configuracion").json()

    assert datos["comision_plataforma_pct"] == 15.0


def test_la_configuracion_de_prueba_tambien_es_15(db_session):
    # El fixture es la "base de producción" de los tests: si dijera 20, los
    # tests con base de datos probarían un reparto que el negocio no usa.
    config = db_session.query(ConfiguracionPlataforma).first()
    assert config.comision_plataforma_pct == 15.0
