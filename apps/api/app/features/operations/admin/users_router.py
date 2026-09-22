"""
Panel admin — ventana Usuarios.

Listado con métricas por usuario (arriendos, autos, tarjetas, rating), cambio de
roles y suspensión de cuenta. Roles y suspensión son solo para admin; el listado
lo puede ver también un manager (limitado a su sucursal).
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security_audit import SecurityAudit
from app.models.entities import Auto, Calificacion, Reserva, Tarjeta, Usuario
from app.features.operations.admin._guards import exigir_admin, exigir_admin_o_manager
from app.schemas.schemas import InvitacionPromotorCreate, InvitacionCodigoOut
from app.features.auth.onboarding import referrals_service as referidos

router = APIRouter()

ROLES_VALIDOS = {"cliente", "dueno", "manager", "admin", "promotor", "soporte"}


def _metricas(db: Session, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Cuenta arriendos, autos, tarjetas y promedio de rating para `ids` en 4
    consultas agrupadas (evita el N+1 al serializar la lista)."""
    if not ids:
        return {}
    base = {i: {"total_arriendos": 0, "total_autos": 0, "tarjetas_count": 0, "rating_promedio": None} for i in ids}

    for uid, n in (
        db.query(Reserva.cliente_id, func.count(Reserva.id))
        .filter(Reserva.cliente_id.in_(ids)).group_by(Reserva.cliente_id).all()
    ):
        base[uid]["total_arriendos"] = n
    for uid, n in (
        db.query(Auto.dueno_id, func.count(Auto.id))
        .filter(Auto.dueno_id.in_(ids)).group_by(Auto.dueno_id).all()
    ):
        base[uid]["total_autos"] = n
    for uid, n in (
        db.query(Tarjeta.usuario_id, func.count(Tarjeta.id))
        .filter(Tarjeta.usuario_id.in_(ids)).group_by(Tarjeta.usuario_id).all()
    ):
        base[uid]["tarjetas_count"] = n
    for uid, prom in (
        db.query(Calificacion.destinatario_id, func.avg(Calificacion.puntaje))
        .filter(Calificacion.destinatario_id.in_(ids)).group_by(Calificacion.destinatario_id).all()
    ):
        base[uid]["rating_promedio"] = round(float(prom), 2) if prom is not None else None
    return base


def _serializar(u: Usuario, m: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u.id,
        "nombre": u.nombre,
        "rut": u.rut,
        "email": u.email,
        "telefono": u.telefono,
        "roles_activos": u.roles_activos or ["cliente"],
        "estado_documentos": u.estado_documentos or "pendiente",
        "confianza_ocr": u.confianza_ocr,
        "licencia_estado": u.licencia_estado,
        "licencia_clase": u.licencia_clase,
        "antecedentes_estado": u.antecedentes_estado,
        "fecha_registro": u.fecha_registro,
        "suspendido": bool(u.suspendido),
        "total_arriendos": m.get("total_arriendos", 0),
        "total_autos": m.get("total_autos", 0),
        "tarjetas_count": m.get("tarjetas_count", 0),
        "rating_promedio": m.get("rating_promedio"),
    }


@router.get("/usuarios", summary="Panel: listar usuarios con métricas")
def listar_usuarios_admin(
    rol: Optional[str] = Query(None),
    estado_documentos: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Texto libre: nombre, RUT, email o teléfono"),
    limit: int = Query(100, ge=1, le=500),
    cursor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin_o_manager),
):
    query = db.query(Usuario)

    # El manager solo ve usuarios de su sucursal.
    if "admin" not in (usuario.roles_activos or []):
        query = query.filter(Usuario.sucursal_id == usuario.sucursal_id)

    if rol and rol in ROLES_VALIDOS:
        # `roles_activos` es JSON: se filtra con LIKE sobre el texto serializado.
        query = query.filter(func.cast(Usuario.roles_activos, __import__("sqlalchemy").String).ilike(f'%"{rol}"%'))
    if estado_documentos:
        query = query.filter(Usuario.estado_documentos == estado_documentos)
    if q and q.strip():
        aguja = f"%{q.strip()}%"
        query = query.filter(or_(
            Usuario.nombre.ilike(aguja),
            Usuario.rut.ilike(aguja),
            Usuario.email.ilike(aguja),
            Usuario.telefono.ilike(aguja),
        ))

    try:
        offset = max(0, int(cursor)) if cursor else 0
    except ValueError:
        offset = 0

    filas = query.order_by(Usuario.fecha_registro.desc()).offset(offset).limit(limit + 1).all()
    hay_mas = len(filas) > limit
    filas = filas[:limit]

    metricas = _metricas(db, [u.id for u in filas])
    return {
        "items": [_serializar(u, metricas.get(u.id, {})) for u in filas],
        "next_cursor": str(offset + limit) if hay_mas else None,
    }


@router.get("/usuarios/{usuario_id}", summary="Panel: detalle de un usuario")
def obtener_usuario_admin(
    usuario_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin_o_manager),
):
    objetivo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if "admin" not in (usuario.roles_activos or []) and objetivo.sucursal_id != usuario.sucursal_id:
        raise HTTPException(status_code=403, detail="Acceso denegado a usuarios fuera de tu sucursal.")
    metricas = _metricas(db, [objetivo.id]).get(objetivo.id, {})
    return _serializar(objetivo, metricas)


@router.put("/usuarios/{usuario_id}/roles", summary="Panel: cambiar los roles de un usuario")
def cambiar_roles(
    usuario_id: str,
    roles_activos: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    objetivo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    nuevos = [r for r in dict.fromkeys(roles_activos) if r in ROLES_VALIDOS]
    if not nuevos:
        raise HTTPException(status_code=400, detail="Debes indicar al menos un rol válido.")

    previos = objetivo.roles_activos or []
    objetivo.roles_activos = nuevos
    if "promotor" in nuevos:
        objetivo.es_promotor = True
    elif "promotor" in previos:
        objetivo.es_promotor = False
    _auditar(db, objetivo, admin, f"Roles: {previos} -> {nuevos}")
    SecurityAudit.log_event(
        "ADMIN_CAMBIO_ROLES", user_id=admin.id, resource=f"usuario:{usuario_id}",
        details={"antes": previos, "despues": nuevos},
    )
    db.commit()
    db.refresh(objetivo)
    return _serializar(objetivo, _metricas(db, [objetivo.id]).get(objetivo.id, {}))


@router.post("/usuarios/{usuario_id}/suspension", summary="Panel: suspender o reactivar una cuenta")
def cambiar_suspension(
    usuario_id: str,
    suspendido: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    objetivo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if objetivo.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes suspender tu propia cuenta.")

    objetivo.suspendido = bool(suspendido)
    accion = "Suspendida" if suspendido else "Reactivada"
    _auditar(db, objetivo, admin, f"Cuenta {accion.lower()}")
    SecurityAudit.log_event(
        "ADMIN_SUSPENSION", user_id=admin.id, resource=f"usuario:{usuario_id}",
        details={"suspendido": bool(suspendido)},
    )
    db.commit()
    db.refresh(objetivo)
    return _serializar(objetivo, _metricas(db, [objetivo.id]).get(objetivo.id, {}))


@router.post(
    "/promotores/invitaciones",
    response_model=InvitacionCodigoOut,
    summary="Panel: crear una invitación de un solo uso para un nuevo promotor",
)
def crear_invitacion_promotor(
    payload: Optional[InvitacionPromotorCreate] = None,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    inv = referidos.crear_invitacion_promotor(
        admin, db, nota=payload.nota if payload else None
    )
    SecurityAudit.log_event(
        "ADMIN_CREAR_INVITACION_PROMOTOR",
        user_id=admin.id,
        resource=f"invitacion:{inv.codigo}",
        details={"tipo": inv.tipo, "nota": inv.nota},
    )
    return InvitacionCodigoOut(
        id=inv.id,
        codigo=inv.codigo,
        tipo=inv.tipo,
        usado=inv.usado,
        usado_en=inv.usado_en,
        usado_por_nombre=None,
        link=f"{settings.FRONTEND_URL.rstrip('/')}/invitacion/{inv.codigo}",
        fecha_creacion=inv.fecha_creacion,
    )


@router.get(
    "/promotores/invitaciones",
    response_model=List[InvitacionCodigoOut],
    summary="Panel: listar invitaciones a promotores",
)
def listar_invitaciones_promotores(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    items = referidos.listar_invitaciones_promotores(admin, db)
    return [InvitacionCodigoOut(**it) for it in items]


def _auditar(db: Session, objetivo: Usuario, admin: Usuario, texto: str) -> None:
    sello = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    nota = f"[{sello}] {texto} (por {admin.nombre or admin.email})"
    objetivo.notas_auditoria = f"{(objetivo.notas_auditoria + ' | ') if objetivo.notas_auditoria else ''}{nota}"
