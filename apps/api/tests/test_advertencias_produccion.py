"""
Verificaciones que en desarrollo están apagadas a propósito (para no frenar el
trabajo) pero que en producción significarían que nadie verifica antecedentes
ni exige autos verificados. Settings.advertencias_produccion() no bloquea el
arranque, solo lo hace ruidoso en los logs.
"""
from app.core.config import Settings


def _settings(**overrides):
    # Por defecto, todo lo obligatorio encendido: cada test apaga solo lo que prueba.
    base = dict(ENVIRONMENT="production", ANTECEDENTES_OBLIGATORIOS=True, AUTOS_VERIFICADOS_OBLIGATORIOS=True)
    base.update(overrides)
    return Settings(**base)


def test_sin_avisos_fuera_de_produccion():
    s = _settings(ENVIRONMENT="development")
    assert s.advertencias_produccion() == []


def test_avisa_si_los_antecedentes_no_son_obligatorios_en_produccion():
    s = _settings(ANTECEDENTES_OBLIGATORIOS=False)
    avisos = s.advertencias_produccion()
    assert any("ANTECEDENTES_OBLIGATORIOS" in a for a in avisos)


def test_avisa_si_los_autos_no_verificados_siguen_reservables_en_produccion():
    s = _settings(AUTOS_VERIFICADOS_OBLIGATORIOS=False)
    avisos = s.advertencias_produccion()
    assert any("AUTOS_VERIFICADOS_OBLIGATORIOS" in a for a in avisos)


def test_no_avisa_de_antecedentes_si_estan_activados():
    s = _settings()
    avisos = s.advertencias_produccion()
    assert not any("ANTECEDENTES" in a or "AUTOS_VERIFICADOS" in a for a in avisos)


def test_chapi_ya_no_existe_en_la_configuracion():
    assert not hasattr(Settings(), "CHAPI_API_KEY")


def test_avisa_si_didit_habilitado_sin_credenciales_completas():
    s = _settings(
        VERIFICACION_EXTERNA_HABILITADA=True,
        DIDIT_API_KEY="key", DIDIT_WORKFLOW_ID=None, DIDIT_WEBHOOK_SECRET="secret",
    )
    avisos = s.advertencias_produccion()
    assert any("DIDIT" in a for a in avisos)


def test_no_avisa_de_didit_si_esta_apagado():
    s = _settings(VERIFICACION_EXTERNA_HABILITADA=False)
    assert s.advertencias_produccion() == []
