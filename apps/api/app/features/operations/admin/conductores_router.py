"""
Revisión del segundo conductor en el panel. Antes no tenía ningún camino: sus documentos y fotos
(carnet, licencia, selfie) nunca llegaban al admin y su KYC en "requiere_revision_manual" no lo
resolvía nadie.
"""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.background_checks import certificados_service
from app.features.communications.notifications.service import crear_notificacion
from app.features.operations.admin._guards import exigir_admin, exigir_admin_o_manager
from app.features.system.storage.service import StorageService
from app.models.entities import Auto, ConductorAdicional, Reserva, Usuario

router = APIRouter()

CAMPOS_IMAGEN = ("carnet_frontal_url", "carnet_trasero_url", "licencia_url", "selfie_url", "pic_url")


class RevisionConductor(BaseModel):
    accion: Literal["aprobar", "rechazar"]
    notas: Optional[str] = Field(None, max_length=500)


def _serializar(db: Session, c: ConductorAdicional) -> dict:
    reserva = db.query(Reserva).filter(Reserva.id == c.reserva_id).first()
    titular = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first() if reserva else None
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first() if reserva else None
    return {
        "id": c.id, "reserva_id": c.reserva_id, "nombre": c.nombre, "rut": c.rut,
        "numero_documento": c.numero_documento, "tipo_documento": c.tipo_documento,
        "email": c.email, "telefono": c.telefono,
        "carnet_frontal_url": c.carnet_frontal_url, "carnet_trasero_url": c.carnet_trasero_url,
        "licencia_url": c.licencia_url, "selfie_url": c.selfie_url, "pic_url": c.pic_url,
        "licencia_clase": c.licencia_clase, "licencia_numero": c.licencia_numero,
        "licencia_vencimiento": c.licencia_vencimiento.isoformat() if c.licencia_vencimiento else None,
        "fecha_nacimiento": c.fecha_nacimiento.isoformat() if c.fecha_nacimiento else None,
        "estado_kyc": c.estado_kyc, "antecedentes_estado": c.antecedentes_estado,
        "confianza_ocr": c.confianza_ocr, "notas_auditoria": c.notas_auditoria,
        "titular_id": titular.id if titular else None, "titular_nombre": titular.nombre if titular else None,
        "patente": auto.patente if auto else None,
        "auto": f"{auto.marca} {auto.modelo}" if auto else None,
    }


@router.get("/conductores/pendientes", summary="Segundos conductores que esperan revisión (Admin/Manager)")
def listar_conductores_pendientes(
    db: Session = Depends(get_db), _: Usuario = Depends(exigir_admin_o_manager),
) -> List[dict]:
    conductores = (
        db.query(ConductorAdicional)
        .filter(ConductorAdicional.estado_kyc == "requiere_revision_manual")
        .order_by(ConductorAdicional.creado_en)
        .all()
    )
    cambio = False
    for c in conductores:
        if StorageService.renovar_url_campos(c, CAMPOS_IMAGEN):
            cambio = True
    if cambio:
        db.commit()
    return [_serializar(db, c) for c in conductores]


@router.post("/conductores/{conductor_id}/revisar", summary="Aprobar o rechazar al segundo conductor (solo Admin)")
def revisar_conductor(
    conductor_id: str,
    payload: RevisionConductor,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
) -> dict:
    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == conductor_id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Conductor no encontrado")

    aprobar = payload.accion == "aprobar"
    conductor.estado_kyc = "verificado" if aprobar else "rechazado"
    marca = f"[{'Aprobado' if aprobar else 'Rechazado'} por Admin {admin.nombre}]: {payload.notas or ''}".strip()
    conductor.notas_auditoria = f"{conductor.notas_auditoria} | {marca}" if conductor.notas_auditoria else marca
    db.commit()

    # Un conductor recién verificado todavía no tiene antecedentes: queda "pendiente" hasta que suban sus certificados.
    certificados_service.recalcular_estado_conductor(db, conductor)

    reserva = db.query(Reserva).filter(Reserva.id == conductor.reserva_id).first()
    if reserva:
        crear_notificacion(
            db, usuario_id=reserva.cliente_id, tipo="kyc",
            titulo="Segundo conductor verificado" if aprobar else "Segundo conductor rechazado",
            mensaje=(
                f"{conductor.nombre} quedó verificado. Recuerda subir sus certificados de antecedentes."
                if aprobar
                else f"No pudimos verificar a {conductor.nombre}. {payload.notas or 'Revisa sus documentos y vuelve a enviarlos.'}"
            ),
            entidad_tipo="reserva", entidad_id=reserva.id,
        )
    return {"id": conductor.id, "estado_kyc": conductor.estado_kyc}
