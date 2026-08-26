"""
Pruebas de `get_current_user` (app/services/auth.py) en sí mismo — sin usar
el atajo `auth_as` de conftest.py, que sobreescribe la dependencia. Aquí se
ejercita la dependencia real, incluyendo la llamada HTTP a
`{SUPABASE_URL}/auth/v1/user`, pero contra un doble de httpx.AsyncClient en
vez de la red real, para que las pruebas sean rápidas y no dependan de
Internet ni de credenciales reales de Supabase.
"""
import pytest
from app.models.entities import Usuario


class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """
    Sustituye httpx.AsyncClient dentro de app.services.auth. El token
    codifica el resultado esperado de Supabase:
      "valid:<id>:<email>"  -> 200 con ese usuario
      cualquier otro valor  -> 401 (token inválido/expirado)
    """
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, headers=None):
        token = (headers or {}).get("Authorization", "").replace("Bearer ", "")
        if token.startswith("valid:"):
            _, supa_id, email = token.split(":", 2)
            return _FakeResponse(200, {"id": supa_id, "email": email})
        return _FakeResponse(401, {})


@pytest.fixture
def mock_supabase(monkeypatch):
    monkeypatch.setattr("app.services.auth.httpx.AsyncClient", _FakeAsyncClient)


def test_sin_header_authorization_da_401(client, mock_supabase):
    resp = client.get("/api/v1/usuarios/me")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "No autenticado"


def test_header_sin_prefijo_bearer_da_401(client, mock_supabase):
    resp = client.get("/api/v1/usuarios/me", headers={"Authorization": "Token abc123"})
    assert resp.status_code == 401


def test_token_rechazado_por_supabase_da_401(client, mock_supabase):
    resp = client.get("/api/v1/usuarios/me", headers={"Authorization": "Bearer token-basura-invalido"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Token inválido o expirado"


def test_token_valido_autoprovisiona_usuario_nuevo(client, mock_supabase, db_session):
    supa_id = "11111111-1111-1111-1111-111111111111"
    resp = client.get(
        "/api/v1/usuarios/me",
        headers={"Authorization": f"Bearer valid:{supa_id}:nuevo.usuario@test.cl"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == supa_id
    assert data["email"] == "nuevo.usuario@test.cl"
    assert data["roles_activos"] == ["cliente"]
    assert data["rut"] is None
    assert data["nombre"] is None
    assert data["estado_documentos"] == "pendiente"


def test_token_valido_no_duplica_usuario_en_llamadas_repetidas(client, mock_supabase, db_session):
    supa_id = "22222222-2222-2222-2222-222222222222"
    headers = {"Authorization": f"Bearer valid:{supa_id}:repetido@test.cl"}

    resp1 = client.get("/api/v1/usuarios/me", headers=headers)
    resp2 = client.get("/api/v1/usuarios/me", headers=headers)
    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["id"] == resp2.json()["id"]

    count = db_session.query(Usuario).filter(Usuario.id == supa_id).count()
    assert count == 1


def test_token_valido_de_usuario_existente_no_pisa_su_perfil(client, mock_supabase, usuario_factory):
    usuario = usuario_factory(
        roles_activos=["dueno", "cliente"],
        nombre="Ya Enrolado",
        rut="12.345.678-5",
        email="ya.enrolado@test.cl",
    )
    resp = client.get(
        "/api/v1/usuarios/me",
        headers={"Authorization": f"Bearer valid:{usuario.id}:otro-email-en-el-token@test.cl"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Se devuelve la fila local ya existente, no se sobrescribe con lo que
    # venga en la respuesta de Supabase en cada request.
    assert data["nombre"] == "Ya Enrolado"
    assert data["rut"] == "12.345.678-5"
    assert data["roles_activos"] == ["dueno", "cliente"]
