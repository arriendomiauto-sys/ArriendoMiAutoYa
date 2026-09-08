from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Pago, Reserva, Usuario, Disputa, Auto, Sucursal, ConfiguracionPlataforma
from app.schemas.schemas import (
    UserOut, DocumentReviewRequest, PlatformConfigOut, PlatformConfigUpdate,
    AutoPendienteKycOut, AutoDocumentosReviewRequest,
)
from app.services.pricing import PricingService
from app.services.auth import get_current_user
from app.services.storage import StorageService

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
            periodo_gracia_minutos=30,
            dias_cobro_posterior_peajes=60,
            edad_minima_arriendo=21
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/configuracion", response_model=PlatformConfigOut, summary="Actualizar parámetros dinámicos de la plataforma (RF-33)")
def actualizar_configuracion_plataforma(
    payload: PlatformConfigUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo el Administrador puede modificar los parámetros de la plataforma (RF-33)."
        )
    config = db.query(ConfiguracionPlataforma).first()
    if not config:
        config = ConfiguracionPlataforma(id="default")
        db.add(config)

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, val)

    db.commit()
    db.refresh(config)
    return config

@router.get("/tarifa-seguro", summary="Obtener el cálculo del deducible de seguro")
def obtener_tarifa_seguro(db: Session = Depends(get_db)):
    """
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

@router.get("/flota-sucursal", summary="Listar la flota de la sucursal del Manager (Admin/Manager)")
def listar_flota_sucursal(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin o Manager.")

    query = db.query(Auto).join(Usuario, Auto.dueno_id == Usuario.id)
    if "admin" not in roles:
        query = query.filter(Usuario.sucursal_id == current_user.sucursal_id)

    return [
        {
            "id": auto.id,
            "marca": auto.marca,
            "modelo": auto.modelo,
            "anio": auto.anio,
            "patente": auto.patente,
            "tarifa_dia": auto.tarifa_dia,
            "estado": auto.estado,
            "ubicacion_base": auto.ubicacion_base,
            "dueno_nombre": auto.dueno.nombre if auto.dueno else None,
            "dueno_rut": auto.dueno.rut if auto.dueno else None,
        }
        for auto in query.all()
    ]

@router.get("/documentos/pendientes", response_model=List[UserOut], summary="Listar usuarios con documentos que requieren revisión manual (Admin/Manager RF-27)")
def listar_documentos_pendientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Devuelve los usuarios con score de confianza OCR bajo (< 80%), en revisión manual o pendientes.
    Contiene datos personales (RUT, teléfono) — solo Admin o Manager.
    """
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin o Manager.")
    
    usuarios = db.query(Usuario).filter(
        (Usuario.estado_documentos.in_(["requiere_revision_manual", "pendiente", "rechazado"])) |
        (Usuario.confianza_ocr < 0.8) |
        (Usuario.licencia_estado.in_(["revision", "pendiente"]))
    ).all()

    hubo_cambios = False
    for u in usuarios:
        if u.foto_perfil_verificada_url:
            renovada = StorageService.renovar_si_vence_pronto(u.foto_perfil_verificada_url)
            if renovada and renovada != u.foto_perfil_verificada_url:
                u.foto_perfil_verificada_url = renovada
                hubo_cambios = True
        if getattr(u, "foto_perfil_url", None):
            renovada = StorageService.renovar_si_vence_pronto(u.foto_perfil_url)
            if renovada and renovada != u.foto_perfil_url:
                u.foto_perfil_url = renovada
                hubo_cambios = True
    if hubo_cambios:
        db.commit()

    return usuarios

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
        usuario.licencia_estado = "verificada"
        usuario.notas_auditoria = f"[Aprobado por Admin {current_user.nombre}]: {payload.notas}"
    else:
        usuario.estado_documentos = "rechazado"
        usuario.licencia_estado = "rechazada"
        usuario.notas_auditoria = f"[Rechazado por Admin {current_user.nombre}]: {payload.notas}"

    db.commit()
    db.refresh(usuario)

    from app.services.notificaciones import crear_notificacion
    crear_notificacion(
        db,
        usuario_id=usuario.id,
        tipo="kyc",
        titulo="Identidad verificada" if payload.accion == "aprobar" else "Necesitas corregir tus documentos",
        mensaje=(
            "Ya puedes reservar y publicar autos."
            if payload.accion == "aprobar"
            else f"{payload.notas} Revisa tus documentos desde tu perfil y vuelve a enviarlos."
        ),
        entidad_tipo="usuario",
        entidad_id=usuario.id,
    )

    return usuario

@router.get("/autos/documentos-pendientes", response_model=List[AutoPendienteKycOut], summary="Listar autos pendientes de revisión documental (Admin/Manager)")
def listar_autos_documentos_pendientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin o Manager.")

    autos = db.query(Auto).filter(Auto.documentos_verificados == False).all()
    resultado = []
    for a in autos:
        resultado.append(
            AutoPendienteKycOut(
                id=a.id,
                marca=a.marca,
                modelo=a.modelo,
                anio=a.anio,
                patente=a.patente,
                tarifa_dia=a.tarifa_dia,
                estado=a.estado,
                ubicacion_base=a.ubicacion_base,
                fotos=a.fotos or [],
                doc_inscripcion_url=a.doc_inscripcion_url,
                doc_permiso_circulacion_url=a.doc_permiso_circulacion_url,
                doc_soap_url=a.doc_soap_url,
                doc_revision_tecnica_url=a.doc_revision_tecnica_url,
                doc_seguro_url=a.doc_seguro_url,
                documentos_verificados=a.documentos_verificados or False,
                dueno_id=a.dueno_id,
                dueno_nombre=a.dueno.nombre if a.dueno else None,
                dueno_rut=a.dueno.rut if a.dueno else None,
                dueno_email=a.dueno.email if a.dueno else None,
                dueno_telefono=a.dueno.telefono if a.dueno else None,
            )
        )
    return resultado

@router.post("/autos/{auto_id}/revisar-documentos", response_model=AutoPendienteKycOut, summary="Aprobar o rechazar documentos del auto (Admin)")
def revisar_documentos_auto(
    auto_id: str,
    payload: AutoDocumentosReviewRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo el Administrador tiene facultad para aprobar o rechazar documentos de autos."
        )

    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    if payload.accion == "aprobar":
        auto.documentos_verificados = True
        auto.estado = "activo"
    else:
        auto.documentos_verificados = False
        auto.estado = "pausado"

    db.commit()
    db.refresh(auto)

    if auto.dueno_id:
        from app.services.notificaciones import crear_notificacion
        crear_notificacion(
            db,
            usuario_id=auto.dueno_id,
            tipo="auto_documentos",
            titulo="Documentos del vehículo aprobados" if payload.accion == "aprobar" else "Documentos del vehículo observados",
            mensaje=(
                f"Tu auto {auto.marca} {auto.modelo} ({auto.patente}) ya está verificado y disponible para arriendo."
                if payload.accion == "aprobar"
                else f"Los documentos de tu auto {auto.marca} {auto.modelo} ({auto.patente}) fueron observados: {payload.notas}. Por favor actualízalos."
            ),
            entidad_tipo="auto",
            entidad_id=auto.id,
        )

    return AutoPendienteKycOut(
        id=auto.id,
        marca=auto.marca,
        modelo=auto.modelo,
        anio=auto.anio,
        patente=auto.patente,
        tarifa_dia=auto.tarifa_dia,
        estado=auto.estado,
        ubicacion_base=auto.ubicacion_base,
        fotos=auto.fotos or [],
        doc_inscripcion_url=auto.doc_inscripcion_url,
        doc_permiso_circulacion_url=auto.doc_permiso_circulacion_url,
        doc_soap_url=auto.doc_soap_url,
        doc_revision_tecnica_url=auto.doc_revision_tecnica_url,
        doc_seguro_url=auto.doc_seguro_url,
        documentos_verificados=auto.documentos_verificados or False,
        dueno_id=auto.dueno_id,
        dueno_nombre=auto.dueno.nombre if auto.dueno else None,
        dueno_rut=auto.dueno.rut if auto.dueno else None,
        dueno_email=auto.dueno.email if auto.dueno else None,
        dueno_telefono=auto.dueno.telefono if auto.dueno else None,
    )
