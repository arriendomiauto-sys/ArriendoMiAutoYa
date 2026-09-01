"""
Middleware para limitar el tamaño de las peticiones HTTP (Anti-DoS / Payload Too Large).
Protege la memoria del servidor evitando subidas masivas no autorizadas.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi import status

# Límites máximos permitidos en bytes
MAX_JSON_REQUEST_SIZE = 2 * 1024 * 1024       # 2 MB para endpoints JSON estándar
MAX_UPLOAD_REQUEST_SIZE = 10 * 1024 * 1024    # 10 MB para subida de archivos (/storage/upload)

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        
        if content_length:
            try:
                length_int = int(content_length)
                is_upload = request.url.path.endswith("/storage/upload") or "/storage/upload" in request.url.path
                max_allowed = MAX_UPLOAD_REQUEST_SIZE if is_upload else MAX_JSON_REQUEST_SIZE
                
                if length_int > max_allowed:
                    limit_mb = max_allowed // (1024 * 1024)
                    return JSONResponse(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE") else 413,
                        content={
                            "detail": f"El tamaño de la petición ({length_int / (1024*1024):.2f} MB) excede el límite permitido ({limit_mb} MB)."
                        }
                    )
            except ValueError:
                pass
                
        return await call_next(request)
