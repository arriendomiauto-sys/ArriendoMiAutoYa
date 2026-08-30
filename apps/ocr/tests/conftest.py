import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def _ocr_en_mock():
    """Por defecto la suite corre en modo simulación: nunca sale a la red a
    Google Cloud Vision. Los casos de Vision se prueban aparte forzando
    USE_OCR_MOCK=False con stubs (fixture `vision_configurado`)."""
    original = settings.USE_OCR_MOCK
    settings.USE_OCR_MOCK = True
    yield
    settings.USE_OCR_MOCK = original
