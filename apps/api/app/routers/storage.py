from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.storage import StorageService

router = APIRouter(prefix="/storage", tags=["Almacenamiento de Archivos (Supabase / Local)"])

@router.post("/upload", summary="Sube una foto o documento a Supabase Storage o servidor local")
async def subir_archivo(
    file: UploadFile = File(..., description="Archivo de imagen (JPG, PNG, WebP)"),
    bucket: str = Form("general", description="Bucket: autos, documentos-kyc, checklists, evidencias, general")
):
    """
    Recibe un archivo multipart, lo sube al bucket de Supabase Storage correspondiente
    y retorna la URL pública del archivo. Si Supabase no está configurado, usa almacenamiento local de respaldo.
    """
    contenido = await file.read()
    if not contenido:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo enviado está vacío.")

    resultado = StorageService.subir_archivo(
        contenido_bytes=contenido,
        nombre_original=file.filename or "archivo.jpg",
        content_type=file.content_type or "image/jpeg",
        bucket=bucket
    )

    if not resultado.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar subida de archivo: {resultado.get('error')}"
        )

    return resultado
