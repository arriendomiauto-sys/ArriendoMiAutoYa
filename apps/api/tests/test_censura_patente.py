"""
Censura automática de patentes en las fotos de autos (privacidad del dueño).

`ImagePrivacy.censurar_patentes` corre en `StorageService.subir_archivo` para
el bucket "autos": detecta la placa con Google Vision TEXT_DETECTION y la tapa
con un rectángulo negro. Es best-effort — si Vision no está o no encuentra
nada, devuelve la foto original.

Acá se simula la respuesta de Vision (sin red) y se verifica que:
  - una patente en un solo token OCR se tapa,
  - una patente partida en dos tokens ("BBCL" + "10") se tapa,
  - texto que no es patente no se toca,
  - sin OCR disponible, la foto vuelve intacta,
  - el pipeline de subida (`bucket="autos"`) aplica la censura.
"""
import io

import pytest
from PIL import Image

from app.services.image_privacy import ImagePrivacy
from app.services.storage import StorageService


def _jpeg_blanco(w=400, h=300) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (255, 255, 255)).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _ann(desc, x0, y0, x1, y1):
    return {
        "description": desc,
        "boundingPoly": {"vertices": [
            {"x": x0, "y": y0}, {"x": x1, "y": y0},
            {"x": x1, "y": y1}, {"x": x0, "y": y1},
        ]},
    }


def _es_oscuro(px):
    return sum(px[:3]) < 120  # ~ (17,17,17) con margen por el JPEG


def _parchar_vision(monkeypatch, anns):
    monkeypatch.setattr(ImagePrivacy, "_vision_text_annotations", staticmethod(lambda _b: anns))


def _forzar_respaldo_local(monkeypatch, tmp_path):
    """El .env de pruebas trae credenciales reales de Supabase; se neutralizan
    para que la subida caiga al respaldo local y el test pueda leer el archivo."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://your-project.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path))


# --------------------------------------------------------------------------- #
def test_censura_patente_token_unico(monkeypatch):
    anns = [_ann("BBCL-10\n", 0, 0, 0, 0), _ann("BBCL-10", 100, 200, 180, 235)]
    _parchar_vision(monkeypatch, anns)

    salida = ImagePrivacy.censurar_patentes(_jpeg_blanco())
    img = Image.open(io.BytesIO(salida)).convert("RGB")
    assert _es_oscuro(img.getpixel((140, 217)))   # centro de la placa: tapado
    assert not _es_oscuro(img.getpixel((10, 10)))  # esquina: intacta


def test_censura_patente_partida_en_dos_tokens(monkeypatch):
    anns = [
        _ann("BBCL 10", 0, 0, 0, 0),
        _ann("BBCL", 100, 200, 145, 235),
        _ann("10", 150, 200, 180, 235),
    ]
    _parchar_vision(monkeypatch, anns)

    salida = ImagePrivacy.censurar_patentes(_jpeg_blanco())
    img = Image.open(io.BytesIO(salida)).convert("RGB")
    assert _es_oscuro(img.getpixel((122, 217)))
    assert _es_oscuro(img.getpixel((165, 217)))


def test_texto_que_no_es_patente_no_se_toca(monkeypatch):
    anns = [_ann("TOYOTA YARIS", 0, 0, 0, 0), _ann("TOYOTA", 20, 20, 90, 40), _ann("YARIS", 95, 20, 150, 40)]
    _parchar_vision(monkeypatch, anns)

    original = _jpeg_blanco()
    assert ImagePrivacy.censurar_patentes(original) is original


def test_sin_vision_devuelve_la_foto_original(monkeypatch):
    _parchar_vision(monkeypatch, None)
    original = _jpeg_blanco()
    assert ImagePrivacy.censurar_patentes(original) is original


# --------------------------------------------------------------------------- #
def test_subida_bucket_autos_aplica_censura(monkeypatch, tmp_path):
    """El pipeline real: POST equivalente -> StorageService.subir_archivo."""
    _forzar_respaldo_local(monkeypatch, tmp_path)
    _parchar_vision(monkeypatch, [_ann("KZZP77", 0, 0, 0, 0), _ann("KZZP77", 120, 120, 210, 160)])

    resultado = StorageService.subir_archivo(
        contenido_bytes=_jpeg_blanco(),
        nombre_original="frontal.jpg",
        content_type="image/jpeg",
        bucket="autos",
        base_url="https://api.test/",
    )
    assert resultado["success"] is True
    guardado = tmp_path / "autos" / resultado["filename"]
    img = Image.open(guardado).convert("RGB")
    assert _es_oscuro(img.getpixel((165, 140)))


def test_subida_otros_buckets_no_llama_a_censura(monkeypatch, tmp_path):
    _forzar_respaldo_local(monkeypatch, tmp_path)
    llamado = {"si": False}

    def _spy(_b):
        llamado["si"] = True
        return _b

    monkeypatch.setattr(ImagePrivacy, "censurar_patentes", staticmethod(_spy))
    StorageService.subir_archivo(
        contenido_bytes=_jpeg_blanco(),
        nombre_original="x.jpg",
        content_type="image/jpeg",
        bucket="general",
        base_url="https://api.test/",
    )
    assert llamado["si"] is False
