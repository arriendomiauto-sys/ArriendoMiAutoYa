from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.limiter import limiter
from app.features.auth.login.service import get_current_user
from app.features.operations.siniestros import service
from app.models.entities import Auto, Reserva, Siniestro, Usuario
from app.schemas.schemas import SiniestroCreate, SiniestroMensaje, SiniestroOut

router = APIRouter(tags=["Siniestros"])


def _siniestro_o_404(db: Session, siniestro_id: str) -> Siniestro:
    siniestro = db.query(Siniestro).filter(Siniestro.id == siniestro_id).first()
    if not siniestro:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return siniestro


@router.post("/reservas/{reserva_id}/siniestro", response_model=SiniestroOut, summary="El arrendatario reporta un accidente")
@limiter.limit("5/minute")
def reportar_siniestro(
    request: Request,
    reserva_id: str,
    payload: SiniestroCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).with_for_update().first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    siniestro = service.reportar(db, reserva, current_user, payload)
    db.commit()
    db.refresh(siniestro)
    return service.a_salida(db, siniestro)


@router.get("/reservas/{reserva_id}/siniestro", response_model=SiniestroOut, summary="Último accidente reportado en la reserva")
def ver_siniestro(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    es_parte = current_user.id in (reserva.cliente_id, auto.dueno_id if auto else None)
    if not es_parte and not service.es_soporte(current_user):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta reserva.")
    siniestro = (
        db.query(Siniestro).filter(Siniestro.reserva_id == reserva_id).order_by(Siniestro.creado_en.desc()).first()
    )
    if not siniestro:
        raise HTTPException(status_code=404, detail="No hay accidentes reportados en esta reserva.")
    salida = service.a_salida(db, siniestro, para_soporte=service.es_soporte(current_user))
    db.commit()
    return salida


# --------------------------------------------------------------------------- #
# Soporte 24/7
# --------------------------------------------------------------------------- #
@router.get("/soporte/siniestros", response_model=List[SiniestroOut], summary="Bandeja de accidentes (Soporte)")
def listar_siniestros(
    estado: Optional[str] = Query(None, description="reportado, en_atencion o cerrado. Por defecto, los abiertos."),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service.requerir_soporte(current_user)
    consulta = db.query(Siniestro)
    consulta = consulta.filter(Siniestro.estado == estado) if estado else consulta.filter(Siniestro.estado != "cerrado")
    salida = [service.a_salida(db, s, para_soporte=True) for s in consulta.order_by(Siniestro.creado_en.desc()).all()]
    db.commit()
    return salida


@router.post("/soporte/siniestros/{siniestro_id}/atender", response_model=SiniestroOut, summary="Tomar el caso (Soporte)")
def atender_siniestro(
    siniestro_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service.requerir_soporte(current_user)
    siniestro = service.atender(db, _siniestro_o_404(db, siniestro_id), current_user)
    db.commit()
    db.refresh(siniestro)
    return service.a_salida(db, siniestro, para_soporte=True)


@router.post(
    "/soporte/siniestros/{siniestro_id}/dueno-contactado",
    response_model=SiniestroOut,
    summary="Registrar que soporte habló con el dueño (Soporte)",
)
def dueno_contactado(
    siniestro_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service.requerir_soporte(current_user)
    siniestro = service.marcar_dueno_contactado(_siniestro_o_404(db, siniestro_id), current_user)
    db.commit()
    db.refresh(siniestro)
    return service.a_salida(db, siniestro, para_soporte=True)


@router.post(
    "/soporte/siniestros/{siniestro_id}/informar",
    response_model=SiniestroOut,
    summary="Informar por escrito a ambas partes (Soporte)",
)
def informar_siniestro(
    siniestro_id: str,
    payload: SiniestroMensaje,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service.requerir_soporte(current_user)
    siniestro = _siniestro_o_404(db, siniestro_id)
    if siniestro.estado == "cerrado":
        raise HTTPException(status_code=409, detail="El caso ya está cerrado.")
    service.informar_a_ambas_partes(db, siniestro, f"Novedades del caso {siniestro.codigo}", payload.mensaje)
    db.commit()
    db.refresh(siniestro)
    return service.a_salida(db, siniestro, para_soporte=True)


@router.post("/soporte/siniestros/{siniestro_id}/cerrar", response_model=SiniestroOut, summary="Cerrar el caso (Soporte)")
def cerrar_siniestro(
    siniestro_id: str,
    payload: SiniestroMensaje,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    service.requerir_soporte(current_user)
    siniestro = service.cerrar(db, _siniestro_o_404(db, siniestro_id), payload.mensaje)
    db.commit()
    db.refresh(siniestro)
    return service.a_salida(db, siniestro, para_soporte=True)
