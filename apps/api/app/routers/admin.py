from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Pago, Reserva, Usuario, Disputa, Auto, Sucursal, ConfiguracionPlataforma
from app.schemas.schemas import UserOut, DocumentReviewRequest, PlatformConfigOut, PlatformConfigUpdate
from app.services.pricing import PricingService
from app.services.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Panel Admin & Financiero"])

@router.get("/configuracion", response_model=PlatformConfigOut, summary="Obtener configuración dinámica de la plataforma (RF-33)")
def obtener_configuracion_plataforma(db: Session = Depends(get_db)):
    config = db.query(ConfiguracionPlataforma).first()
    if not config:
        config = ConfiguracionPlataforma(
            id="default",
            valor_uf_clp=38000.0,
            comision_plataforma_pct=20.0,
            hold_enrolamiento_clp=800000,
            cargo_limpieza_estandar_clp=15000,
            cargo_limpieza_profunda_clp=35000,
            cargo_combustible_cuarto_clp=15000,
            cargo_km_extra_clp=120,
            km_diarios_incluidos=250,
            periodo_gracia_minutos=30
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/configuracion", response_model=PlatformConfigOut, summary="Actualizar parámetros dinámicos de la plataforma (Admin RF-33)")
def actualizar_configuracion_plataforma(
    payload: PlatformConfigUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo administradores pueden modificar parámetros de plataforma."
        )

    config = db.query(ConfiguracionPlataforma).first()
    if not config:
        config = ConfiguracionPlataforma(id="default")
        db.add(config)

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(config, field, value)

    config.actualizado_por_id = current_user.id
    db.commit()
    db.refresh(config)
    return config

@router.get("/deducible-info", summary="Información del cálculo de deducible de seguros (15 UF, 50/50)")
def obtener_deducible_info(db: Session = Depends(get_db)):
    """
    Retorna el desglose del seguro conforme a la regla de negocio:
    Deducible 15 UF dividido 50% empresa y 50% dueño.
    """
    return PricingService.calcular_deducible_seguro(db)

@router.get("/panel-financiero", summary="Resumen financiero global (holds, liquidaciones, cobros)")
def obtener_panel_financiero(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin.")
    pagos = db.query(Pago).all()
    
    total_holds_capturados = sum(p.monto for p in pagos if "hold" in p.tipo and p.estado == "capturado")
    total_cobros_finales = sum(p.monto for p in pagos if p.tipo == "cobro_final" and p.estado == "capturado")
    total_liquidaciones_pendientes = sum(p.monto for p in pagos if p.tipo == "liquidacion_dueno" and p.estado == "pendiente")
    total_liquidaciones_pagadas = sum(p.monto for p in pagos if p.tipo == "liquidacion_dueno" and p.estado == "pagado")

    return {
        "total_holds_capturados_clp": total_holds_capturados,
        "total_cobros_finales_clp": total_cobros_finales,
        "total_liquidaciones_pendientes_clp": total_liquidaciones_pendientes,
        "total_liquidaciones_pagadas_clp": total_liquidaciones_pagadas,
        "cantidad_transacciones": len(pagos)
    }

@router.get("/metricas-globales", summary="Métricas operativas de la plataforma")
def obtener_metricas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin.")
    return {
        "total_usuarios": db.query(Usuario).count(),
        "total_autos_activos": db.query(Auto).filter(Auto.estado == "activo").count(),
        "total_reservas": db.query(Reserva).count(),
        "total_disputas_abiertas": db.query(Disputa).filter(Disputa.estado == "abierta").count()
    }

@router.get("/documentos/pendientes", response_model=List[UserOut], summary="Listar usuarios con documentos que requieren revisión manual (Admin/Manager RF-27)")
def listar_documentos_pendientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Devuelve los usuarios con score de confianza OCR bajo (< 80%) o inconsistencias para revisión humana.
    Contiene datos personales (RUT, teléfono) — solo Admin o Manager.
    """
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin o Manager.")
    return db.query(Usuario).filter(Usuario.estado_documentos == "requiere_revision_manual").all()

@router.post("/documentos/{usuario_id}/revisar", response_model=UserOut, summary="Aprobar o rechazar manualmente documentos de enrolamiento (Admin exclusivo RF-31)")
def revisar_documentos_usuario(
    usuario_id: str,
    payload: DocumentReviewRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo el Administrador tiene facultad para aprobar o rechazar documentos (RF-31). El Manager solo tiene permiso de visualización (RF-27)."
        )

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.accion == "aprobar":
        usuario.estado_documentos = "verificado"
        usuario.notas_auditoria = f"[Aprobado por Admin {current_user.nombre}]: {payload.notas}"
    else:
        usuario.estado_documentos = "rechazado"
        usuario.notas_auditoria = f"[Rechazado por Admin {current_user.nombre}]: {payload.notas}"

    db.commit()
    db.refresh(usuario)
    return usuario
