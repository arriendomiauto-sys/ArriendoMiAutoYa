from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, Request
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.core.database import get_db
from app.core.config import settings
from app.core.limiter import limiter
from app.core.url_validator import validate_safe_return_url
from app.core.security_audit import SecurityAudit
from app.models.entities import Pago, Reserva, Usuario, Auto
from app.services.transbank import TransbankService
from app.services.auth import get_current_user
from app.services.notificaciones import crear_notificacion
import uuid

router = APIRouter(prefix="/pagos", tags=["Pasarela de Pagos (Webpay Plus)"])


def _notificar_reserva_confirmada(db: Session, reserva: Reserva) -> None:
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if not auto:
        return
    nombre_auto = f"{auto.marca} {auto.modelo} ({auto.patente})"
    crear_notificacion(
        db, usuario_id=auto.dueno_id, tipo="reserva",
        titulo="Nueva reserva de tu auto",
        mensaje=f"Te reservaron el {nombre_auto}. Coordina la entrega con el arrendatario.",
        entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
    )
    crear_notificacion(
        db, usuario_id=reserva.cliente_id, tipo="reserva",
        titulo="Reserva confirmada",
        mensaje=f"Tu reserva del {nombre_auto} quedó confirmada y la garantía retenida.",
        entidad_tipo="reserva", entidad_id=reserva.id, commit=False,
    )

@router.post("/webpay/iniciar", summary="Inicia una transacción Webpay Plus (Hold o Cobro)")
@limiter.limit("10/minute")
def iniciar_pago_webpay(
    request: Request,
    monto: int = Body(..., embed=True, description="Monto en CLP"),
    tipo: str = Body("hold_reserva", embed=True, description="hold_enrolamiento, hold_reserva, cobro_final"),
    reserva_id: Optional[str] = Body(None, embed=True),
    return_url: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Crea una sesión de pago en Transbank Webpay Plus Sandbox (o Producción)
    y retorna la URL oficial y el token para redireccionar al usuario.
    Valida return_url contra Open Redirect (OWASP CWE-601).
    """
    if return_url:
        is_dev = settings.ENVIRONMENT == "development"
        if not validate_safe_return_url(return_url, allow_localhost_dev=is_dev):
            SecurityAudit.log_event("OPEN_REDIRECT_BLOCKED", user_id=current_user.id, resource=return_url, status="BLOCKED")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La URL de retorno no es válida o pertenece a un dominio no autorizado."
            )

    buy_order = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    session_id = f"SES-{current_user.id[:8]}"
    url_retorno = return_url or settings.WEBPAY_DEFAULT_RETURN_URL

    resultado_tbk = TransbankService.crear_transaccion(
        buy_order=buy_order,
        session_id=session_id,
        amount=monto,
        return_url=url_retorno
    )

    if not resultado_tbk.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al comunicar con Transbank Webpay: {resultado_tbk.get('error')}"
        )

    # Registrar el pago en estado pendiente
    pago = Pago(
        id=str(uuid.uuid4()),
        reserva_id=reserva_id,
        usuario_id=current_user.id,
        tipo=tipo,
        monto=monto,
        estado="pendiente",
        referencia_transbank=resultado_tbk.get("token")
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)

    return {
        "pago_id": pago.id,
        "token": resultado_tbk.get("token"),
        "url": resultado_tbk.get("url"),
        "buy_order": buy_order,
        "monto": monto
    }

@router.post("/webpay/confirmar", summary="Confirma el token devuelto por Webpay tras el pago")
@limiter.limit("20/minute")
def confirmar_pago_webpay(
    request: Request,
    token_ws: str = Body(..., embed=True, description="Token retornado por Transbank"),
    db: Session = Depends(get_db)
):
    """
    Recibe el token de Webpay, consulta la autorización formal con Transbank
    y actualiza el estado del pago y de la reserva correspondiente.
    """
    resultado_tbk = TransbankService.confirmar_transaccion(token_ws)

    pago = db.query(Pago).filter(Pago.referencia_transbank == token_ws).first()

    if not resultado_tbk.get("success") or not resultado_tbk.get("autorizada"):
        if pago:
            pago.estado = "fallido"
            db.commit()
        return {
            "autorizada": False,
            "mensaje": "La transacción fue rechazada o cancelada por el usuario en Webpay.",
            "detalle": resultado_tbk
        }

    if pago:
        pago.estado = "capturado"
        if pago.reserva_id:
            reserva = db.query(Reserva).filter(Reserva.id == pago.reserva_id).first()
            if reserva and reserva.estado == "pendiente":
                reserva.estado = "confirmada"
                db.flush()
                _notificar_reserva_confirmada(db, reserva)
        db.commit()
        db.refresh(pago)

    return {
        "autorizada": True,
        "mensaje": "Pago autorizado exitosamente en Transbank Webpay.",
        "pago_id": pago.id if pago else None,
        "amount": resultado_tbk.get("amount"),
        "buy_order": resultado_tbk.get("buy_order"),
        "authorization_code": resultado_tbk.get("authorization_code"),
        "card_detail": resultado_tbk.get("card_detail")
    }

@router.get("/webpay/estado/{token_ws}", summary="Consulta el estado de una transacción en Webpay")
def consultar_estado_pago(token_ws: str):
    return TransbankService.consultar_estado(token_ws)

@router.get("/mis-ganancias", summary="Resumen real de ganancias y liquidaciones del dueño autenticado")
def obtener_mis_ganancias(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Se calcula directo de los Pago tipo "liquidacion_dueno" que
    delivery.py registra al completar el checklist de devolución — no hay
    números de ejemplo acá, si el dueño no tiene arriendos finalizados
    todo sale en cero.
    """
    pagos_liquidacion = (
        db.query(Pago)
        .filter(Pago.usuario_id == current_user.id, Pago.tipo == "liquidacion_dueno")
        .order_by(Pago.timestamp.desc())
        .all()
    )

    saldo_disponible_clp = sum(p.monto for p in pagos_liquidacion if p.estado == "pendiente")
    total_pagado_clp = sum(p.monto for p in pagos_liquidacion if p.estado == "pagado")

    historial = [
        {
            "id": p.id,
            "reserva_id": p.reserva_id,
            "monto": p.monto,
            "estado": p.estado,
            "timestamp": p.timestamp,
        }
        for p in pagos_liquidacion[:30]
    ]

    return {
        "saldo_disponible_clp": saldo_disponible_clp,
        "total_pagado_clp": total_pagado_clp,
        "cantidad_liquidaciones": len(pagos_liquidacion),
        "historial": historial,
    }
