"""
Bóveda de tarjetas del usuario: alta, baja, listado y el estado derivado.

El usuario puede guardar varias tarjetas. El gate de "puede operar" (reservar /
publicar) mira `Usuario.tarjeta_estado`, que acá se mantiene sincronizado:
queda "validada" apenas hay al menos una tarjeta validada de cualquier tipo.
El checkout, aparte, exige tener ≥1 débito y ≥1 crédito validadas.
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import Reserva, Tarjeta, Usuario
from app.features.payments import card_vault
from app.features.payments.cards_service import nombres_coinciden, _marca_normalizada

logger = logging.getLogger(__name__)

VALIDADA = "validada"
REVISION = "requiere_revision_manual"
RECHAZADA = "rechazada"

# Estados de reserva en los que una tarjeta asociada NO se puede borrar: está
# respaldando un arriendo vivo (cobro hecho y/o garantía retenida).
_RESERVA_VIVA = ("pendiente_pago", "confirmada", "en_curso", "disputada")


class WalletError(Exception):
    """Falla de negocio de la bóveda. `http_status` + `codigo` estables."""

    def __init__(self, http_status: int, codigo: str, mensaje: str, **extra: Any):
        super().__init__(mensaje)
        self.http_status = http_status
        self.codigo = codigo
        self.mensaje = mensaje
        self.extra = extra

    def as_detail(self) -> Dict[str, Any]:
        return {"codigo": self.codigo, "mensaje": self.mensaje, **self.extra}


# ===========================================================================
# Serialización
# ===========================================================================
def serializar(t: Tarjeta) -> Dict[str, Any]:
    return {
        "id": t.id,
        "marca": t.marca or "otra",
        "ultimos4": t.ultimos4,
        "vencimiento": t.vencimiento,
        "tipo": t.tipo,
        "titular": t.titular,
        "estado": t.estado,
        "predeterminada_cobro": bool(t.predeterminada_cobro),
        "predeterminada_garantia": bool(t.predeterminada_garantia),
    }


def listar(db: Session, usuario: Usuario) -> List[Tarjeta]:
    return (
        db.query(Tarjeta)
        .filter(Tarjeta.usuario_id == usuario.id)
        .order_by(Tarjeta.creada_en.asc())
        .all()
    )


# ===========================================================================
# Estado derivado en Usuario
# ===========================================================================
def sincronizar_estado_usuario(db: Session, usuario: Usuario) -> None:
    """
    Recalcula `Usuario.tarjeta_estado` (y espeja los datos de la predeterminada
    en las columnas legacy `tarjeta_*`, que UserOut sigue exponiendo).
    """
    tarjetas = listar(db, usuario)
    validadas = [t for t in tarjetas if t.estado == VALIDADA]

    if validadas:
        usuario.tarjeta_estado = VALIDADA
    elif any(t.estado == REVISION for t in tarjetas):
        usuario.tarjeta_estado = REVISION
    elif tarjetas:
        usuario.tarjeta_estado = RECHAZADA
    else:
        usuario.tarjeta_estado = "pendiente"

    espejo = next((t for t in validadas if t.predeterminada_cobro), None) or (
        validadas[0] if validadas else None
    )
    usuario.tarjeta_ultimos4 = espejo.ultimos4 if espejo else None
    usuario.tarjeta_marca = espejo.marca if espejo else None
    usuario.tarjeta_titular = espejo.titular if espejo else usuario.tarjeta_titular
    db.commit()


def tiene_tipo_validada(db: Session, usuario: Usuario, tipo: str) -> bool:
    return any(t.estado == VALIDADA and t.tipo == tipo for t in listar(db, usuario))


# ===========================================================================
# Alta
# ===========================================================================
def agregar(
    db: Session,
    usuario: Usuario,
    card_token: str,
    payment_method_id: Optional[str] = None,
    device_id: Optional[str] = None,  # noqa: ARG001 — plumbing listo, MP fingerprint pendiente
    tipo_hint: Optional[str] = None,
    ultimos4_hint: Optional[str] = None,
    marca_hint: Optional[str] = None,
) -> Tarjeta:
    try:
        datos = card_vault.registrar_tarjeta(
            email=usuario.email,
            nombre=usuario.nombre,
            card_token=card_token,
            payment_method_id=payment_method_id,
            mp_customer_id=usuario.mp_customer_id,
            tipo_hint=tipo_hint,
            ultimos4_hint=ultimos4_hint,
            marca_hint=marca_hint,
        )
    except card_vault.VaultError as e:
        raise WalletError(422, e.codigo, e.mensaje)

    if datos.get("tipo") not in ("credito", "debito"):
        raise WalletError(
            422, "TARJETA_TIPO_DESCONOCIDO",
            "No pudimos determinar si la tarjeta es de débito o crédito. "
            "Elige el tipo y vuelve a intentarlo.",
        )

    # Protocolo de seguridad: la tarjeta tiene que ser de quien tiene la cuenta.
    # Solo se exige si la pasarela devolvió un titular (el modo simulado no).
    titular = datos.get("titular")
    if titular and usuario.nombre and not nombres_coinciden(titular, usuario.nombre):
        raise WalletError(
            422, "NOMBRE_NO_COINCIDE",
            "El nombre del titular de la tarjeta no coincide con tu nombre registrado. "
            "Por seguridad solo se aceptan tarjetas a tu propio nombre.",
            titular_detectado=titular,
        )

    # No se guarda dos veces la misma tarjeta (mismos últimos 4 + tipo).
    ya_esta = next(
        (t for t in listar(db, usuario) if t.ultimos4 == datos.get("ultimos4") and t.tipo == datos["tipo"]),
        None,
    )
    if ya_esta:
        raise WalletError(409, "TARJETA_DUPLICADA", "Ya tienes registrada esa tarjeta.")

    if datos.get("mp_customer_id") and not usuario.mp_customer_id:
        usuario.mp_customer_id = datos["mp_customer_id"]

    validadas_previas = [t for t in listar(db, usuario) if t.estado == VALIDADA]
    tarjeta = Tarjeta(
        usuario_id=usuario.id,
        mp_customer_id=datos.get("mp_customer_id") or usuario.mp_customer_id,
        mp_card_id=datos.get("mp_card_id"),
        marca=_marca_normalizada(datos.get("marca")),
        ultimos4=datos.get("ultimos4"),
        vencimiento=datos.get("vencimiento"),
        tipo=datos["tipo"],
        titular=titular or usuario.nombre,
        estado=VALIDADA,
        # La primera de su tipo queda como predeterminada del slot que le toca.
        predeterminada_cobro=(datos["tipo"] == "debito"
                              and not any(t.tipo == "debito" for t in validadas_previas)),
        predeterminada_garantia=(datos["tipo"] == "credito"
                                 and not any(t.tipo == "credito" for t in validadas_previas)),
    )
    db.add(tarjeta)
    db.commit()
    db.refresh(tarjeta)

    sincronizar_estado_usuario(db, usuario)
    return tarjeta


# ===========================================================================
# Baja
# ===========================================================================
def eliminar(db: Session, usuario: Usuario, tarjeta_id: str) -> None:
    tarjeta = (
        db.query(Tarjeta)
        .filter(Tarjeta.id == tarjeta_id, Tarjeta.usuario_id == usuario.id)
        .first()
    )
    if not tarjeta:
        raise WalletError(404, "TARJETA_NO_ENCONTRADA", "La tarjeta no existe o no es tuya.")

    en_uso = (
        db.query(Reserva)
        .filter(
            Reserva.estado.in_(_RESERVA_VIVA),
            (Reserva.tarjeta_cobro_id == tarjeta_id) | (Reserva.tarjeta_garantia_id == tarjeta_id),
        )
        .first()
    )
    if en_uso:
        raise WalletError(
            409, "TARJETA_EN_USO",
            "Esa tarjeta está respaldando un arriendo activo. Podrás eliminarla cuando termine.",
        )

    # Protección de 30 días post-arriendo para tarjetas de crédito de garantía:
    # El dueño dispone de 30 días para reportar peajes, TAG o multas ocurridas durante el arriendo.
    from datetime import datetime, timedelta, timezone
    limite_post_arriendo = datetime.now(timezone.utc) - timedelta(days=30)
    en_periodo_post_arriendo = (
        db.query(Reserva)
        .filter(
            Reserva.tarjeta_garantia_id == tarjeta_id,
            Reserva.estado == "finalizada",
            Reserva.fecha_fin >= limite_post_arriendo,
        )
        .first()
    )
    if en_periodo_post_arriendo:
        raise WalletError(
            409, "TARJETA_EN_PERIODO_POST_ARRIENDO",
            "Esta tarjeta respaldó un arriendo finalizado recientemente. Por seguridad y respaldo ante cobros de TAG o multas de tránsito pendientes, debe permanecer activa por 30 días tras la devolución.",
        )

    card_vault.eliminar_tarjeta(tarjeta.mp_customer_id, tarjeta.mp_card_id)

    era_pred_cobro = tarjeta.predeterminada_cobro
    era_pred_garantia = tarjeta.predeterminada_garantia
    db.delete(tarjeta)
    db.commit()

    # Si se borró una predeterminada, asciende otra del mismo tipo.
    restantes = [t for t in listar(db, usuario) if t.estado == VALIDADA]
    if era_pred_cobro:
        sig = next((t for t in restantes if t.tipo == "debito"), None)
        if sig:
            sig.predeterminada_cobro = True
    if era_pred_garantia:
        sig = next((t for t in restantes if t.tipo == "credito"), None)
        if sig:
            sig.predeterminada_garantia = True
    db.commit()

    sincronizar_estado_usuario(db, usuario)
