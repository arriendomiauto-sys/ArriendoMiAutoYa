"""
Pruebas de POST /auth/login, /auth/refresh y /auth/logout (el proxy de auth
contra Supabase que usa el panel admin). Se ejercita la lógica real, pero
contra un doble de httpx.AsyncClient en vez de la red real.

Contracto JSON intacto (compat móvil): todas las respuestas siguen llevando
access_token/refresh_token en el body. Las cookies httpOnly son un
complemento para el panel admin — la cookie no debe violar el JSON.
"""
import pytest

from app.core.config import settings


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
    El refresh_token "refresh-valido" siempre renueva con éxito y rota a
    "refresh-valido-nuevo"; cualquier otro valor da 400.
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
                    "refresh_token": "refresh-valido-nuevo",
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


def test_login_setea_cookie_refresh_httponly(client, mock_supabase, monkeypatch):
    # En producción la cookie va con SameSite=None + Secure: así viaja
    # cross-site (admin.arriendomiautoya.cl -> arriendomiautoya.onrender.com)
    # sin dejar de ser httpOnly (ilegible por JS).
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "valid.admin@test.cl", "password": "cualquiera"},
    )
    assert resp.status_code == 200
    sc = resp.headers.get("set-cookie", "")
    assert "refresh_token=refresh-valido" in sc
    assert "HttpOnly" in sc
    assert "SameSite=none" in sc
    assert "Secure" in sc
    assert "Max-Age=" in sc
    # El JSON sigue intacto para la app móvil.
    assert resp.json()["refresh_token"] == "refresh-valido"
    # La cookie acortada en dev (http) no exige Secure: no rompe la sesión
    # local, solo evita que el navegador la rechace por falta de "Secure".
    resp_dev = client.post(
        "/api/v1/auth/login",
        json={"email": "valid.admin@test.cl", "password": "cualquiera"},
    )
    assert "Max-Age=" in resp_dev.headers.get("set-cookie", "")


def test_login_credenciales_invalidas_da_401(client, mock_supabase):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "inexistente@test.cl", "password": "mala"},
    )
    assert resp.status_code == 401
    assert "credenciales" in resp.json()["detail"].lower() or resp.json()["detail"]


def test_refresh_token_valido_renueva_sesion(client, mock_supabase):
    # Camino móvil: el refresh token va en el body y la cookie se setea igual
    # como complemento (backward compat con el contrato JSON).
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "refresh-valido"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "fake-access-token-renovado"
    assert "refresh_token=refresh-valido-nuevo" in resp.headers.get("set-cookie", "")


def test_refresh_por_cookie_admin(client, mock_supabase):
    # Camino panel admin: el body no lleva refresh_token; el navegador manda
    # la cookie httpOnly que la API seteo en login.
    resp = client.post(
        "/api/v1/auth/refresh",
        json={},
        cookies={"refresh_token": "refresh-valido"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "fake-access-token-renovado"
    # Rotación: la cookie se re-emite con el refresh token nuevo.
    assert "refresh_token=refresh-valido-nuevo" in resp.headers.get("set-cookie", "")


def test_refresh_prefiere_cookie_cuando_el_body_viene_vacio(client, mock_supabase):
    # El panel manda body vacío + cookie; si hubiera un refresh_token en el
    # body la API lo usa (móvil), y si no, cae a la cookie.
    resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": None},
        cookies={"refresh_token": "refresh-valido"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "fake-access-token-renovado"


def test_refresh_sin_cookie_ni_body_da_401(client, mock_supabase):
    resp = client.post("/api/v1/auth/refresh", json={})
    assert resp.status_code == 401


def test_refresh_token_invalido_da_401(client, mock_supabase):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "basura"})
    assert resp.status_code == 401


def test_logout_borra_la_cookie(client, mock_supabase):
    # El panel manda su access token en el logout para revocar la sesión del
    # lado de Supabase; la cookie httpOnly se borra en cualquier caso.
    client.cookies.set("refresh_token", "refresh-valido")
    resp = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": "Bearer fake-access-token"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    sc = resp.headers.get("set-cookie", "").lower()
    assert "max-age=0" in sc or "expires=" in sc
