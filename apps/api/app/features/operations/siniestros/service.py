"""
Siniestros: el arrendatario reporta un accidente durante el arriendo y el
soporte 24/7 lo toma.

Al reportarlo se abre una disputa de tipo "accidente": mientras esté abierta la
garantía no se libera (la devolución la retiene y la reserva queda "disputada"),
y el dinero se decide por el flujo normal de disputas. También se abre un
ticket para la bandeja de soporte.

Todo lo que se comunica queda en `Siniestro.actualizaciones` y les llega a las
dos partes con el mismo texto, por la app y por correo.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.features.communications.email.service import enviar_aviso_tras_commit
from app.features.communications.notifications.service import crear_notificacion
from app.features.system.storage.service import StorageService
from app.models.entities import Auto, Disputa, Reserva, Siniestro, TicketSoporte, Usuario

logger = logging.getLogger(__name__)

ROLES_SOPORTE = ("admin", "manager", "soporte")


def es_soporte(usuario: Usuario) -> bool:
    return any(r in (usuario.roles_activos or []) for r in ROLES_SOPORTE)


def requerir_soporte(usuario: Usuario) -> None:
    if not es_soporte(usuario):
        raise HTTPException(status_code=403, detail="Acceso restringido al equipo de soporte.")


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _codigo_nuevo(db: Session) -> str:
    while True:
        codigo = f"SIN-{secrets.token_hex(3).upper()}"
        if not db.query(Siniestro.id).filter(Siniestro.codigo == codigo).first():
            return codigo


def siniestro_abierto(db: Session, reserva_id: str) -> Optional[Siniestro]:
    return (
        db.query(Siniestro)
        .filter(Siniestro.reserva_id == reserva_id, Siniestro.estado != "cerrado")
        .first()
    )


def _partes(db: Session, reserva: Reserva):
    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None
    return auto, cliente, dueno


def _personal_de_soporte(db: Session) -> List[Usuario]:
    return db.query(Usuario).filter(
        or_(*[cast(Usuario.roles_activos, String).ilike(f'%"{rol}"%') for rol in ROLES_SOPORTE])
    ).all()


def _registrar(siniestro: Siniestro, autor: str, mensaje: str) -> None:
    # Se reasigna la lista entera: mutarla en su lugar no marca la columna JSON como cambiada.
    siniestro.actualizaciones = list(siniestro.actualizaciones or []) + [
        {"fecha": _ahora().isoformat(), "autor": autor, "mensaje": mensaje}
    ]


def _avisar(db: Session, usuario: Optional[Usuario], siniestro: Siniestro, titulo: str, mensaje: str) -> None:
    """Notificación en la app + correo tras el commit, para que quede por escrito."""
    if not usuario:
        return
    crear_notificacion(
        db, usuario_id=usuario.id, tipo="siniestro", titulo=titulo, mensaje=mensaje,
        entidad_tipo="reserva", entidad_id=siniestro.reserva_id, commit=False,
    )
    enviar_aviso_tras_commit(
        db, email=usuario.email, asunto=f"{titulo} · caso {siniestro.codigo}", titulo=titulo, mensaje=mensaje,
    )


def informar_a_ambas_partes(
    db: Session, siniestro: Siniestro, titulo: str, mensaje: str, autor: str = "soporte"
) -> None:
    reserva = db.query(Reserva).filter(Reserva.id == siniestro.reserva_id).first()
    _, cliente, dueno = _partes(db, reserva)
    _registrar(siniestro, autor, mensaje)
    _avisar(db, cliente, siniestro, titulo, mensaje)
    _avisar(db, dueno, siniestro, titulo, mensaje)


def reportar(db: Session, reserva: Reserva, usuario: Usuario, datos) -> Siniestro:
    if reserva.cliente_id != usuario.id:
        raise HTTPException(status_code=403, detail="Solo el arrendatario de esta reserva puede reportar un accidente.")
    if reserva.estado != "en_curso":
        raise HTTPException(
            status_code=409,
            detail="Solo se puede reportar un accidente con el arriendo en curso. Si ya devolviste el auto, escribe a soporte.",
        )
    if siniestro_abierto(db, reserva.id):
        raise HTTPException(
            status_code=409, detail="Ya hay un accidente reportado en este arriendo: el soporte lo está atendiendo."
        )
    # Con lesionados lo primero es la atención médica: las fotos pueden llegar después.
    if not datos.fotos and not datos.hubo_lesionados:
        raise HTTPException(status_code=400, detail="Adjunta al menos una foto del auto o del lugar del accidente.")

    auto, cliente, dueno = _partes(db, reserva)
    auto_txt = f"{auto.marca} {auto.modelo} ({auto.patente})" if auto else "el auto"
    codigo = _codigo_nuevo(db)

    disputa = Disputa(
        reserva_id=reserva.id,
        tipo="accidente",
        estado="abierta",
        motivo=f"Siniestro {codigo} reportado por el arrendatario: {datos.descripcion}",
        evidencia_fotos=list(datos.fotos or []),
        foto_evidencia_url=datos.fotos[0] if datos.fotos else None,
    )
    db.add(disputa)
    db.flush()

    ticket = TicketSoporte(
        usuario_id=usuario.id,
        sucursal_id=usuario.sucursal_id,
        asunto=f"[{codigo}] Accidente en arriendo de {auto_txt}",
        descripcion=datos.descripcion,
        escalado_a_disputa=True,
        disputa_id=disputa.id,
    )
    db.add(ticket)
    db.flush()

    siniestro = Siniestro(
        codigo=codigo,
        reserva_id=reserva.id,
        reportado_por_id=usuario.id,
        estado="reportado",
        descripcion=datos.descripcion,
        hubo_lesionados=datos.hubo_lesionados,
        hay_terceros=datos.hay_terceros,
        auto_puede_circular=datos.auto_puede_circular,
        parte_policial=datos.parte_policial,
        datos_tercero=datos.datos_tercero,
        ubicacion=datos.ubicacion,
        latitud=datos.latitud,
        longitud=datos.longitud,
        fotos=list(datos.fotos or []),
        disputa_id=disputa.id,
        ticket_id=ticket.id,
        actualizaciones=[],
    )
    db.add(siniestro)
    db.flush()

    _registrar(siniestro, "sistema", "Accidente reportado por el arrendatario. El soporte 24/7 fue alertado.")

    _avisar(
        db, cliente, siniestro, "Recibimos tu reporte de accidente",
        f"Tu caso es el {codigo}. Un agente de soporte 24/7 te va a contactar en los próximos minutos. "
        "Si hay heridos, llama al 131 (SAMU) o al 133 (Carabineros) antes que nada. "
        "No firmes acuerdos con terceros ni dejes el auto sin avisarnos. "
        "La garantía queda retenida mientras se resuelve el caso: se cobra solo lo que corresponda "
        "según el contrato y se te informa por escrito.",
    )
    _avisar(
        db, dueno, siniestro, f"Tu {auto_txt} tuvo un accidente",
        f"El arrendatario reportó un accidente (caso {codigo}). "
        + ("Hubo personas lesionadas. " if datos.hubo_lesionados else "")
        + ("El auto no puede circular. " if not datos.auto_puede_circular else "")
        + "Un agente de soporte 24/7 te va a llamar para contarte el detalle y los pasos a seguir. "
        "La garantía del arrendatario quedó retenida mientras se resuelve el caso. "
        "Puedes ver las fotos y el reporte en la reserva.",
    )
    for agente in _personal_de_soporte(db):
        crear_notificacion(
            db, usuario_id=agente.id, tipo="siniestro",
            titulo=f"URGENTE · Accidente {codigo}",
            mensaje=(
                f"{auto_txt}. "
                + ("CON LESIONADOS. " if datos.hubo_lesionados else "")
                + ("Auto no puede circular. " if not datos.auto_puede_circular else "")
                + "Contactar al arrendatario y al dueño."
            ),
            entidad_tipo="siniestro", entidad_id=siniestro.id, commit=False,
        )
    logger.warning("[SINIESTRO] %s reportado en reserva %s", codigo, reserva.id)
    return siniestro


def atender(db: Session, siniestro: Siniestro, agente: Usuario) -> Siniestro:
    if siniestro.estado == "cerrado":
        raise HTTPException(status_code=409, detail="El caso ya está cerrado.")
    siniestro.agente_id = agente.id
    if siniestro.estado == "reportado":
        siniestro.estado = "en_atencion"
        siniestro.atendido_en = _ahora()
        informar_a_ambas_partes(
            db, siniestro, "Un agente está a cargo del caso",
            f"El caso {siniestro.codigo} ya tiene un agente de soporte asignado. Te contactaremos por teléfono "
            "y todo lo que se decida te llegará por escrito.",
            autor="sistema",
        )
    return siniestro


def marcar_dueno_contactado(siniestro: Siniestro, agente: Usuario) -> Siniestro:
    if siniestro.estado == "cerrado":
        raise HTTPException(status_code=409, detail="El caso ya está cerrado.")
    siniestro.dueno_contactado_en = _ahora()
    _registrar(siniestro, "soporte", f"Soporte habló por teléfono con el dueño del auto ({agente.nombre or agente.email}).")
    return siniestro


def cerrar(db: Session, siniestro: Siniestro, resumen: str) -> Siniestro:
    if siniestro.estado == "cerrado":
        raise HTTPException(status_code=409, detail="El caso ya está cerrado.")
    disputa = db.query(Disputa).filter(Disputa.id == siniestro.disputa_id).first() if siniestro.disputa_id else None
    if disputa and disputa.estado != "resuelta":
        raise HTTPException(
            status_code=409,
            detail="Primero resuelve la disputa del caso (qué se cobra de la garantía), así queda informado a ambas partes.",
        )
    siniestro.estado = "cerrado"
    siniestro.cerrado_en = _ahora()
    siniestro.resumen_cierre = resumen
    informar_a_ambas_partes(db, siniestro, f"Caso {siniestro.codigo} cerrado", resumen)
    if siniestro.ticket_id:
        ticket = db.query(TicketSoporte).filter(TicketSoporte.id == siniestro.ticket_id).first()
        if ticket:
            ticket.estado = "cerrado"
    return siniestro


def a_salida(db: Session, siniestro: Siniestro, para_soporte: bool = False) -> dict:
    """Serializa el caso renovando las URLs firmadas de las fotos (bucket privado)."""
    fotos, _ = StorageService.renovar_lista_urls(siniestro.fotos or [])
    if fotos != (siniestro.fotos or []):
        siniestro.fotos = fotos
    datos = {c.name: getattr(siniestro, c.name) for c in Siniestro.__table__.columns}
    datos["fotos"] = fotos
    datos["actualizaciones"] = siniestro.actualizaciones or []
    reserva = db.query(Reserva).filter(Reserva.id == siniestro.reserva_id).first()
    if reserva:
        auto, cliente, dueno = _partes(db, reserva)
        datos["auto_descripcion"] = f"{auto.marca} {auto.modelo} ({auto.patente})" if auto else None
        if para_soporte:
            datos.update(
                cliente_nombre=cliente.nombre if cliente else None,
                cliente_telefono=cliente.telefono if cliente else None,
                dueno_nombre=dueno.nombre if dueno else None,
                dueno_telefono=dueno.telefono if dueno else None,
            )
    return datos
