import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security_audit import SecurityAudit
from app.core.url_validator import validate_safe_return_url
from app.models.entities import Auto, Pago, Reserva, Usuario
from app.features.auth.login.service import get_current_user
from app.features.payments.mercadopago_service import MercadoPagoService
from app.features.payments import estado_pagos
# Mock payments handling for local development
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagos", tags=["Pasarela de Pagos (Mercado Pago)"])


def _aplicar_resultado(db: Session, pago: Optional[Pago], resultado: Dict[str, Any]) -> None:
    """
    Lleva el estado de la pasarela a nuestras tablas. Vive en `estado_pagos`
    porque lo comparten la vuelta del checkout, el webhook y la conciliación.
    """
    estado_pagos.aplicar_estado_pasarela(db, pago, resultado)


def _mensaje_de_rechazo(resultado: Dict[str, Any]) -> str:
    """
    Traduce el `status_detail` de Mercado Pago a algo accionable.

    "cc_rejected_insufficient_amount" no le dice nada a nadie; que a la tarjeta
    le falta cupo, sí. Cada caso tiene una salida distinta, y un mensaje
    genérico deja al usuario probando la misma tarjeta una y otra vez.
    """
    detalle = (resultado.get("detalle_estado") or "").lower()
    mensajes = {
        "cc_rejected_insufficient_amount": "Tu tarjeta no tiene cupo suficiente para la garantía.",
        "cc_rejected_bad_filled_card_number": "Revisa el número de la tarjeta.",
        "cc_rejected_bad_filled_date": "Revisa la fecha de vencimiento de la tarjeta.",
        "cc_rejected_bad_filled_security_code": "Revisa el código de seguridad.",
        "cc_rejected_high_risk": "Tu banco rechazó el pago por seguridad. Prueba con otra tarjeta.",
        "cc_rejected_call_for_authorize": "Tu banco necesita que autorices este monto. Llámalos y reintenta.",
        "cc_rejected_card_disabled": "La tarjeta está inhabilitada. Actívala con tu banco o usa otra.",
        "cc_rejected_duplicated_payment": "Ese pago ya se hizo. Revisa Mis Arriendos antes de reintentar.",
    }
    if detalle in mensajes:
        return mensajes[detalle]
    if resultado.get("estado") == "pending":
        return "El pago quedó pendiente de acreditación. Te avisamos apenas se confirme."
    return "No se pudo autorizar la garantía. Tu reserva quedó pendiente y puedes reintentar."


@router.post("/mercadopago/iniciar", summary="Crea el checkout de Mercado Pago para una garantía o cobro")
@limiter.limit("10/minute")
def iniciar_pago(
    request: Request,
    monto: int = Body(..., embed=True, gt=0, description="Monto en CLP"),
    # Lista cerrada: el barrido de liquidaciones paga todo `Pago` de tipo
    # `liquidacion_dueno` pendiente, así que un `tipo` libre permitía inventarse
    # una liquidación a la medida.
    tipo: Literal["hold_reserva", "hold_enrolamiento", "cobro_final"] = Body(
        "hold_reserva", embed=True, description="hold_enrolamiento, hold_reserva, cobro_final"
    ),
    reserva_id: Optional[str] = Body(None, embed=True),
    return_url: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Crea una preferencia de Checkout Pro y devuelve la URL a la que hay que
    mandar al usuario. Valida `return_url` contra Open Redirect (CWE-601).
    """
    simulado = pagos_simulados.pagos_simulados_activos()

    # Un pago solo se puede atar a una reserva propia: sin esto, cualquiera
    # asociaría cobros (y su confirmación) a la reserva de otra persona.
    if reserva_id:
        reserva_destino = db.query(Reserva).filter(Reserva.id == reserva_id).first()
        if not reserva_destino:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")
        if reserva_destino.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
            raise HTTPException(status_code=403, detail="Esa reserva no es tuya.")
        # El monto de la garantía lo fija el servidor, no el cliente: una
        # "garantía" de $1 atada a la reserva la daba por pagada.
        if tipo == "hold_reserva":
            from app.features.payments import cargos_service

            esperado = cargos_service.garantia_total(db, reserva_destino)
            if monto != esperado:
                SecurityAudit.log_event(
                    "PAGO_MONTO_ALTERADO", user_id=current_user.id, resource=f"reserva:{reserva_id}",
                    details={"monto": monto, "esperado": esperado}, status="BLOCKED",
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La garantía de esta reserva es de ${esperado:,} CLP.".replace(",", "."),
                )

    # La protección contra open redirect NO se relaja en modo simulado: dejar
    # pasar un dominio ajeno acá abriría en pruebas justo el agujero que el
    # validador existe para tapar. Si esto rechaza una URL legítima, lo que
    # corresponde es autorizar ese dominio en DEFAULT_ALLOWED_RETURN_DOMAINS.
    if return_url:
        is_dev = settings.ENVIRONMENT == "development"
        if not validate_safe_return_url(return_url, allow_localhost_dev=is_dev):
            SecurityAudit.log_event(
                "OPEN_REDIRECT_BLOCKED", user_id=current_user.id, resource=return_url, status="BLOCKED"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "La URL de retorno no es válida o pertenece a un dominio no autorizado: "
                    f"{return_url}"
                ),
            )

    pago_id = str(uuid.uuid4())
    url_retorno = (
        return_url
        or getattr(settings, "PAGO_DEFAULT_RETURN_URL", None)
        or "https://arriendomiautoya.cl/pago/retorno"
    ).strip()
    titulo = {
        "hold_reserva": "Garantía de arriendo",
        "hold_enrolamiento": "Garantía de enrolamiento",
        "cobro_final": "Cargo final del arriendo",
    }.get(tipo, "Pago de arriendo")

    # ===== BLOQUE TEMPORAL — PAGOS SIMULADOS ==============================
    # Mientras no haya credenciales de Mercado Pago se da la preferencia por
    # Sandbox payment handling without external gateway credentials.
    if simulado:
        resultado = pagos_simulados.crear_preferencia_simulada(
            referencia_externa=pago_id, monto=monto, return_url=url_retorno
        )
        SecurityAudit.log_event(
            "PAGO_SIMULADO_INICIADO",
            user_id=current_user.id,
            resource=f"reserva:{reserva_id}" if reserva_id else f"tipo:{tipo}",
            details={"monto": monto, "tipo": tipo, "preferencia": resultado.get("preferencia_id")},
        )
    else:
        resultado = MercadoPagoService.crear_preferencia(
            referencia_externa=pago_id,
            titulo=titulo,
            monto=monto,
            return_url=url_retorno,
            email_pagador=current_user.email,
            notification_url=f"{settings.API_PUBLIC_URL}/api/v1/pagos/mercadopago/webhook",
        )
    # ======================================================================

    if not resultado.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No pudimos abrir el pago en Mercado Pago: {resultado.get('error')}",
        )

    pago = Pago(
        id=pago_id,
        reserva_id=reserva_id,
        usuario_id=current_user.id,
        tipo=tipo,
        monto=monto,
        estado="pendiente",
        referencia_pago=resultado.get("preferencia_id"),
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)

    return {
        "pago_id": pago.id,
        "preferencia_id": resultado.get("preferencia_id"),
        "url": resultado.get("url"),
        "monto": monto,
        # BLOQUE TEMPORAL: el cliente usa esto para saltarse el checkout y
        # Immediate auto-approval for development simulation.
        "simulado": bool(resultado.get("simulado", False)),
    }


@router.post("/mercadopago/confirmar", summary="Confirma un pago tras volver del checkout")
@limiter.limit("20/minute")
def confirmar_pago(
    request: Request,
    payment_id: str = Body(..., embed=True, description="payment_id que devuelve Mercado Pago"),
    pago_id: Optional[str] = Body(None, embed=True, description="Nuestro id de pago (external_reference)"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Atajo para no hacer esperar al usuario que vuelve del checkout.

    La fuente de verdad es el webhook: si el arrendatario cierra la app antes
    de volver, la reserva igual queda confirmada. Acá solo se adelanta ese
    resultado consultando el pago contra la API.
    """
    pago = None
    if pago_id:
        pago = db.query(Pago).filter(Pago.id == pago_id).first()
    if not pago:
        pago = db.query(Pago).filter(Pago.referencia_pago == payment_id).first()

    # Sin un `Pago` propio no hay nada que confirmar. Se responde 404 también
    # para el pago ajeno, así no se puede averiguar qué ids existen.
    es_admin = "admin" in (current_user.roles_activos or [])
    if not pago or (pago.usuario_id != current_user.id and not es_admin):
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    # ===== BLOQUE TEMPORAL — PAGOS SIMULADOS ==============================
    # Un payment_id con prefijo SIMULADO- se da por aprobado. Uno real sigue
    # yendo a Mercado Pago aunque la simulación esté encendida.
    if pagos_simulados.pagos_simulados_activos() and pagos_simulados.es_pago_simulado(payment_id):
        # El id simulado tiene que ser el que se emitió para ESTE pago.
        if payment_id != pago.referencia_pago:
            raise HTTPException(status_code=409, detail="El pago no corresponde a este cobro.")
        resultado = pagos_simulados.obtener_pago_simulado(
            payment_id, monto=pago.monto if pago else 0
        )
        SecurityAudit.log_event(
            "PAGO_SIMULADO_CONFIRMADO",
            user_id=pago.usuario_id if pago else None,
            resource=f"pago:{pago.id}" if pago else f"payment:{payment_id}",
            details={"monto": pago.monto if pago else 0, "tipo": pago.tipo if pago else None},
        )
    else:
        resultado = MercadoPagoService.obtener_pago(payment_id)
        # Un pago aprobado en Mercado Pago solo vale para el cobro al que se
        # hizo: si no, un pago chico serviría para "confirmar" cualquier otro.
        if resultado.get("success") and (
            resultado.get("referencia_externa") != pago.id
            or int(round(float(resultado.get("monto") or 0))) != int(pago.monto)
        ):
            SecurityAudit.log_event(
                "PAGO_MP_NO_CORRESPONDE", user_id=current_user.id,
                resource=f"pago:{pago.id}", details={"payment_id": payment_id}, status="BLOCKED",
            )
            raise HTTPException(status_code=409, detail="El pago de Mercado Pago no corresponde a este cobro.")
    # ======================================================================

    _aplicar_resultado(db, pago, resultado)

    if not resultado.get("success") or not resultado.get("autorizada"):
        return {
            "autorizada": False,
            "mensaje": _mensaje_de_rechazo(resultado),
            "estado": resultado.get("estado"),
            "detalle": resultado,
        }

    return {
        "autorizada": True,
        "mensaje": (
            "Pago simulado: la pasarela real todavía no está configurada."
            if resultado.get("simulado")
            else "Pago autorizado en Mercado Pago."
        ),
        # Simulation flag handling for sandbox mode.
        "simulado": bool(resultado.get("simulado", False)),
        "pago_id": pago.id if pago else None,
        "estado": resultado.get("estado"),
        "retenido": resultado.get("retenido", False),
        "monto": resultado.get("monto"),
        "payment_id": resultado.get("payment_id"),
        "tarjeta": resultado.get("tarjeta"),
    }


@router.post("/mercadopago/webhook", summary="Aviso de Mercado Pago sobre un pago")
async def webhook_mercadopago(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: str = Header(None, alias="x-signature"),
    x_request_id: str = Header(None, alias="x-request-id"),
):
    """
    Camino confiable de confirmación: no depende de que el usuario vuelva.

    Un aviso que no reconocemos se responde 200. Mercado Pago reintenta lo que
    no recibe 200, y un aviso de un pago ajeno reintentado para siempre solo
    agrega ruido.
    """
    try:
        cuerpo = await request.json()
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El aviso no es JSON válido")
    if not isinstance(cuerpo, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El aviso no es JSON válido")
    data = cuerpo.get("data") if isinstance(cuerpo.get("data"), dict) else {}
    data_id = str(data.get("id") or "")
    tipo = cuerpo.get("type") or cuerpo.get("topic")

    if tipo != "payment" or not data_id:
        return {"recibido": True, "ignorado": "no es un aviso de pago"}

    # Sin firma válida no se toca nada: cualquiera que conozca la URL podría
    # avisar "el pago 123 fue aprobado" y confirmar reservas gratis.
    if not MercadoPagoService.firma_valida(x_signature, x_request_id, data_id):
        SecurityAudit.log_event(
            "WEBHOOK_FIRMA_INVALIDA", resource=f"payment:{data_id}", status="BLOCKED"
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")

    # La consulta a Mercado Pago y la base son bloqueantes: en un hilo, para no
    # dejar a toda la API sin responder mientras dura (hasta 15 s por consulta).
    return await run_in_threadpool(_procesar_aviso_de_pago, db, data_id)


def _procesar_aviso_de_pago(db: Session, data_id: str) -> Dict[str, Any]:
    # El aviso solo dice "mirá este pago": el estado se consulta contra la API,
    # que es la única fuente que no se puede falsificar.
    resultado = MercadoPagoService.obtener_pago(data_id)
    if not resultado.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="No se pudo consultar el pago"
        )

    pago = estado_pagos.buscar_pago_local(db, resultado)

    if not pago:
        logger.warning("[MERCADOPAGO] Aviso de un pago que no reconocemos: %s", data_id)
        return {"recibido": True, "ignorado": "pago desconocido"}

    _aplicar_resultado(db, pago, resultado)
    return {"recibido": True, "pago_id": pago.id, "estado": pago.estado}


@router.get("/mercadopago/estado/{payment_id}", summary="Consulta el estado de un pago")
def consultar_estado_pago(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Solo el dueño del pago (o un admin): los ids de Mercado Pago son
    # correlativos y sin esto cualquiera recorrería los pagos de la cuenta.
    pago = db.query(Pago).filter(Pago.referencia_pago == payment_id).first()
    if not pago or (pago.usuario_id != current_user.id and "admin" not in (current_user.roles_activos or [])):
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    resultado = MercadoPagoService.obtener_pago(payment_id)
    # El JSON crudo trae datos del pagador y de la tarjeta que la app no necesita.
    resultado.pop("raw", None)
    return resultado


@router.get("/configuracion", summary="Datos públicos de la pasarela para el cliente")
def obtener_configuracion_pagos():
    """
    Lo que la app necesita antes de cobrar: la llave pública con la que el SDK
    tokeniza la tarjeta, y si los pagos están simulados — para mostrarlo en vez
    de fingir un cobro real.
    """
    return {
        "proveedor": "mercadopago",
        "public_key": settings.MERCADOPAGO_PUBLIC_KEY,
        # Sandbox mock verification fallback.
        "simulado": pagos_simulados.pagos_simulados_activos(),
    }


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
        db.query(Pago.id, Pago.reserva_id, Pago.monto, Pago.estado, Pago.timestamp)
        .filter(Pago.usuario_id == current_user.id, Pago.tipo == "liquidacion_dueno")
        .order_by(Pago.timestamp.desc())
        .all()
    )

    # "Por cobrar" = todo lo que la plataforma todavía le debe: pendiente, más
    # lo que está en vuelo ('procesando') y lo que falló y se va a reintentar
    # ('fallido'). Si no, el saldo del dueño se desploma solo mientras el
    # historial le sigue mostrando la fila.
    ESTADOS_POR_COBRAR = ("pendiente", "procesando", "fallido")
    saldo_disponible_clp = sum(p.monto for p in pagos_liquidacion if p.estado in ESTADOS_POR_COBRAR)
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

    # Rendimiento por auto: cuánto generó cada vehículo y qué tan seguido
    # estuvo arrendado, para que un dueño con varios autos vea cuál le
    # conviene mantener publicado y cuál no está rindiendo.
    autos = (
        db.query(Auto.id, Auto.marca, Auto.modelo, Auto.patente, Auto.fecha_publicacion)
        .filter(Auto.dueno_id == current_user.id)
        .all()
    )

    reserva_ids = {p.reserva_id for p in pagos_liquidacion if p.reserva_id}
    reservas_de_pagos = (
        dict(db.query(Reserva.id, Reserva.auto_id).filter(Reserva.id.in_(reserva_ids)).all())
        if reserva_ids
        else {}
    )
    # Mismo criterio que saldo_disponible_clp/total_pagado_clp arriba: cuenta
    # lo pagado y lo que sigue debiéndose (pendiente/procesando/fallido); una
    # liquidación "reembolsada" no es plata que el auto haya generado.
    ganancia_por_auto: Dict[str, int] = {}
    for p in pagos_liquidacion:
        if p.estado not in ESTADOS_POR_COBRAR + ("pagado",):
            continue
        auto_id = reservas_de_pagos.get(p.reserva_id)
        if auto_id:
            ganancia_por_auto[auto_id] = ganancia_por_auto.get(auto_id, 0) + p.monto

    ocupacion_por_auto: Dict[str, Dict[str, int]] = {}
    autos_ids = [a.id for a in autos]
    if autos_ids:
        finalizadas = (
            db.query(Reserva.auto_id, Reserva.fecha_fin, Reserva.fecha_inicio)
            .filter(Reserva.auto_id.in_(autos_ids), Reserva.estado == "finalizada")
            .all()
        )
        for r_auto_id, r_fin, r_ini in finalizadas:
            dias = max(1, (r_fin - r_ini).days)
            info = ocupacion_por_auto.setdefault(r_auto_id, {"cantidad": 0, "dias": 0})
            info["cantidad"] += 1
            info["dias"] += dias

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    por_auto = []
    for auto in autos:
        info = ocupacion_por_auto.get(auto.id, {"cantidad": 0, "dias": 0})
        dias_publicado = max(1, (ahora - (auto.fecha_publicacion or ahora)).days)
        tasa_ocupacion_pct = round(min(100.0, info["dias"] / dias_publicado * 100), 1)
        por_auto.append({
            "auto_id": auto.id,
            "marca": auto.marca,
            "modelo": auto.modelo,
            "patente": auto.patente,
            "ganancia_total_clp": ganancia_por_auto.get(auto.id, 0),
            "reservas_finalizadas": info["cantidad"],
            "dias_arrendado": info["dias"],
            "tasa_ocupacion_pct": tasa_ocupacion_pct,
        })
    por_auto.sort(key=lambda x: x["ganancia_total_clp"], reverse=True)

    # Bono de invitación (ver app/services/referidos.py) — deliberadamente
    # aparte de saldo_disponible_clp/total_pagado_clp: es plata que la
    # plataforma pone por el programa de referidos, no ganancia del auto,
    # y así se puede mostrar como línea propia en vez de mezclarla en
    # silencio con la liquidación normal.
    pagos_bono = (
        db.query(Pago.monto, Pago.estado)
        .filter(Pago.usuario_id == current_user.id, Pago.tipo == "bono_referido")
        .all()
    )
    bono_referido_pendiente_clp = sum(p.monto for p in pagos_bono if p.estado == "pendiente")
    bono_referido_pagado_clp = sum(p.monto for p in pagos_bono if p.estado == "pagado")

    total_ganado_clp = saldo_disponible_clp + total_pagado_clp
    cuenta_configurada = bool(current_user.cuenta_bancaria and current_user.cuenta_bancaria.get("numero"))

    return {
        "saldo_disponible_clp": saldo_disponible_clp,
        "total_pagado_clp": total_pagado_clp,
        "total_depositado_clp": total_pagado_clp,
        "total_ganado_clp": total_ganado_clp,
        "cuenta_configurada": cuenta_configurada,
        "cantidad_liquidaciones": len(pagos_liquidacion),
        "historial": historial,
        "por_auto": por_auto,
        "bono_referido_pendiente_clp": bono_referido_pendiente_clp,
        "bono_referido_pagado_clp": bono_referido_pagado_clp,
    }
