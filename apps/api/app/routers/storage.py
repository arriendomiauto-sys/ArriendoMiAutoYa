from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, status, Depends
from app.services.storage import StorageService
from app.models.entities import Usuario
from app.services.auth import get_current_user
from app.core.limiter import limiter

router = APIRouter(prefix="/storage", tags=["Almacenamiento de Archivos (Supabase / Local)"])

@router.post("/upload", summary="Sube una foto o documento a Supabase Storage o servidor local")
@limiter.limit("20/minute")
async def subir_archivo(
    request: Request,
    file: UploadFile = File(..., description="Archivo de imagen (JPG, PNG, WebP)"),
    bucket: str = Form("general", description="Bucket: autos, documentos-kyc, checklists, evidencias, general"),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Recibe un archivo multipart, lo sube al bucket de Supabase Storage correspondiente
    y retorna la URL del archivo (pública para autos/general, firmada y de corta
    duración para buckets con datos sensibles). Requiere sesión autenticada.
    Si Supabase no está configurado, usa almacenamiento local de respaldo.
    """
    contenido = await file.read()
    if not contenido:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo enviado está vacío.")

    resultado = StorageService.subir_archivo(
        contenido_bytes=contenido,
        nombre_original=file.filename or "archivo.jpg",
        content_type=file.content_type or "image/jpeg",
        bucket=bucket,
        base_url=str(request.base_url),
    )

    if not resultado.get("success"):
        if resultado.get("validation_error"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=resultado.get("error"))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar subida de archivo: {resultado.get('error')}"
        )

    return resultado

@router.get("/{bucket}/{archivo_id}/renovar", summary="Renueva la URL firmada de un documento en un bucket privado")
def renovar_url(
    bucket: str,
    archivo_id: str,
    current_user: Usuario = Depends(get_current_user),
):
    """
    Las URLs firmadas de documentos-kyc/checklists/evidencias expiran a los 7
    días. Este endpoint (requiere sesión) genera una URL vigente nueva para
    quien ya conozca el bucket+nombre de archivo exactos.
    """
    url = StorageService.renovar_url_firmada(bucket, archivo_id)
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El bucket indicado no es privado o no admite renovación.")
    return {"url": url}
