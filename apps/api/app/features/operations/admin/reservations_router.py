"""
Panel admin — ventana Reservas.

Lista de todas las reservas con auto / cliente / dueño anidados, montos, firmas
y los dos checklists. El manager solo ve las reservas de autos de su sucursal.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.entities import Auto, ChecklistAuto, Reserva, Usuario
from app.features.operations.admin._guards import exigir_admin_o_manager

router = APIRouter()

_ESTADOS = {
    "pendiente", "pendiente_pago", "confirmada", "en_curso",
    "finalizada", "cancelada", "disputada",
}


def _checklist(reserva: Reserva, tipo: str) -> Optional[Dict[str, Any]]:
    ch = next((c for c in (reserva.checklists or []) if c.tipo == tipo), None)
    if not ch:
        return None
    return {
        "kilometraje": ch.kilometraje,
        "nivel_combustible": ch.nivel_combustible,
        "estado_limpieza": ch.estado_limpieza,
    }


def _serializar(reserva: Reserva) -> Dict[str, Any]:
    auto = reserva.auto
    dueno = auto.dueno if auto else None
    return {
        "id": reserva.id,
        "estado": reserva.estado,
        "fecha_inicio": reserva.fecha_inicio,
        "fecha_fin": reserva.fecha_fin,
        "creado_en": reserva.creado_en,
        "lugar_entrega_acordado": reserva.lugar_entrega_acordado,
        "monto_cobro": reserva.monto_cobro or 0,
        "monto_hold": reserva.monto_hold or 0,
        "liquidacion_dueno_clp": reserva.liquidacion_dueno_clp or 0,
        "monto_cobro_final": reserva.monto_cobro_final or 0,
        "cargo_limpieza_clp": reserva.cargo_limpieza_clp or 0,
        "cargo_combustible_clp": reserva.cargo_combustible_clp or 0,
        "cargo_km_extra_clp": reserva.cargo_km_extra_clp or 0,
        "cargo_atraso_clp": reserva.cargo_atraso_clp or 0,
        "cargos_adicionales_clp": reserva.cargos_adicionales_clp or 0,
        "cargo_falta_grave_clp": reserva.cargo_falta_grave_clp or 0,
        "auto": {
            "id": auto.id, "marca": auto.marca, "modelo": auto.modelo,
            "anio": auto.anio, "patente": auto.patente,
        } if auto else None,
        "cliente": {
            "id": reserva.cliente.id, "nombre": reserva.cliente.nombre,
        } if reserva.cliente else None,
        "dueno": {"id": dueno.id, "nombre": dueno.nombre} if dueno else None,
        "firmas": [
            {"rol": f.rol, "metodo": f.metodo, "firmado_en": f.firmado_en}
            for f in (reserva.firmas or [])
        ],
        "checklist_entrega": _checklist(reserva, "antes"),
        "checklist_devolucion": _checklist(reserva, "despues"),
    }


def _base_query(db: Session, usuario: Usuario):
    q = (
        db.query(Reserva)
        .options(
            joinedload(Reserva.auto).joinedload(Auto.dueno),
            joinedload(Reserva.cliente),
            joinedload(Reserva.firmas),
            joinedload(Reserva.checklists),
        )
        .join(Auto, Reserva.auto_id == Auto.id)
        .join(Usuario, Auto.dueno_id == Usuario.id)
    )
    # El manager solo ve la flota de su sucursal.
    if "admin" not in (usuario.roles_activos or []):
        q = q.filter(Usuario.sucursal_id == usuario.sucursal_id)
    return q


@router.get("/reservas", summary="Panel: listar reservas con detalle")
def listar_reservas_admin(
    estado: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Texto libre: patente, nombre de cliente/dueño o id"),
    limit: int = Query(100, ge=1, le=500),
    cursor: Optional[str] = Query(None, description="Offset opaco de la página anterior"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin_o_manager),
):
    query = _base_query(db, usuario)

    if estado and estado in _ESTADOS:
        query = query.filter(Reserva.estado == estado)

    if q and q.strip():
        aguja = f"%{q.strip()}%"
        query = query.filter(or_(
            Reserva.id.ilike(aguja),
            Auto.patente.ilike(aguja),
            Reserva.cliente.has(Usuario.nombre.ilike(aguja)),
            Auto.dueno.has(Usuario.nombre.ilike(aguja)),
        ))

    try:
        offset = max(0, int(cursor)) if cursor else 0
    except ValueError:
        offset = 0

    filas = (
        query.order_by(Reserva.creado_en.desc())
        .offset(offset)
        .limit(limit + 1)
        .all()
    )
    hay_mas = len(filas) > limit
    filas = filas[:limit]

    return {
        "items": [_serializar(r) for r in filas],
        "next_cursor": str(offset + limit) if hay_mas else None,
    }


@router.get("/reservas/{reserva_id}", summary="Panel: detalle de una reserva")
def obtener_reserva_admin(
    reserva_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin_o_manager),
):
    reserva = _base_query(db, usuario).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return _serializar(reserva)
