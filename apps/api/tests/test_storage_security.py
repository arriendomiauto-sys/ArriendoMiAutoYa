"""
Pruebas de /storage/upload: requiere sesión, valida tipo y tamaño de
archivo. Usa `auth_as` (sobreescribe get_current_user directamente) para
no depender de la red real hacia Supabase Auth; la validación de
tipo/tamaño ocurre antes de cualquier llamada a Supabase Storage, así que
tampoco hace falta mockear esa parte.
"""


def test_upload_sin_auth_da_401(client):
    resp = client.post(
        "/api/v1/storage/upload",
        files={"file": ("foto.jpg", b"contenido-de-prueba", "image/jpeg")},
        data={"bucket": "general"},
    )
    assert resp.status_code == 401


def test_upload_tipo_no_permitido_da_400(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).post(
        "/api/v1/storage/upload",
        files={"file": ("archivo.pdf", b"%PDF-1.4 contenido falso", "application/pdf")},
        data={"bucket": "general"},
    )
    assert resp.status_code == 400
    assert "no permitido" in resp.json()["detail"].lower()


def test_upload_archivo_vacio_da_400(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).post(
        "/api/v1/storage/upload",
        files={"file": ("foto.jpg", b"", "image/jpeg")},
        data={"bucket": "general"},
    )
    assert resp.status_code == 400


def test_upload_excede_tamano_maximo_da_400(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])
    contenido_grande = b"0" * (9 * 1024 * 1024)  # 9 MB > límite de 8 MB
    resp = auth_as(usuario).post(
        "/api/v1/storage/upload",
        files={"file": ("foto_grande.jpg", contenido_grande, "image/jpeg")},
        data={"bucket": "documentos-kyc"},
    )
    assert resp.status_code == 400
    assert "tamaño máximo" in resp.json()["detail"].lower()


def test_upload_bucket_desconocido_cae_a_general(usuario_factory, auth_as, monkeypatch):
    """
    Un bucket no reconocido no debe romper nada ni escribir fuera de lugar:
    StorageService lo reconduce a "general" antes de llegar a cualquier
    proveedor de almacenamiento.
    """
    from app.services.storage import StorageService

    # PNG mínimo válido (1x1) para pasar la detección por magic bytes.
    png_1x1 = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000a49444154789c6300010000050001a5f645400000000049454e44ae426082"
    )
    resultado = StorageService.subir_archivo(
        contenido_bytes=png_1x1,
        nombre_original="foto.jpg",
        content_type="image/jpeg",
        bucket="bucket-inventado",
    )
    assert resultado["bucket"] == "general"


def test_renovar_url_bucket_no_privado_da_400(usuario_factory, auth_as):
    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).get("/api/v1/storage/autos/algun-archivo.jpg/renovar")
    assert resp.status_code == 400


def test_renovar_url_sin_auth_da_401(client):
    resp = client.get("/api/v1/storage/documentos-kyc/algun-archivo.jpg/renovar")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Respaldo local de buckets privados
#
# Una corrida de QA dejó 13 cédulas/licencias/selfies en uploads/documentos-kyc/,
# que se publicaba entero vía StaticFiles: cualquiera con la URL las leía. El
# respaldo de los buckets privados ahora vive fuera del árbol estático y se
# sirve por un endpoint con sesión.
# ---------------------------------------------------------------------------


def test_bucket_privado_no_se_sirve_como_estatico(client, tmp_path, monkeypatch):
    """
    /uploads solo monta los buckets públicos. Aunque exista el archivo en el
    directorio de un bucket privado, esa ruta no debe entregarlo.
    """
    from app.core.config import settings

    kyc_dir = tmp_path / "documentos-kyc"
    kyc_dir.mkdir(parents=True)
    (kyc_dir / "carnet.jpg").write_bytes(b"\xff\xd8\xff carnet")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path))

    resp = client.get("/uploads/documentos-kyc/carnet.jpg")
    assert resp.status_code == 404


def test_respaldo_local_privado_exige_sesion(client):
    resp = client.get("/api/v1/storage/local/documentos-kyc/algun-archivo.jpg")
    assert resp.status_code == 401


def test_respaldo_local_privado_entrega_archivo_con_sesion(
    usuario_factory, auth_as, tmp_path, monkeypatch
):
    from app.core.config import settings

    kyc_dir = tmp_path / "documentos-kyc"
    kyc_dir.mkdir(parents=True)
    (kyc_dir / "carnet.jpg").write_bytes(b"\xff\xd8\xff carnet")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path))

    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).get("/api/v1/storage/local/documentos-kyc/carnet.jpg")
    assert resp.status_code == 200
    assert resp.content == b"\xff\xd8\xff carnet"


def test_respaldo_local_privado_rechaza_bucket_publico(usuario_factory, auth_as):
    """El endpoint es solo para buckets privados; `autos` no pasa por acá."""
    usuario = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(usuario).get("/api/v1/storage/local/autos/foto.jpg")
    assert resp.status_code == 404


def test_respaldo_local_privado_rechaza_path_traversal(
    usuario_factory, auth_as, tmp_path, monkeypatch
):
    from app.core.config import settings

    (tmp_path / "documentos-kyc").mkdir(parents=True)
    (tmp_path / "secreto.txt").write_bytes(b"no debe salir")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path))

    usuario = usuario_factory(roles_activos=["cliente"])
    for intento in ("../secreto.txt", "..%2Fsecreto.txt", "subdir/secreto.txt"):
        resp = auth_as(usuario).get(f"/api/v1/storage/local/documentos-kyc/{intento}")
        assert resp.status_code == 404, f"traversal no rechazado: {intento}"


def test_bucket_privado_cae_en_directorio_privado(monkeypatch, tmp_path):
    """
    El respaldo local de un bucket privado se escribe en el árbol privado y su
    URL apunta al endpoint con sesión — nunca a /uploads.
    """
    from app.core.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path / "publico"))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    # Fuerza el fallback local: sin credenciales reales no se intenta Supabase.
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-placeholder")

    jpg = b"\xff\xd8\xff" + b"0" * 32
    resultado = StorageService.subir_archivo(
        contenido_bytes=jpg,
        nombre_original="carnet.jpg",
        bucket="documentos-kyc",
        base_url="http://testserver/",
    )

    assert resultado["success"] is True
    assert resultado["provider"] == "local_privado"
    assert "/storage/local/documentos-kyc/" in resultado["url"]
    assert "/uploads/" not in resultado["url"]
    # El archivo no quedó en el árbol que se publica como estático.
    assert not (tmp_path / "publico" / "documentos-kyc").exists()
    assert (tmp_path / "privado" / "documentos-kyc" / resultado["filename"]).is_file()


def test_bucket_publico_sigue_en_uploads(monkeypatch, tmp_path):
    from app.core.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "STORAGE_LOCAL_DIR", str(tmp_path / "publico"))
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path / "privado"))
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "your-placeholder")

    jpg = b"\xff\xd8\xff" + b"0" * 32
    resultado = StorageService.subir_archivo(
        contenido_bytes=jpg,
        nombre_original="auto.jpg",
        bucket="general",
        base_url="http://testserver/",
    )

    assert resultado["provider"] == "local"
    assert "/uploads/general/" in resultado["url"]


def test_ocr_lee_el_respaldo_local_privado_sin_pasar_por_http(monkeypatch, tmp_path):
    """
    El endpoint del respaldo privado exige sesión, así que el OCR no puede
    bajarlo por HTTP (daría 401): debe resolverlo leyendo del disco.
    """
    from app.core.config import settings
    from app.features.verificacion_identidad.ocr_engine import OCRService

    kyc_dir = tmp_path / "documentos-kyc"
    kyc_dir.mkdir(parents=True)
    (kyc_dir / "carnet.jpg").write_bytes(b"\xff\xd8\xff imagen-de-carnet")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PRIVATE_DIR", str(tmp_path))

    def _sin_red(*args, **kwargs):
        raise AssertionError("el OCR no debe salir a la red para el respaldo local")

    monkeypatch.setattr("httpx.Client.get", _sin_red)

    contenido = OCRService.descargar_imagen_bytes(
        "http://testserver/api/v1/storage/local/documentos-kyc/carnet.jpg"
    )
    assert contenido == b"\xff\xd8\xff imagen-de-carnet"
