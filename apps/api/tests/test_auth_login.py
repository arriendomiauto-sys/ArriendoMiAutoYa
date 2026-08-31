"""
Pruebas de POST /auth/login y /auth/refresh (app/routers/auth.py): el
proxy de login que le permite a clientes sin credenciales de Supabase
(por ejemplo un panel administrativo aparte) loguearse hablando solo con
esta API. Se ejercita la lógica real, pero contra un doble de
httpx.AsyncClient en vez de la red real.
"""
import pytest


class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.content = b"1"

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """
    Sustituye httpx.AsyncClient dentro de app.routers.auth. El email
    codifica el resultado esperado de Supabase:
      "valid@..."          -> 200 con access_token/refresh_token de prueba
      cualquier otro valor -> 400 (credenciales inválidas)
    El refresh_token "refresh-valido" siempre renueva con éxito.
    """
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, headers=None):
        if "grant_type=password" in url:
            email = (json or {}).get("email", "")
            if email.startswith("valid"):
                return _FakeResponse(200, {
                    "access_token": "fake-access-token",
                    "refresh_token": "refresh-valido",
                    "expires_in": 3600,
                })
            return _FakeResponse(400, {"error_description": "Invalid login credentials"})

        if "grant_type=refresh_token" in url:
            token = (json or {}).get("refresh_token")
            if token == "refresh-valido":
                return _FakeResponse(200, {
                    "access_token": "fake-access-token-renovado",
                    "refresh_token": "refresh-valido",
                    "expires_in": 3600,
                })
            return _FakeResponse(400, {"error_description": "Invalid Refresh Token"})

        return _FakeResponse(404, {})


@pytest.fixture
def mock_supabase(monkeypatch):
    monkeypatch.setattr("app.routers.auth.httpx.AsyncClient", _FakeAsyncClient)


def test_login_credenciales_validas_devuelve_access_token(client, mock_supabase):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "valid.admin@test.cl", "password": "cualquiera"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] == "fake-access-token"
    assert data["refresh_token"] == "refresh-valido"
    assert data["token_type"] == "bearer"


def test_login_credenciales_invalidas_da_401(client, mock_supabase):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "inexistente@test.cl", "password": "mala"},
    )
    assert resp.status_code == 401
    assert "credenciales" in resp.json()["detail"].lower() or resp.json()["detail"]


def test_refresh_token_valido_renueva_sesion(client, mock_supabase):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "refresh-valido"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "fake-access-token-renovado"


def test_refresh_token_invalido_da_401(client, mock_supabase):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "basura"})
    assert resp.status_code == 401
