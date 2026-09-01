"""
Middleware de Cabeceras de Seguridad (OWASP / Defense-in-Depth).
Inyecta cabeceras HTTP de protección en todas las respuestas del backend.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # 1. Prevenir que el navegador adivine el tipo MIME (MIME sniffing)
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # 2. Prevenir Clickjacking bloqueando incrustación en iframes
        response.headers["X-Frame-Options"] = "DENY"
        
        # 3. Protección contra Cross-Site Scripting (XSS) en navegadores heredados
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # 4. HTTP Strict Transport Security (HSTS)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # 5. Política de control de referentes
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # 6. Content Security Policy (CSP) restrictiva
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https: blob:; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' https: data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        
        # 7. Permissions Policy (restringe APIs sensibles del navegador)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(self)"
        
        # 8. Ocultar huella del servidor
        if "server" in response.headers:
            del response.headers["server"]
        response.headers["Server"] = "ArriendaTuAuto-Protected"
        
        return response
