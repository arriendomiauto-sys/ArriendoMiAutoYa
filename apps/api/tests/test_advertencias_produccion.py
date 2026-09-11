"""
Sin CHAPI_API_KEY (o fuera de producción) la verificación de antecedentes
corre en modo simulado y siempre da "limpio" -- correcto en desarrollo,
silencioso y peligroso si pasa inadvertido en producción. Settings.
advertencias_produccion() no bloquea el arranque, solo lo hace ruidoso.
"""
from app.core.config import Settings


def _settings(**overrides):
    base = dict(ENVIRONMENT="production")
    base.update(overrides)
    return Settings(**base)


def test_sin_avisos_fuera_de_produccion():
    s = _settings(ENVIRONMENT="development")
    assert s.advertencias_produccion() == []


def test_avisa_si_falta_chapi_api_key_en_produccion():
    s = _settings(CHAPI_API_KEY=None)
    avisos = s.advertencias_produccion()
    assert any("CHAPI_API_KEY" in a for a in avisos)


def test_no_avisa_de_chapi_si_la_key_esta_configurada():
    s = _settings(CHAPI_API_KEY="key-real")
    avisos = s.advertencias_produccion()
    assert not any("CHAPI_API_KEY" in a for a in avisos)


def test_avisa_si_didit_habilitado_sin_credenciales_completas():
    s = _settings(
        VERIFICACION_EXTERNA_HABILITADA=True,
        DIDIT_API_KEY="key", DIDIT_WORKFLOW_ID=None, DIDIT_WEBHOOK_SECRET="secret",
    )
    avisos = s.advertencias_produccion()
    assert any("DIDIT" in a for a in avisos)


def test_no_avisa_de_didit_si_esta_apagado():
    s = _settings(VERIFICACION_EXTERNA_HABILITADA=False, CHAPI_API_KEY="key-real")
    assert s.advertencias_produccion() == []
