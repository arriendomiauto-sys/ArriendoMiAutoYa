from typing import Optional
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, status, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.features.system.storage.service import StorageService
from app.models.entities import (
    CertificadoAntecedente,
    Usuario,
    Auto,
    Reserva,
    ChecklistAuto,
    ConductorAdicional,
    Disputa,
    VerificacionEntrega,
)
from app.features.auth.login.service import get_current_user, get_optional_current_user, autenticar_token
from app.core.database import get_db
from app.core.limiter import limiter

router = APIRouter(prefix="/storage", tags=["Almacenamiento de Archivos (Supabase / Local)"])


def _usuario_puede_ver_imagen_privada(
    db: Session, current_user: Usuario, bucket: str, archivo_id: str
) -> bool:
    """
    Autorización por dueño para las imágenes del respaldo local privado (los
    PDF de antecedentes ya se validaban aparte, ver más abajo). Antes, tener
    CUALQUIER sesión válida alcanzaba para ver el carnet/licencia/checklist de
    OTRO usuario si se conocía el archivo_id (UUID, difícil de adivinar pero
    no imposible de filtrar por otra vía — logs, capturas, etc.).
    """
    if {"admin", "manager"} & set(current_user.roles_activos or []):
        return True

    sufijo = f"/{bucket}/{archivo_id}"

    if bucket == "documentos-kyc":
        campos_usuario = [
            Usuario.carnet_frontal_url, Usuario.carnet_trasero_url, Usuario.licencia_url,
            Usuario.pic_url, Usuario.foto_perfil_url, Usuario.foto_perfil_verificada_url,
        ]
        propio = db.query(Usuario.id).filter(
            Usuario.id == current_user.id,
            or_(*[c.like(f"%{sufijo}") for c in campos_usuario]),
        ).first()
        if propio:
            return True

        # Documentos del segundo conductor de una reserva propia (arrendatario
        # que lo agregó, o dueño del auto reservado revisando su KYC).
        campos_conductor = [
            ConductorAdicional.carnet_frontal_url, ConductorAdicional.carnet_trasero_url,
            ConductorAdicional.licencia_url, ConductorAdicional.selfie_url, ConductorAdicional.pic_url,
        ]
        match = (
            db.query(ConductorAdicional.id)
            .join(Reserva, Reserva.id == ConductorAdicional.reserva_id)
            .join(Auto, Auto.id == Reserva.auto_id)
            .filter(
                or_(Reserva.cliente_id == current_user.id, Auto.dueno_id == current_user.id),
                or_(*[c.like(f"%{sufijo}") for c in campos_conductor]),
            )
            .first()
        )
        return bool(match)

    if bucket == "documentos-autos":
        campos_auto = [
            Auto.doc_inscripcion_url, Auto.doc_permiso_circulacion_url, Auto.doc_soap_url,
            Auto.doc_revision_tecnica_url, Auto.doc_certificado_gases_url,
            Auto.doc_historial_vehicular_url, Auto.doc_seguro_url, Auto.doc_anotaciones_vigentes_url,
        ]
        match = db.query(Auto.id).filter(
            Auto.dueno_id == current_user.id,
            or_(*[c.like(f"%{sufijo}") for c in campos_auto]),
        ).first()
        return bool(match)

    if bucket in ("checklists", "evidencias"):
        reservas_propias = (
            db.query(Reserva.id)
            .join(Auto, Auto.id == Reserva.auto_id)
            .filter(or_(Reserva.cliente_id == current_user.id, Auto.dueno_id == current_user.id))
        )
        if bucket == "checklists":
            for c in db.query(ChecklistAuto).filter(ChecklistAuto.reserva_id.in_(reservas_propias)):
                if c.selfie_entrega_url and sufijo in c.selfie_entrega_url:
                    return True
                if c.fotos and any(sufijo in (foto or "") for foto in c.fotos):
                    return True
            return False

        for d in db.query(Disputa).filter(Disputa.reserva_id.in_(reservas_propias)):
            if d.foto_evidencia_url and sufijo in d.foto_evidencia_url:
                return True
            if d.evidencia_fotos and any(sufijo in (f or "") for f in d.evidencia_fotos):
                return True
        verificacion = (
            db.query(VerificacionEntrega.id)
            .filter(
                VerificacionEntrega.reserva_id.in_(reservas_propias),
                VerificacionEntrega.foto_evidencia_url.like(f"%{sufijo}"),
            )
            .first()
        )
        return bool(verificacion)

    return False

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

@router.get("/local/{bucket}/{archivo_id}", summary="Sirve un archivo del respaldo local privado (requiere sesión)")
async def servir_archivo_local_privado(
    bucket: str,
    archivo_id: str,
    token: Optional[str] = Query(None, description="Token de sesión opcional para tags de imagen"),
    current_user: Optional[Usuario] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Entrega un archivo de un bucket privado que quedó en el respaldo local
    porque Supabase Storage no estaba disponible. Existe para que ese respaldo
    no tenga que publicarse como estático: /uploads sirve solo los buckets
    públicos, y esto exige sesión (vía header Authorization o query param token).
    """
    if not current_user:
        if token:
            current_user = await autenticar_token(token, db)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No autenticado para acceder al archivo privado.",
            )

    ruta = StorageService.leer_archivo_local_privado(bucket, archivo_id)
    if not ruta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado en el respaldo local privado.",
        )

    # Los PDF son certificados con datos personales sensibles (antecedentes): a diferencia de
    # una foto, solo los ve quien los subió o un ejecutivo, y siempre como descarga.
    if archivo_id.lower().endswith(".pdf"):
        if not ({"admin", "manager"} & set(current_user.roles_activos or [])):
            certificado = (
                db.query(CertificadoAntecedente)
                .filter(CertificadoAntecedente.archivo_url.like(f"%/{bucket}/{archivo_id}"))
                .first()
            )
            if not certificado or certificado.subido_por_id != current_user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este documento.")
        return FileResponse(
            ruta, media_type="application/pdf", filename=archivo_id, content_disposition_type="attachment"
        )

    if not _usuario_puede_ver_imagen_privada(db, current_user, bucket, archivo_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este archivo.")
    return FileResponse(ruta)


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
