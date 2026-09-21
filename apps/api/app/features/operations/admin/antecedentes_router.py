"""
Cola del ejecutivo para los certificados de antecedentes.

Un certificado correcto llega acá con `contenido_ok=True`: lo único que falta es confirmar el folio
y el código de verificación en registrocivil.cl (ese sitio rechaza las consultas automáticas, por
eso lo hace una persona). Ver `app/features/auth/background_checks/certificados.py`.
"""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.background_checks import certificados_service as svc
from app.features.operations.admin._guards import exigir_admin, exigir_admin_o_manager
from app.models.entities import Auto, CertificadoAntecedente, ConductorAdicional, Usuario

router = APIRouter()

URL_VERIFICACION = "https://www.registrocivil.cl/OficinaInternet/verificacion/verificacioncertificado.srcei"
URL_AUTOSEGURO = "https://www.autoseguro.gob.cl/"


class RevisionCertificado(BaseModel):
    accion: Literal["aprobar", "rechazar"]
    notas: Optional[str] = Field(None, max_length=500)


def _sujeto(db: Session, c: CertificadoAntecedente) -> dict:
    if c.sujeto_tipo == "usuario":
        u = db.query(Usuario).filter(Usuario.id == c.sujeto_id).first()
        return {"nombre": u.nombre if u else None, "detalle": u.email if u else None}
    if c.sujeto_tipo == "conductor_adicional":
        d = db.query(ConductorAdicional).filter(ConductorAdicional.id == c.sujeto_id).first()
        return {"nombre": d.nombre if d else None, "detalle": "Segundo conductor"}
    a = db.query(Auto).filter(Auto.id == c.sujeto_id).first()
    return {"nombre": f"{a.marca} {a.modelo}" if a else None, "detalle": a.patente if a else None}


@router.get("/antecedentes/pendientes", summary="Certificados que esperan revisión (Admin/Manager)")
def listar_pendientes(db: Session = Depends(get_db), _: Usuario = Depends(exigir_admin_o_manager)) -> List[dict]:
    certificados = (
        db.query(CertificadoAntecedente)
        .filter(CertificadoAntecedente.estado == "revision")
        .order_by(CertificadoAntecedente.creado_en)
        .all()
    )
    salida = []
    for c in certificados:
        sujeto = _sujeto(db, c)
        salida.append({
            "id": c.id, "tipo": c.tipo, "sujeto_tipo": c.sujeto_tipo, "sujeto_id": c.sujeto_id,
            "sujeto_nombre": sujeto["nombre"], "sujeto_detalle": sujeto["detalle"],
            "rut_detectado": c.rut_detectado, "patente_detectada": c.patente_detectada,
            "folio": c.folio, "codigo_verificacion": c.codigo_verificacion,
            "emitido_en": c.emitido_en.isoformat() if c.emitido_en else None,
            "contenido_ok": bool(c.contenido_ok), "motivo": c.motivo, "hallazgos": c.resultado_json or {},
            "archivo_url": c.archivo_url, "url_verificacion": URL_VERIFICACION,
            "creado_en": c.creado_en.isoformat() if c.creado_en else None,
        })
    return salida


@router.post("/antecedentes/{certificado_id}/revisar", summary="Aprobar o rechazar un certificado (solo Admin)")
def revisar(
    certificado_id: str,
    payload: RevisionCertificado,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
) -> dict:
    certificado = db.query(CertificadoAntecedente).filter(CertificadoAntecedente.id == certificado_id).first()
    if not certificado:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    try:
        certificado = svc.revisar_certificado(db, certificado, admin, payload.accion, payload.notas)
    except svc.CertificadoError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    return {"id": certificado.id, "estado": certificado.estado}


class ResultadoEncargoRobo(BaseModel):
    resultado: Literal["sin_encargo", "con_encargo"]
    notas: Optional[str] = Field(None, max_length=500)


@router.post("/autos/{auto_id}/encargo-robo", summary="Registrar el resultado de la consulta en AutoSeguro (solo Admin)")
def registrar_encargo_robo(
    auto_id: str,
    payload: ResultadoEncargoRobo,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
) -> dict:
    """
    autoseguro.gob.cl no tiene API pública: el ejecutivo consulta la patente y deja aquí
    el resultado y la fecha. Un encargo por robo pausa el auto.
    """
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    auto.encargo_robo_estado = payload.resultado
    auto.encargo_robo_consultado_en = datetime.now(timezone.utc)
    auto.encargo_robo_consultado_por = admin.id
    if payload.resultado == "con_encargo":
        auto.estado = "pausado"
        from app.features.communications.notifications.service import crear_notificacion

        crear_notificacion(
            db, usuario_id=auto.dueno_id, tipo="kyc", titulo="Tu auto fue pausado",
            mensaje="Detectamos un encargo por robo asociado a la patente. Contacta a soporte.",
            entidad_tipo="auto", entidad_id=auto.id, commit=False,
        )
    db.commit()
    return {
        "id": auto.id, "encargo_robo_estado": auto.encargo_robo_estado,
        "estado": auto.estado, "url_autoseguro": URL_AUTOSEGURO,
    }

