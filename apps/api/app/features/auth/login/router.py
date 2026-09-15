"""
Proxy de autenticación contra Supabase Auth.

Existe para que clientes que no deben tener las credenciales de Supabase
(URL + anon key) — por ejemplo un panel administrativo aparte — puedan
loguearse hablando solo con esta API. El intercambio email/password (y el
refresh) ocurre acá, del lado del servidor, con las credenciales que la API
ya tiene en su propia configuración; el cliente solo recibe el access_token
resultante, igual que si hubiera llamado a Supabase directamente.
"""
from fastapi import APIRouter, HTTPException, Request, Response, status
import httpx

from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.schemas import LoginRequest, RefreshRequest, TokenOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])


def _token_response(data: dict) -> TokenOut:
    return TokenOut(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
    )


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    if not refresh_token:
        return
    # SameSite=None + Secure: el panel admin vive en un dominio distinto al de
    # la API (admin.arriendomiautoya.cl -> arriendomiautoya.onrender.com), así
    # que la cookie debe viajar cross-site. SameSite=None es inválido sin
    # Secure en navegadores modernos; Secure se enciende en producción (HTTPS)
    # y se apaga en desarrollo local para que la cookie sobreviva sobre http.
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="none",
        secure=settings.auth_cookie_secure,
        max_age=settings.REFRESH_TOKEN_COOKIE_MAX_AGE,
        path="/",
    )


def _delete_refresh_cookie(response: Response) -> None:
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, path="/")


@router.post("/login", response_model=TokenOut, summary="Login (email/password) — devuelve el access_token de Supabase")
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, response: Response):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
            json={"email": payload.email, "password": payload.password},
            headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )

    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or "access_token" not in data:
        detail = data.get("error_description") or data.get("msg") or "Email o contraseña incorrectos."
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

    # Complemento al contrato JSON (que NO se toca: la app móvil sigue leyendo
    # access_token/refresh_token del body): el panel admin recibe además el
    # refresh token en una cookie httpOnly que no puede leer el JS.
    _set_refresh_cookie(response, data.get("refresh_token"))
    return _token_response(data)


@router.post("/refresh", response_model=TokenOut, summary="Renovar el access_token vencido con el refresh_token")
async def refresh(payload: RefreshRequest, request: Request, response: Response):
    # La app móvil manda el refresh token en el body; el panel admin lo trae
    # en la cookie httpOnly (el navegador lo adjunta solo). Ambos caminos
    # coexisten y comparten la lógica de renovación.
    refresh_token = payload.refresh_token or request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada. Vuelve a iniciar sesión.",
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
            json={"refresh_token": refresh_token},
            headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )

    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or "access_token" not in data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada. Vuelve a iniciar sesión.",
        )

    # Rotación de la cookie: cada refresh entrega tokens nuevos, la cookie
    # debe seguir el paso para que nunca convivan una cookie vencida con un
    # access token recién emitido.
    _set_refresh_cookie(response, data.get("refresh_token"))
    return _token_response(data)


@router.post("/logout", summary="Cerrar sesión del panel: revoca la sesión en Supabase y borra la cookie httpOnly")
async def logout(request: Request, response: Response):
    # Best-effort: si el panel manda su access token (lo que sí puede leer el
    # JS), revocamos la sesión completa del lado de Supabase. Si el token ya
    # venció o hay un problema de red, igual se borra la cookie — el logout
    # local nunca debe depender de una llamada externa.
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer "):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/logout",
                    headers={
                        "Authorization": authorization,
                        "apikey": settings.SUPABASE_ANON_KEY,
                    },
                )
        except httpx.HTTPError:
            pass

    _delete_refresh_cookie(response)
    return {"ok": True}
