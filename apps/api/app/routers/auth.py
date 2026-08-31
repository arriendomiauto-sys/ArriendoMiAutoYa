"""
Proxy de autenticación contra Supabase Auth.

Existe para que clientes que no deben tener las credenciales de Supabase
(URL + anon key) — por ejemplo un panel administrativo aparte — puedan
loguearse hablando solo con esta API. El intercambio email/password (y el
refresh) ocurre acá, del lado del servidor, con las credenciales que la API
ya tiene en su propia configuración; el cliente solo recibe el access_token
resultante, igual que si hubiera llamado a Supabase directamente.
"""
from fastapi import APIRouter, HTTPException, Request, status
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


@router.post("/login", response_model=TokenOut, summary="Login (email/password) — devuelve el access_token de Supabase")
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest):
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

    return _token_response(data)


@router.post("/refresh", response_model=TokenOut, summary="Renovar el access_token vencido con el refresh_token")
async def refresh(payload: RefreshRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
            json={"refresh_token": payload.refresh_token},
            headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        )

    data = resp.json() if resp.content else {}
    if resp.status_code != 200 or "access_token" not in data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada. Vuelve a iniciar sesión.",
        )

    return _token_response(data)
