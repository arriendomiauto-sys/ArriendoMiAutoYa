from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security_audit import SecurityAudit
from app.schemas.schemas import DisputeOut, DisputeResolveRequest, DisputeCreate
from app.models.entities import Disputa, Reserva, Usuario, Pago
from app.features.auth.login.service import get_current_user
from app.features.system.storage.service import StorageService
from app.features.bookings.reservations import cancelacion_service
from app.features.payments import cargos_service
from app.features.communications.notifications.service import crear_notificacion

router = APIRouter(prefix="/disputas", tags=["Disputas (Manager & Admin)"])

def _renovar_evidencias(disputa: Disputa) -> None:
    """Las fotos de evidencia viven en un bucket privado con URL firmada que caduca a los 7 días."""
    StorageService.renovar_url_campos(disputa, ("foto_evidencia_url",))
    disputa.evidencia_fotos, _ = StorageService.renovar_lista_urls(disputa.evidencia_fotos or [])


def _requerir_admin_o_manager(current_user: Usuario):
    roles = current_user.roles_activos or []
    if "admin" not in roles and "manager" not in roles:
        raise HTTPException(status_code=403, detail="Acceso restringido a Manager o Admin.")

@router.get("", response_model=List[DisputeOut], summary="Listar disputas activas")
def listar_disputas(
    estado: str = "abierta",
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    disputas = db.query(Disputa).filter(Disputa.estado == estado).all()
    for d in disputas:
        _renovar_evidencias(d)
    db.commit()
    return disputas

@router.get("/{disputa_id}", response_model=DisputeOut, summary="Obtener detalle y evidencia de una disputa")
def obtener_disputa(
    disputa_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _requerir_admin_o_manager(current_user)
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    _renovar_evidencias(disputa)
    db.commit()
    return disputa

@router.post("/{disputa_id}/resolver", response_model=DisputeOut, summary="Resolver formalmente una disputa (Admin)")
@limiter.limit("20/minute")
def resolver_disputa(
    request: Request,
    disputa_id: str,
    payload: DisputeResolveRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    if "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo un Admin puede resolver disputas formalmente.")

    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")

    if disputa.estado == "resuelta":
        raise HTTPException(status_code=400, detail="La disputa ya se encuentra resuelta.")

    disputa.estado = "resuelta"
    disputa.resolucion = f"[{payload.accion_pago}] {payload.resolucion}"
    disputa.admin_asignado_id = current_user.id

    reserva = db.query(Reserva).filter(Reserva.id == disputa.reserva_id).first()
    if reserva:
        accion = payload.accion_pago
        dueno_id = reserva.auto.dueno_id if reserva.auto else None

        if accion == "reembolso_total":
            # BUG-043: Reembolsa arriendo y libera garantía retenida
            cancelacion_service._devolver_dinero(db, reserva, reembolso_total=True)
            # Cancela liquidación pendiente para el dueño
            db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo == "liquidacion_dueno",
                Pago.estado == "pendiente"
            ).update({"estado": "cancelado"})
            # Cancela cualquier cargo pendiente
            db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo.like("cargo_%"),
                Pago.estado == "pendiente"
            ).update({"estado": "cancelado"})
            reserva.estado = "cancelada"

            crear_notificacion(
                db, usuario_id=reserva.cliente_id, tipo="disputa",
                titulo="Disputa resuelta a tu favor",
                mensaje=f"La disputa fue resuelta: se reembolsó el arriendo y se liberó tu garantía. Fundamento: {payload.resolucion}",
                entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
            )
            if dueno_id:
                crear_notificacion(
                    db, usuario_id=dueno_id, tipo="disputa",
                    titulo="Disputa resuelta",
                    mensaje=f"La disputa fue resuelta con reembolso total al cliente. Fundamento: {payload.resolucion}",
                    entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
                )

        elif accion == "sin_cobro":
            # Cancela cargos pendientes y libera el 100% de la garantía retenida
            db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo.like("cargo_%"),
                Pago.estado == "pendiente"
            ).update({"estado": "cancelado"})
            cargos_service.saldar_garantia(db, reserva, extras=0, cobrar=True)
            reserva.estado = "finalizada"

            crear_notificacion(
                db, usuario_id=reserva.cliente_id, tipo="disputa",
                titulo="Disputa resuelta sin cobro",
                mensaje=f"La disputa fue resuelta sin cobros adicionales. Tu garantía ha sido liberada inmediatamente en la pasarela (la reversa del cupo en tu banco suele tardar 24-72 hrs hábiles). Fundamento: {payload.resolucion}",
                entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
            )
            if dueno_id:
                crear_notificacion(
                    db, usuario_id=dueno_id, tipo="disputa",
                    titulo="Disputa resuelta sin cobro",
                    mensaje=f"La disputa fue resuelta sin cargos al arrendatario. Se liberó la garantía. Fundamento: {payload.resolucion}",
                    entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
                )

        elif accion == "cobro_cliente":
            # Captura los cargos pendientes contra la garantía y libera el remanente
            resultado_garantia = cargos_service.saldar_garantia(db, reserva, extras=0, cobrar=True)
            cobrado = resultado_garantia.cobrado
            if cobrado > 0 and dueno_id:
                liq_existente = db.query(Pago).filter(
                    Pago.reserva_id == reserva.id,
                    Pago.tipo == "liquidacion_dueno",
                    Pago.estado == "pendiente"
                ).first()
                if liq_existente:
                    liq_existente.monto = int(liq_existente.monto or 0) + cobrado
                else:
                    db.add(Pago(
                        reserva_id=reserva.id,
                        usuario_id=dueno_id,
                        tipo="liquidacion_dueno",
                        monto=cobrado,
                        estado="pendiente"
                    ))
            reserva.estado = "finalizada"

            crear_notificacion(
                db, usuario_id=reserva.cliente_id, tipo="disputa",
                titulo="Disputa resuelta con cobro",
                mensaje=f"La disputa fue resuelta aplicando cargos por ${cobrado:,} CLP contra tu garantía. El remanente fue liberado inmediatamente en la pasarela (reversa bancaria estimada en 24-72 hrs hábiles). Fundamento: {payload.resolucion}".replace(",", "."),
                entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
            )
            if dueno_id:
                crear_notificacion(
                    db, usuario_id=dueno_id, tipo="disputa",
                    titulo="Disputa resuelta con cobro a favor",
                    mensaje=f"La disputa fue resuelta: se capturaron ${cobrado:,} CLP para abonar a tu liquidación. Fundamento: {payload.resolucion}".replace(",", "."),
                    entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
                )

        elif accion == "division_deducible_50_50":
            pendientes = cargos_service.cargos_pendientes(db, reserva)
            if pendientes:
                total_cargos = sum(int(p.monto or 0) for p in pendientes)
                mitad = total_cargos // 2
            else:
                garantia = cargos_service._garantia_retenida(db, reserva)
                mitad = (int(garantia.monto or 0) // 2) if garantia else 0

            db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo.like("cargo_%"),
                Pago.estado == "pendiente"
            ).update({"estado": "cancelado"})

            if mitad > 0:
                mitad = min(mitad, cargos_service.tope_disponible(db, reserva))
                if mitad > 0:
                    cargos_service.registrar_cargo_pendiente(db, reserva, "cargo_deducible_50_50", mitad)

            resultado_garantia = cargos_service.saldar_garantia(db, reserva, extras=0, cobrar=True)
            cobrado = resultado_garantia.cobrado
            if cobrado > 0 and dueno_id:
                liq_existente = db.query(Pago).filter(
                    Pago.reserva_id == reserva.id,
                    Pago.tipo == "liquidacion_dueno",
                    Pago.estado == "pendiente"
                ).first()
                if liq_existente:
                    liq_existente.monto = int(liq_existente.monto or 0) + cobrado
                else:
                    db.add(Pago(
                        reserva_id=reserva.id,
                        usuario_id=dueno_id,
                        tipo="liquidacion_dueno",
                        monto=cobrado,
                        estado="pendiente"
                    ))
            reserva.estado = "finalizada"

            crear_notificacion(
                db, usuario_id=reserva.cliente_id, tipo="disputa",
                titulo="Disputa resuelta (División 50/50)",
                mensaje=f"La disputa fue resuelta dividiendo el deducible al 50% (${cobrado:,} CLP). El 50% restante de la garantía fue liberado inmediatamente en la pasarela (reversa bancaria en 24-72 hrs hábiles).".replace(",", "."),
                entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
            )
            if dueno_id:
                crear_notificacion(
                    db, usuario_id=dueno_id, tipo="disputa",
                    titulo="Disputa resuelta (División 50/50)",
                    mensaje=f"La disputa fue resuelta dividiendo el deducible al 50%: se abonarán ${cobrado:,} CLP a tu liquidación.".replace(",", "."),
                    entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
                )

        elif accion == "cargo_limpieza_dueno":
            db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo.like("cargo_%"),
                ~Pago.tipo.like("%limpieza%"),
                Pago.estado == "pendiente"
            ).update({"estado": "cancelado"})

            limpieza_p = db.query(Pago).filter(
                Pago.reserva_id == reserva.id,
                Pago.tipo.like("%limpieza%"),
                Pago.estado == "pendiente"
            ).first()
            if not limpieza_p:
                monto_limpieza = int(getattr(reserva, "cargo_limpieza_clp", 25000) or 25000)
                monto_limpieza = min(monto_limpieza, cargos_service.tope_disponible(db, reserva))
                if monto_limpieza > 0:
                    cargos_service.registrar_cargo_pendiente(db, reserva, "cargo_limpieza", monto_limpieza)

            resultado_garantia = cargos_service.saldar_garantia(db, reserva, extras=0, cobrar=True)
            cobrado = resultado_garantia.cobrado
            if cobrado > 0 and dueno_id:
                liq_existente = db.query(Pago).filter(
                    Pago.reserva_id == reserva.id,
                    Pago.tipo == "liquidacion_dueno",
                    Pago.estado == "pendiente"
                ).first()
                if liq_existente:
                    liq_existente.monto = int(liq_existente.monto or 0) + cobrado
                else:
                    db.add(Pago(
                        reserva_id=reserva.id,
                        usuario_id=dueno_id,
                        tipo="liquidacion_dueno",
                        monto=cobrado,
                        estado="pendiente"
                    ))
            reserva.estado = "finalizada"

            crear_notificacion(
                db, usuario_id=reserva.cliente_id, tipo="disputa",
                titulo="Disputa resuelta: Cargo de limpieza",
                mensaje=f"La disputa determinó cobro de limpieza por ${cobrado:,} CLP de tu garantía. El remanente fue liberado inmediatamente en la pasarela (reversa bancaria estimada en 24-72 hrs hábiles).".replace(",", "."),
                entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
            )
            if dueno_id:
                crear_notificacion(
                    db, usuario_id=dueno_id, tipo="disputa",
                    titulo="Disputa resuelta: Cargo de limpieza a favor",
                    mensaje=f"Se aprobó el cobro de limpieza por ${cobrado:,} CLP que se sumará a tu liquidación.".replace(",", "."),
                    entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
                )

    db.commit()
    db.refresh(disputa)
    return disputa
