"""
Endpoints de la verificación de antecedentes con certificados oficiales del Registro Civil.

La persona descarga gratis su certificado de antecedentes y su hoja de vida del conductor
(con ClaveÚnica) y los sube como PDF. Estos endpoints reciben el ARCHIVO (no una URL que
mande el cliente), lo guardan en un bucket privado y lo analizan; ver `certificados_service`.
Son sync a propósito: la lectura del archivo y las consultas a la BD corren en el
threadpool y no bloquean el event loop.
"""
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.features.auth.background_checks import certificados_service as svc
from app.features.auth.login.service import get_current_user
from app.features.system.storage.service import StorageService
from app.models.entities import Auto, CertificadoAntecedente, ConductorAdicional, Reserva, Usuario

router = APIRouter(tags=["Antecedentes (certificados oficiales)"])

TipoPersona = Literal["antecedentes", "hoja_vida"]


class CertificadoOut(BaseModel):
    """Lo que ve la persona de su certificado: nunca el folio ni el código de verificación."""
    id: str
    tipo: str
    estado: str
    motivo: Optional[str] = None
    emitido_en: Optional[str] = None
    creado_en: Optional[str] = None


def _serializar(c: CertificadoAntecedente) -> CertificadoOut:
    return CertificadoOut(
        id=c.id, tipo=c.tipo, estado=c.estado, motivo=c.motivo,
        emitido_en=c.emitido_en.isoformat() if c.emitido_en else None,
        creado_en=c.creado_en.isoformat() if c.creado_en else None,
    )


def _guardar_y_registrar(
    request: Request, db: Session, subido_por: Usuario, archivo: UploadFile, *,
    sujeto_tipo: str, sujeto_id: str, tipo: str, consentimiento: bool, rut_esperado: Optional[str],
    patente_esperada: Optional[str] = None,
) -> CertificadoAntecedente:
    # El consentimiento se comprueba ANTES de guardar nada: sin él no se toca el archivo.
    if not consentimiento:
        raise HTTPException(400, svc.CertificadoError(
            400, "CONSENTIMIENTO_REQUERIDO",
            "Necesitamos tu consentimiento para revisar este certificado: contiene datos personales sensibles.",
        ).as_detail())

    contenido = archivo.file.read(StorageService.TAMANO_MAXIMO_PDF_BYTES + 1)
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo enviado está vacío.")
    # Solo PDF: sin esto una foto renombrada a .pdf se guardaría como imagen.
    if not StorageService._es_pdf(contenido):
        raise HTTPException(
            status_code=400,
            detail="El archivo no es un PDF. Sube el certificado original descargado de registrocivil.cl (no una foto).",
        )

    guardado = StorageService.subir_archivo(
        contenido_bytes=contenido, nombre_original=archivo.filename or "certificado.pdf",
        content_type="application/pdf", bucket="documentos-kyc",
        base_url=str(request.base_url), permitir_pdf=True,
    )
    if not guardado.get("success"):
        if guardado.get("validation_error"):
            raise HTTPException(status_code=400, detail=guardado.get("error"))
        raise HTTPException(status_code=500, detail="No pudimos guardar el archivo. Intenta de nuevo.")

    try:
        return svc.registrar_certificado(
            db, sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id, tipo=tipo, pdf_bytes=contenido,
            archivo_url=guardado["url"], subido_por=subido_por, consentimiento=consentimiento,
            rut_esperado=rut_esperado, patente_esperada=patente_esperada,
        )
    except svc.CertificadoError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())


@router.post(
    "/antecedentes/certificados", response_model=CertificadoOut,
    summary="Sube tu certificado de antecedentes u hoja de vida del conductor (PDF del Registro Civil)",
)
@limiter.limit("10/minute")
def subir_certificado(
    request: Request,
    tipo: TipoPersona = Form(...),
    consentimiento: bool = Form(False),
    archivo: UploadFile = File(..., description="PDF descargado de registrocivil.cl con ClaveÚnica"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # El RUT contra el que se compara el certificado sale del KYC: sin identidad
    # verificada no hay un RUT confiable con el cual cotejarlo.
    if current_user.estado_documentos != "verificado" or not current_user.rut:
        raise HTTPException(status_code=403, detail="Verifica tu identidad antes de subir tus antecedentes.")

    certificado = _guardar_y_registrar(
        request, db, current_user, archivo, sujeto_tipo="usuario", sujeto_id=current_user.id,
        tipo=tipo, consentimiento=consentimiento, rut_esperado=current_user.rut,
    )
    return _serializar(certificado)


@router.get("/antecedentes/mi-estado", summary="Estado de tus antecedentes y de cada certificado")
def mi_estado(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    estado = svc.recalcular_estado_usuario(db, current_user)
    certificados = (
        db.query(CertificadoAntecedente)
        .filter(CertificadoAntecedente.sujeto_tipo == "usuario", CertificadoAntecedente.sujeto_id == current_user.id)
        .order_by(CertificadoAntecedente.creado_en)
        .all()
    )
    ultimos = {c.tipo: c for c in certificados}
    documentos = []
    for tipo in svc.TIPOS_PERSONA:
        c = ultimos.get(tipo)
        if c is None:
            documentos.append({"tipo": tipo, "estado": "sin_subir", "motivo": None,
                               "subido_en": None, "vence_en": None})
            continue
        aprobado_en = c.revisado_en if c.estado == "aprobado" else None
        documentos.append({
            "tipo": tipo, "estado": c.estado, "motivo": c.motivo,
            "subido_en": c.creado_en.isoformat() if c.creado_en else None,
            "vence_en": (aprobado_en + timedelta(days=settings.ANTECEDENTES_REVERIFICACION_DIAS)).isoformat()
            if aprobado_en else None,
        })
    return {"estado": estado, "obligatorio": settings.ANTECEDENTES_OBLIGATORIOS, "documentos": documentos}


@router.post(
    "/reservas/{reserva_id}/segundo-conductor/certificados", response_model=CertificadoOut,
    summary="El titular sube el certificado de antecedentes u hoja de vida de su segundo conductor",
)
@limiter.limit("10/minute")
def subir_certificado_segundo_conductor(
    request: Request,
    reserva_id: str,
    tipo: TipoPersona = Form(...),
    consentimiento: bool = Form(False),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede subir estos documentos.")
    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva_id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor.")
    if not conductor.rut:
        raise HTTPException(status_code=400, detail="El segundo conductor no tiene RUT registrado.")

    certificado = _guardar_y_registrar(
        request, db, current_user, archivo, sujeto_tipo="conductor_adicional", sujeto_id=conductor.id,
        tipo=tipo, consentimiento=consentimiento, rut_esperado=conductor.rut,
    )
    return _serializar(certificado)


@router.post(
    "/autos/{auto_id}/certificado-anotaciones", response_model=CertificadoOut,
    summary="El dueño sube el certificado de anotaciones vigentes de su auto (PDF del Registro Civil)",
)
@limiter.limit("10/minute")
def subir_certificado_anotaciones(
    request: Request,
    auto_id: str,
    consentimiento: bool = Form(False),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    if auto.dueno_id != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el dueño del vehículo puede subir este documento.")

    certificado = _guardar_y_registrar(
        request, db, current_user, archivo, sujeto_tipo="auto", sujeto_id=auto.id,
        tipo="anotaciones_vigentes", consentimiento=consentimiento,
        rut_esperado=current_user.rut, patente_esperada=auto.patente,
    )
    return _serializar(certificado)
