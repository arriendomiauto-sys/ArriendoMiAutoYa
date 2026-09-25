"""
Checkout de la reserva: pago dual (cobro del arriendo + hold de garantía).

- El **arriendo** (días × tarifa, IVA incl.) se **cobra** a una tarjeta de
  **débito**.
- La **garantía** es un **hold** (autorización sin captura) sobre una tarjeta
  de **crédito**, con monto fijo por categoría de vehículo.

El movimiento es atómico para el usuario: si el cobro falla después de tomar
el hold, el hold se libera y la reserva queda igual que antes ("pendiente_pago").
"""
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.entities import Pago, Reserva, Tarjeta, Usuario
from app.features.payments import card_vault
from app.features.payments.mercadopago_service import MercadoPagoService
from app.features.bookings.reservations import confirmacion_service
from app.services import pagos_simulados

logger = logging.getLogger(__name__)

# IVA Chile. `monto_cobro` se guarda con IVA incluido; el desglose es informativo.
IVA_PCT = 0.19

# Garantía por categoría cuando la plataforma no la tiene configurada en
# ConfiguracionPlataforma.garantia_categoria_clp.
GARANTIA_CATEGORIA_DEFECTO: Dict[str, int] = {
    "economico": 250000,
    "sedan": 350000,
    "suv": 500000,
    "camioneta": 600000,
    "premium": 1000000,
}
GARANTIA_FALLBACK_CLP = 350000

# Minutos que vive una reserva en "pendiente_pago" antes de expirar.
TTL_RESERVA_MINUTOS = 30


class CheckoutError(Exception):
    """Falla de negocio del checkout. `http_status`, `codigo` y `campo` estables."""

    def __init__(self, http_status: int, codigo: str, mensaje: str, campo: Optional[str] = None):
        super().__init__(mensaje)
        self.http_status = http_status
        self.codigo = codigo
        self.mensaje = mensaje
        self.campo = campo

    def as_detail(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"codigo": self.codigo, "mensaje": self.mensaje}
        if self.campo:
            d["campo"] = self.campo
        return d


# ===========================================================================
# Montos
# ===========================================================================
def desglose_cobro(monto_total_iva_incl: int) -> Dict[str, int]:
    """`{monto, neto, iva}` a partir del total con IVA incluido."""
    monto = int(monto_total_iva_incl or 0)
    neto = round(monto / (1 + IVA_PCT))
    return {"monto": monto, "neto": int(neto), "iva": monto - int(neto)}


def monto_garantia(config: Any, categoria: Optional[str]) -> int:
    """Garantía fija (hold) para la categoría del auto, en CLP."""
    tabla = getattr(config, "garantia_categoria_clp", None) or {}
    if not isinstance(tabla, dict):
        tabla = {}
    cat = (categoria or "").strip().lower()
    if cat in tabla:
        return int(tabla[cat])
    if cat in GARANTIA_CATEGORIA_DEFECTO:
        return GARANTIA_CATEGORIA_DEFECTO[cat]
    return GARANTIA_FALLBACK_CLP


def monto_garantia_auto(config: Any, auto: Any) -> int:
    """Garantía del auto: la propia (`auto.garantia_clp`) si la tiene, si no la de su categoría."""
    propia = getattr(auto, "garantia_clp", None)
    if propia is not None and int(propia) > 0:
        return int(propia)
    return monto_garantia(config, getattr(auto, "categoria", None))


def _ahora() -> datetime:
    return datetime.utcnow()


# ===========================================================================
# Movimientos contra la pasarela
# ===========================================================================
def _pagador(usuario: Usuario) -> Dict[str, Any]:
    """Datos del arrendatario para el antifraude de Mercado Pago."""
    partes = (usuario.nombre or "").split()
    registrado = getattr(usuario, "fecha_registro", None)
    return {
        "nombre": partes[0] if partes else None,
        "apellido": " ".join(partes[1:]) or None,
        # Mismo formato que manda la app al tokenizar: sin puntos ni guion.
        "rut": re.sub(r"[^0-9Kk]", "", usuario.rut or "").upper() or None,
        "telefono": usuario.telefono,
        "registrado_en": registrado.isoformat() if registrado else None,
    }


def _item(reserva: Optional[Reserva]) -> Optional[Dict[str, Any]]:
    auto = getattr(reserva, "auto", None)
    if not reserva or not auto:
        return None
    nombre = " ".join(str(p) for p in (auto.marca, auto.modelo, auto.anio) if p)
    return {"id": auto.id, "titulo": f"Arriendo {nombre}", "descripcion": f"Reserva {reserva.id[:8]}"}


def _mover(
    tarjeta: Tarjeta, usuario: Usuario, monto: int, capturar: bool, ref: str,
    token_app: Optional[str] = None,
    reserva: Optional[Reserva] = None,
    device_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Cobra (`capturar=True`) o retiene un hold (`capturar=False`) sobre `tarjeta`.

    `token_app` es el token que generó la app con el CVV. Si no viene, se genera
    acá sin CVV, y eso solo funciona si la cuenta de Mercado Pago tiene habilitado el cobro sin CVV.
    """
    if pagos_simulados.pagos_simulados_activos():
        # Convención de pruebas: una tarjeta terminada en 0000 siempre rechaza.
        rechazar = (tarjeta.ultimos4 or "") == "0000"
        return pagos_simulados.pagar_simulado(monto, capturar=capturar, rechazar=rechazar)

    token = token_app or card_vault.token_para_movimiento(tarjeta.mp_customer_id, tarjeta.mp_card_id)
    if not token:
        return {"autorizada": False, "estado": "error", "detalle_estado": "sin_token", "success": False}

    return MercadoPagoService.crear_pago_con_tarjeta(
        token_tarjeta=token,
        monto=monto,
        descripcion=("Garantía de arriendo" if not capturar else "Arriendo de vehículo"),
        email_pagador=usuario.email,
        referencia_externa=ref,
        capturar=capturar,
        pagador=_pagador(usuario),
        item=_item(reserva),
        device_id=device_id,
    )


def _liberar(payment_id: Optional[str]) -> None:
    """Suelta un hold ya tomado (rollback cuando el cobro posterior falla)."""
    if not payment_id or pagos_simulados.es_pago_simulado(payment_id):
        return
    try:
        MercadoPagoService.liberar_hold(payment_id)
    except Exception as e:  # noqa: BLE001
        logger.error("[CHECKOUT] No se pudo liberar el hold %s tras un cobro fallido: %s", payment_id, e)


# ===========================================================================
# Checkout
# ===========================================================================
def _tarjeta_de(db: Session, usuario: Usuario, tarjeta_id: str) -> Optional[Tarjeta]:
    return (
        db.query(Tarjeta)
        .filter(Tarjeta.id == tarjeta_id, Tarjeta.usuario_id == usuario.id)
        .first()
    )


def procesar_pago(
    db: Session,
    reserva: Reserva,
    usuario: Usuario,
    tarjeta_cobro_id: str,
    tarjeta_garantia_id: str,
    device_id: Optional[str] = None,
    token_cobro: Optional[str] = None,
    token_garantia: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ejecuta el pago dual de la reserva. Devuelve `{estado: "esperando_dueno", confirmar_antes_de}`
    (pagada: el dueño tiene un plazo para confirmarla, ver `confirmacion_service`) o
    `{estado: "pendiente", motivo, expira_en}` (el banco aún revisa el cobro). Lanza `CheckoutError`
    en los caminos de error (tarjeta inválida, sin cupo, cobro rechazado, expirada).
    """
    if reserva.estado in ("pendiente", "confirmada"):
        return _respuesta_pagada(reserva)
    if reserva.estado != "pendiente_pago":
        raise CheckoutError(409, "ESTADO_INVALIDO", "La reserva no está esperando pago.")

    if reserva.expira_en and _ahora() > reserva.expira_en:
        reserva.estado = "cancelada"
        db.commit()
        raise CheckoutError(409, "RESERVA_EXPIRADA", "La reserva expiró. Vuelve a solicitarla.")

    # El contrato se firma ANTES de pagar (al menos por el arrendatario).
    if "arrendatario" not in {f.rol for f in reserva.firmas}:
        raise CheckoutError(409, "CONTRATO_NO_FIRMADO", "Firma el contrato antes de pagar.")

    if tarjeta_cobro_id == tarjeta_garantia_id:
        raise CheckoutError(402, "TARJETA_TIPO_INVALIDO",
                            "El cobro del arriendo y la garantía deben ir en tarjetas distintas.",
                            campo="cobro")

    tc = _tarjeta_de(db, usuario, tarjeta_cobro_id)
    # El cobro del arriendo acepta débito o crédito (antes solo débito) — la
    # garantía siempre es un hold en crédito, así que si el arrendatario no
    # tiene débito puede igual reservar dejando ambos montos en la misma
    # tarjeta de crédito (con tarjetas distintas, valida arriba).
    if not tc or tc.tipo not in ("debito", "credito") or tc.estado != "validada":
        raise CheckoutError(402, "TARJETA_TIPO_INVALIDO",
                            "El arriendo se cobra a una tarjeta de débito o crédito validada.", campo="cobro")
    tg = _tarjeta_de(db, usuario, tarjeta_garantia_id)
    if not tg or tg.tipo != "credito" or tg.estado != "validada":
        raise CheckoutError(402, "TARJETA_TIPO_INVALIDO",
                            "La garantía se retiene en una tarjeta de crédito validada.", campo="garantia")

    # Antifraude: prevención de autofinanciamiento / colusión con medios de pago del dueño
    from app.core.validators import normalizar_rut
    dueno = getattr(reserva, "auto", None) and getattr(reserva.auto, "dueno", None)
    if not dueno and getattr(reserva, "auto", None):
        dueno = db.query(Usuario).filter(Usuario.id == reserva.auto.dueno_id).first()

    if dueno:
        # 1. Comprobar RUT si estuviese presente en metadata de tarjeta
        rut_dueno = normalizar_rut(getattr(dueno, "rut", None))
        if rut_dueno:
            rut_tc = normalizar_rut(getattr(tc, "rut", None))
            rut_tg = normalizar_rut(getattr(tg, "rut", None))
            if (rut_tc and rut_tc == rut_dueno) or (rut_tg and rut_tg == rut_dueno):
                raise CheckoutError(403, "COLUSION_AUTOFINANCIAMIENTO",
                                    "No puedes utilizar un medio de pago perteneciente al dueño del vehículo.")

        # 2. Comprobar si el titular de la tarjeta coincide con el dueño y difiere del arrendatario
        if dueno.nombre and usuario.nombre:
            nombre_dueno = dueno.nombre.strip().upper()
            nombre_cliente = usuario.nombre.strip().upper()
            if nombre_dueno != nombre_cliente:
                if (tc.titular and tc.titular.strip().upper() == nombre_dueno) or \
                   (tg.titular and tg.titular.strip().upper() == nombre_dueno):
                    raise CheckoutError(403, "COLUSION_AUTOFINANCIAMIENTO",
                                        "No puedes utilizar un medio de pago perteneciente al dueño del vehículo.")

        # 3. Comprobar si la misma tarjeta tokenizada en el vault pertenece al dueño
        tarjetas_dueno = db.query(Tarjeta).filter(Tarjeta.usuario_id == dueno.id).all()
        ids_dueno = {t.mp_card_id for t in tarjetas_dueno if t.mp_card_id}

        if (tc.mp_card_id and tc.mp_card_id in ids_dueno) or (tg.mp_card_id and tg.mp_card_id in ids_dueno):
            raise CheckoutError(403, "COLUSION_AUTOFINANCIAMIENTO",
                                "No puedes utilizar un medio de pago perteneciente al dueño del vehículo.")

    monto_cobro = int(reserva.monto_cobro or 0)
    monto_hold = int(reserva.monto_hold or 0)
    ref_base = f"{reserva.id[:8]}-{uuid.uuid4().hex[:6]}"

    # --- Paso 1: hold de la garantía (autorización sin captura) --------------
    res_hold = _mover(tg, usuario, monto_hold, capturar=False, ref=f"HOLD-{ref_base}",
                      token_app=token_garantia, reserva=reserva, device_id=device_id)
    if not res_hold.get("autorizada"):
        if _cvv_rechazado(res_hold):
            raise CheckoutError(402, "CVV_INVALIDO",
                                "El código de seguridad de tu tarjeta de crédito es incorrecto.", campo="garantia")
        raise CheckoutError(402, "SIN_CUPO",
                            "Tu tarjeta de crédito no tiene cupo para la garantía.", campo="garantia")

    # --- Paso 2: cobro del arriendo ----------------------------------------
    res_cobro = _mover(tc, usuario, monto_cobro, capturar=True, ref=f"COBRO-{ref_base}",
                       token_app=token_cobro, reserva=reserva, device_id=device_id)

    if res_cobro.get("estado") == "pending":
        # Cobro en revisión del banco: se deja la garantía tomada y la reserva
        # a la espera; el webhook / reintento la confirma.
        _registrar_pago(db, reserva, usuario, "hold_reserva", monto_hold, "retenido", res_hold.get("payment_id"))
        _registrar_pago(db, reserva, usuario, "cobro_arriendo", monto_cobro, "pendiente", res_cobro.get("payment_id"))
        reserva.tarjeta_cobro_id = tc.id
        reserva.tarjeta_garantia_id = tg.id
        db.commit()
        return {
            "estado": "pendiente",
            "motivo": "El cobro quedó en revisión de tu banco. Te avisamos apenas se acredite.",
            "expira_en": reserva.expira_en.isoformat() if reserva.expira_en else None,
        }

    if not res_cobro.get("autorizada"):
        _liberar(res_hold.get("payment_id"))
        if _cvv_rechazado(res_cobro):
            raise CheckoutError(402, "CVV_INVALIDO",
                                "El código de seguridad de la tarjeta del arriendo es incorrecto. "
                                "No se retuvo ninguna garantía.", campo="cobro")
        raise CheckoutError(402, "COBRO_RECHAZADO",
                            _motivo_rechazo(res_cobro), campo="cobro")

    # --- Éxito: se persiste todo junto -----------------------------------
    _registrar_pago(db, reserva, usuario, "hold_reserva", monto_hold, "retenido", res_hold.get("payment_id"))
    _registrar_pago(db, reserva, usuario, "cobro_arriendo", monto_cobro, "capturado", res_cobro.get("payment_id"))
    reserva.tarjeta_cobro_id = tc.id
    reserva.tarjeta_garantia_id = tg.id
    # Pagada, pero el dueño todavía no aceptó: queda "pendiente" con plazo.
    confirmacion_service.esperar_confirmacion_del_dueno(db, reserva)
    db.commit()
    return _respuesta_pagada(reserva)


def _respuesta_pagada(reserva: Reserva) -> Dict[str, Any]:
    if reserva.estado == "confirmada":
        return {"estado": "confirmada"}
    plazo = reserva.confirmar_dueno_antes_de
    return {"estado": "esperando_dueno", "confirmar_antes_de": plazo.isoformat() if plazo else None}


def _registrar_pago(db, reserva, usuario, tipo, monto, estado, payment_id) -> None:
    db.add(Pago(
        reserva_id=reserva.id,
        usuario_id=usuario.id,
        tipo=tipo,
        monto=int(monto or 0),
        estado=estado,
        referencia_pago=str(payment_id) if payment_id else None,
    ))
    db.flush()


def _cvv_rechazado(res: Dict[str, Any]) -> bool:
    return (res.get("detalle_estado") or "").lower() == "cc_rejected_bad_filled_security_code"


def _motivo_rechazo(res: Dict[str, Any]) -> str:
    detalle = (res.get("detalle_estado") or "").lower()
    mapa = {
        "cc_rejected_insufficient_amount": "Tu tarjeta de débito no tiene saldo suficiente.",
        "cc_rejected_bad_filled_security_code": "El código de seguridad de la tarjeta es incorrecto.",
        "cc_rejected_high_risk": "Tu banco rechazó el cobro por seguridad. Prueba con otra tarjeta.",
        "cc_rejected_call_for_authorize": "Tu banco necesita que autorices este monto. Llámalos y reintenta.",
    }
    return mapa.get(detalle, "No se pudo cobrar el arriendo. No se retuvo ninguna garantía.")
