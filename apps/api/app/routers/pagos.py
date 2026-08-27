from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from app.core.database import get_db
from app.models.entities import Pago, Reserva, Usuario
from app.services.transbank import TransbankService
from app.services.auth import get_current_user
import uuid

router = APIRouter(prefix="/pagos", tags=["Pasarela de Pagos (Webpay Plus)"])

@router.post("/webpay/iniciar", summary="Inicia una transacción Webpay Plus (Hold o Cobro)")
def iniciar_pago_webpay(
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
    """
    buy_order = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    session_id = f"SES-{current_user.id[:8]}"
    url_retorno = return_url or "http://localhost:3000/pago/retorno"

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
def confirmar_pago_webpay(
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
