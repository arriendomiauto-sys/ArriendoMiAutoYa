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
