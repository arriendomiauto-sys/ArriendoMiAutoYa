from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Pago, Reserva, Usuario, Disputa, Auto, Sucursal, ConfiguracionPlataforma
from app.schemas.schemas import (
    UserOut, DocumentReviewRequest, PlatformConfigOut, PlatformConfigUpdate,
    AutoPendienteKycOut, AutoDocumentosReviewRequest,
)
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.auth.login.service import get_current_user
from app.features.system.storage.service import StorageService
from app.features.operations.admin.reservations_router import router as reservations_router
from app.features.operations.admin.users_router import router as users_router

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
            dias_cobro_posterior_peajes=30,
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
    # 'procesando' (transferencia BCI en vuelo) y 'fallido' (reintento pendiente)
    # siguen siendo plata que se le debe al dueño: cuentan como pendientes.
    total_liquidaciones_pendientes = sum(
        p.monto for p in pagos
        if p.tipo == "liquidacion_dueno" and p.estado in ("pendiente", "procesando", "fallido")
    )
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

    from app.features.communications.notifications.service import crear_notificacion
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
        from app.features.communications.notifications.service import crear_notificacion
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


def _solo_admin(current_user: Usuario) -> None:
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin.")


def _cuenta_legible(cb: Optional[dict]) -> Optional[str]:
    """`{"banco": "Banco de Chile", "tipo_cuenta": "Cuenta Corriente", ...}` ->
    "Banco de Chile · Cuenta Corriente". `None` si no hay cuenta configurada."""
    if not cb or not cb.get("numero"):
        return None
    partes = [str(cb.get(k)).strip() for k in ("banco", "tipo_cuenta") if cb.get(k)]
    return " · ".join(partes) or None


# Solo estas se pueden marcar pagadas a mano. Una 'procesando' es una
# transferencia BCI en vuelo y una 'pagado' ya se depositó: el admin NO las pisa.
_LIQ_PAGABLE_A_MANO = ("pendiente", "fallido")


def _fila_liquidacion_dueno(db: Session, dueno_id: str) -> Optional[Dict[str, Any]]:
    """Fila agrupada (una por dueño) para el panel de Finanzas.

    `bruto`/`comisión` se reconstruyen: `liquidacion_dueno.monto` ya es el neto
    (85%/80% del arriendo + 100% de compensaciones). Se le resta la compensación
    guardada en la reserva para aislar la base del dueño, y de ahí sale la
    comisión de plataforma.
    """
    pagos = (
        db.query(Pago)
        .filter(Pago.tipo == "liquidacion_dueno", Pago.usuario_id == dueno_id)
        .all()
    )
    if not pagos:
        return None

    dueno = db.query(Usuario).filter(Usuario.id == dueno_id).first()
    reserva_ids = {p.reserva_id for p in pagos if p.reserva_id}
    reservas = (
        {r.id: r for r in db.query(Reserva).filter(Reserva.id.in_(reserva_ids)).all()}
        if reserva_ids else {}
    )
    cfg = PricingService.obtener_configuracion(db)
    comision_pct = float(getattr(cfg, "comision_plataforma_pct", 20.0) or 20.0) / 100.0

    neto = comision = 0
    pendientes = otros = 0
    pagada_en: Optional[datetime] = None
    for p in pagos:
        monto = int(p.monto or 0)
        neto += monto
        r = reservas.get(p.reserva_id)
        compensaciones = (
            int(getattr(r, "cargo_limpieza_clp", 0) or 0)
            + int(getattr(r, "cargos_adicionales_clp", 0) or 0)
        ) if r else 0
        base_dueno = max(0, monto - compensaciones)
        subtotal = round(base_dueno / (1 - comision_pct)) if comision_pct < 1 else base_dueno
        comision += max(0, subtotal - base_dueno)

        if p.estado == "pagado":
            if p.liquidado_en and (pagada_en is None or p.liquidado_en > pagada_en):
                pagada_en = p.liquidado_en
        elif p.estado in _LIQ_PAGABLE_A_MANO:
            pendientes += 1
        else:  # 'procesando'
            otros += 1

    return {
        "id": dueno_id,
        "dueno_nombre": dueno.nombre if dueno else "Dueño",
        "dueno_rut": dueno.rut if dueno else None,
        "cuenta_bancaria": _cuenta_legible(dueno.cuenta_bancaria if dueno else None),
        "reservas_count": len(reserva_ids),
        "bruto_clp": neto + comision,
        "comision_clp": comision,
        "neto_clp": neto,
        "estado": "pendiente" if (pendientes or otros) else "pagada",
        "pagada_en": pagada_en.isoformat() if pagada_en else None,
    }


@router.get("/liquidaciones", summary="Liquidaciones a dueños, agrupadas por dueño (Admin)")
def listar_liquidaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _solo_admin(current_user)
    dueno_ids = [
        row[0]
        for row in db.query(Pago.usuario_id)
        .filter(Pago.tipo == "liquidacion_dueno")
        .distinct()
        .all()
    ]
    filas = [f for did in dueno_ids if (f := _fila_liquidacion_dueno(db, did))]
    # pendientes primero, luego por monto neto descendente
    filas.sort(key=lambda f: (f["estado"] == "pagada", -f["neto_clp"]))
    return filas


@router.post("/liquidaciones/{dueno_id}/pagar", summary="Marcar como pagadas a mano las liquidaciones de un dueño (Admin)")
def marcar_liquidacion_pagada(
    dueno_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """El `{dueno_id}` es el `id` de la fila que devuelve GET /admin/liquidaciones.

    Marca `pagado` solo las liquidaciones en 'pendiente'/'fallido' de ese dueño
    y les deja rastro (`liquidado_en` + `referencia_pago='MANUAL-ADMIN-<admin>'`,
    distinguible de las `BCI-MOCK-*` / `BCI-*` del barrido automático). Las que
    ya están `pagado` o `procesando` (depósito automático en curso) NO se tocan:
    si no queda ninguna por pagar, responde 409 para no permitir un doble pago.
    """
    _solo_admin(current_user)

    pagos = (
        db.query(Pago)
        .filter(Pago.tipo == "liquidacion_dueno", Pago.usuario_id == dueno_id)
        .all()
    )
    if not pagos:
        raise HTTPException(status_code=404, detail="Ese dueño no tiene liquidaciones.")

    pagables = [p for p in pagos if p.estado in _LIQ_PAGABLE_A_MANO]
    if not pagables:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay liquidaciones por pagar: ya están pagadas o el depósito automático está en curso.",
        )

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    ref = f"MANUAL-ADMIN-{str(current_user.id)[:8]}"
    for p in pagables:
        p.estado = "pagado"
        p.liquidado_en = p.liquidado_en or ahora
        p.referencia_pago = ref
    db.commit()

    return _fila_liquidacion_dueno(db, dueno_id)


@router.post("/liquidaciones/ejecutar", summary="Ejecutar el barrido de liquidaciones pendientes (Admin)")
def ejecutar_liquidaciones(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin.")
    from app.features.payments import liquidaciones_service
    return {"resumen": liquidaciones_service.ejecutar_liquidaciones_pendientes(db)}


@router.get("/pagos", summary="Listado de transacciones de la plataforma (Admin)")
def listar_pagos_admin(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido a Admin.")
    
    pagos = db.query(Pago).order_by(Pago.timestamp.desc()).limit(limit).all()
    resultado = []
    for p in pagos:
        u = db.query(Usuario).filter(Usuario.id == p.usuario_id).first()
        resultado.append({
            "id": p.id,
            "reserva_id": p.reserva_id,
            "tipo": p.tipo,
            "monto": p.monto,
            "estado": p.estado,
            "referencia_pago": p.referencia_pago,
            "timestamp": p.timestamp,
            "usuario_nombre": u.nombre if u else "Usuario",
            "usuario_email": u.email if u else None,
        })
    return resultado


# Montar sub-routers de reservas y usuarios para el panel
router.include_router(reservations_router)
router.include_router(users_router)

