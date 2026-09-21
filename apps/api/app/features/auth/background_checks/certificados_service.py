"""
Certificados de antecedentes: registro, revisión del admin y cálculo del estado.

`antecedentes_estado` (personas) se calcula SOLO a partir de certificados:

  bloqueado > revision > pendiente > limpio

  · limpio     ambos certificados (antecedentes y hoja de vida) aprobados por un
               ejecutivo y dentro de `ANTECEDENTES_REVERIFICACION_DIAS`.
  · bloqueado  el último certificado de alguno fue rechazado por un hallazgo real
               (licencia suspendida o antecedentes), no por un defecto del archivo.
  · revision   hay algún certificado esperando al ejecutivo.
  · pendiente  falta subir alguno, se rechazó por un defecto o la aprobación venció.

Sin certificados es "pendiente", nunca "limpio": el proveedor anterior devolvía
"limpio" en desarrollo y también cuando fallaba la red.
"""
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.features.auth.background_checks.certificados import (
    TIPO_ANOTACIONES,
    TIPO_ANTECEDENTES,
    TIPO_HOJA_VIDA,
    TIPOS,
    analizar_certificado,
    extraer_texto_pdf,
)
from app.features.system.storage.service import StorageService
from app.models.entities import Auto, CertificadoAntecedente, ConductorAdicional, Reserva, TicketSoporte, Usuario

logger = logging.getLogger(__name__)

TIPOS_PERSONA = (TIPO_ANTECEDENTES, TIPO_HOJA_VIDA)
SUJETOS = ("usuario", "conductor_adicional", "auto")

_NOMBRE_TIPO = {
    TIPO_ANTECEDENTES: "certificado de antecedentes",
    TIPO_HOJA_VIDA: "hoja de vida del conductor",
    TIPO_ANOTACIONES: "certificado de anotaciones vigentes",
}


class CertificadoError(Exception):
    """Falla de negocio al registrar o revisar un certificado. `codigo` es estable."""

    def __init__(self, http_status: int, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.http_status = http_status
        self.codigo = codigo
        self.mensaje = mensaje

    def as_detail(self) -> Dict[str, Any]:
        return {"codigo": self.codigo, "mensaje": self.mensaje}


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ===========================================================================
# Estado
# ===========================================================================
def _hallazgo_adverso(c: CertificadoAntecedente) -> bool:
    h = c.resultado_json or {}
    return bool(h.get("licencia_suspendida")) or h.get("sin_antecedentes") is False


def estado_de_antecedentes(
    certificados: Iterable[CertificadoAntecedente],
    *,
    ahora: Optional[datetime] = None,
    reverificacion_dias: Optional[int] = None,
) -> str:
    """Estado de una persona a partir de sus certificados (ver el docstring del módulo)."""
    ahora = ahora or _ahora()
    dias = reverificacion_dias if reverificacion_dias is not None else settings.ANTECEDENTES_REVERIFICACION_DIAS

    ultimos: Dict[str, CertificadoAntecedente] = {}
    orden = sorted(
        (c for c in certificados if c.tipo in TIPOS_PERSONA),
        key=lambda c: _aware(c.creado_en) or datetime.min.replace(tzinfo=timezone.utc),
    )
    for c in orden:
        ultimos[c.tipo] = c

    if any(c.estado == "rechazado" and _hallazgo_adverso(c) for c in ultimos.values()):
        return "bloqueado"
    if any(c.estado == "revision" for c in ultimos.values()):
        return "revision"

    for tipo in TIPOS_PERSONA:
        c = ultimos.get(tipo)
        if c is None or c.estado != "aprobado":
            return "pendiente"
        aprobado_en = _aware(c.revisado_en) or _aware(c.creado_en)
        if aprobado_en and (ahora - aprobado_en).days > dias:
            return "pendiente"
    return "limpio"


def _certificados_de(db: Session, sujeto_tipo: str, sujeto_id: str):
    return (
        db.query(CertificadoAntecedente)
        .filter(CertificadoAntecedente.sujeto_tipo == sujeto_tipo, CertificadoAntecedente.sujeto_id == sujeto_id)
        .all()
    )


def recalcular_estado_usuario(db: Session, usuario: Usuario, ahora: Optional[datetime] = None) -> str:
    estado = estado_de_antecedentes(_certificados_de(db, "usuario", usuario.id), ahora=ahora)
    if usuario.antecedentes_estado != estado:
        usuario.antecedentes_estado = estado
        db.commit()
    return estado


def recalcular_estado_conductor(db: Session, conductor: ConductorAdicional, ahora: Optional[datetime] = None) -> str:
    estado = estado_de_antecedentes(_certificados_de(db, "conductor_adicional", conductor.id), ahora=ahora)
    if conductor.antecedentes_estado != estado:
        conductor.antecedentes_estado = estado
        db.commit()
    return estado


# ===========================================================================
# Autos
# ===========================================================================
def auto_esta_verificado(auto: Auto, ahora: Optional[datetime] = None) -> bool:
    """
    Un auto se ofrece y se reserva solo si tiene las tres cosas y ninguna venció: documentos
    revisados por un ejecutivo, certificado de anotaciones vigentes aprobado y consulta de
    encargo por robo sin encargo (`AUTOS_VERIFICADOS_OBLIGATORIOS`).
    """
    ahora = ahora or _ahora()
    limite = timedelta(days=settings.ANTECEDENTES_REVERIFICACION_DIAS)
    anotaciones = _aware(auto.anotaciones_aprobadas_en)
    consulta = _aware(auto.encargo_robo_consultado_en)
    return bool(
        auto.documentos_verificados
        and auto.encargo_robo_estado == "sin_encargo"
        and anotaciones and ahora - anotaciones <= limite
        and consulta and ahora - consulta <= limite
    )


def condicion_autos_verificados(ahora: Optional[datetime] = None):
    """Los mismos criterios de `auto_esta_verificado`, como filtros SQL para el catálogo."""
    ahora = ahora or _ahora()
    desde = (ahora - timedelta(days=settings.ANTECEDENTES_REVERIFICACION_DIAS)).replace(tzinfo=None)
    return [
        Auto.documentos_verificados.is_(True),
        Auto.encargo_robo_estado == "sin_encargo",
        Auto.anotaciones_aprobadas_en.isnot(None), Auto.anotaciones_aprobadas_en >= desde,
        Auto.encargo_robo_consultado_en.isnot(None), Auto.encargo_robo_consultado_en >= desde,
    ]


def _recalcular_auto(db: Session, auto_id: str) -> None:
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        return
    ultimo = None
    minimo = datetime.min.replace(tzinfo=timezone.utc)
    for c in sorted(_certificados_de(db, "auto", auto_id), key=lambda c: _aware(c.creado_en) or minimo):
        if c.tipo == TIPO_ANOTACIONES:
            ultimo = c
    aprobado = ultimo is not None and ultimo.estado == "aprobado" and ultimo.revisado_en is not None
    auto.anotaciones_aprobadas_en = _aware(ultimo.revisado_en).replace(tzinfo=None) if aprobado else None
    db.commit()


def _recalcular(db: Session, sujeto_tipo: str, sujeto_id: str) -> None:
    if sujeto_tipo == "auto":
        _recalcular_auto(db, sujeto_id)
    elif sujeto_tipo == "usuario":
        usuario = db.query(Usuario).filter(Usuario.id == sujeto_id).first()
        if usuario:
            recalcular_estado_usuario(db, usuario)
    elif sujeto_tipo == "conductor_adicional":
        conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == sujeto_id).first()
        if conductor:
            recalcular_estado_conductor(db, conductor)


def _destinatario(db: Session, sujeto_tipo: str, sujeto_id: str) -> Optional[str]:
    """A quién se le avisa: el propio usuario; del segundo conductor, el titular de la reserva."""
    if sujeto_tipo == "usuario":
        return sujeto_id
    if sujeto_tipo == "auto":
        a = db.query(Auto).filter(Auto.id == sujeto_id).first()
        return a.dueno_id if a else None
    if sujeto_tipo == "conductor_adicional":
        c = db.query(ConductorAdicional).filter(ConductorAdicional.id == sujeto_id).first()
        r = db.query(Reserva).filter(Reserva.id == c.reserva_id).first() if c else None
        return r.cliente_id if r else None
    return None


def _avisar(db: Session, destinatario: Optional[str], titulo: str, mensaje: str, sujeto_id: str) -> None:
    if not destinatario:
        return
    from app.features.communications.notifications.service import crear_notificacion

    crear_notificacion(
        db, usuario_id=destinatario, tipo="kyc", titulo=titulo, mensaje=mensaje,
        entidad_tipo="certificado", entidad_id=sujeto_id, commit=False,
    )


# ===========================================================================
# Registro y revisión
# ===========================================================================
def registrar_certificado(
    db: Session,
    *,
    sujeto_tipo: str,
    sujeto_id: str,
    tipo: str,
    pdf_bytes: bytes,
    archivo_url: Optional[str],
    subido_por: Usuario,
    consentimiento: bool,
    rut_esperado: Optional[str] = None,
    patente_esperada: Optional[str] = None,
) -> CertificadoAntecedente:
    """
    Analiza el PDF y lo deja registrado. Un documento correcto queda en `revision` (le
    falta el código de verificación, que solo confirma un ejecutivo); lo claramente
    inválido se rechaza acá mismo con el motivo para que la persona lo suba de nuevo.
    """
    if not consentimiento:
        raise CertificadoError(
            400, "CONSENTIMIENTO_REQUERIDO",
            "Necesitamos tu consentimiento para revisar este certificado: contiene datos personales sensibles.",
        )
    if tipo not in TIPOS or sujeto_tipo not in SUJETOS:
        raise CertificadoError(400, "TIPO_INVALIDO", "Tipo de certificado no válido.")
    if (tipo == TIPO_ANOTACIONES) != (sujeto_tipo == "auto"):
        raise CertificadoError(400, "TIPO_INVALIDO", "Ese certificado no corresponde a este tipo de solicitud.")

    resultado = analizar_certificado(
        extraer_texto_pdf(pdf_bytes), tipo,
        rut_esperado=rut_esperado, patente_esperada=patente_esperada,
        vigencia_dias=settings.ANTECEDENTES_VIGENCIA_DIAS,
    )
    emitido = datetime(resultado.emitido_en.year, resultado.emitido_en.month, resultado.emitido_en.day) \
        if resultado.emitido_en else None

    certificado = CertificadoAntecedente(
        sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id, tipo=tipo, archivo_url=archivo_url,
        sha256=hashlib.sha256(pdf_bytes or b"").hexdigest(),
        rut_detectado=resultado.rut, patente_detectada=resultado.patente,
        folio=resultado.folio, codigo_verificacion=resultado.codigo_verificacion, emitido_en=emitido,
        estado=resultado.estado, contenido_ok=resultado.contenido_ok, motivo=resultado.motivo,
        resultado_json=resultado.hallazgos, consentimiento_en=_ahora(), subido_por_id=subido_por.id,
    )
    db.add(certificado)
    db.flush()
    if sujeto_tipo == "auto" and resultado.estado != "rechazado":
        auto = db.query(Auto).filter(Auto.id == sujeto_id).first()
        if auto:
            auto.doc_anotaciones_vigentes_url = archivo_url

    nombre = _NOMBRE_TIPO[tipo]
    destinatario = _destinatario(db, sujeto_tipo, sujeto_id) or subido_por.id
    if resultado.estado == "revision":
        db.add(TicketSoporte(
            usuario_id=subido_por.id, sucursal_id=subido_por.sucursal_id,
            asunto=f"Revisar {nombre} (confirmar código de verificación)",
            descripcion=(
                f"Certificado {certificado.id} ({tipo}) de {sujeto_tipo} {sujeto_id}. {resultado.motivo}\n"
                "Confirma el folio y el código en https://www.registrocivil.cl/OficinaInternet/verificacion/"
                "verificacioncertificado.srcei y aprueba o rechaza desde el panel de revisión."
            ),
        ))
        _avisar(db, destinatario, "Recibimos tu certificado",
                "Un ejecutivo lo está revisando. Te avisamos apenas quede listo.", sujeto_id)
    else:
        _avisar(db, destinatario, "No pudimos aceptar el certificado", resultado.motivo, sujeto_id)
    db.commit()

    _recalcular(db, sujeto_tipo, sujeto_id)
    db.refresh(certificado)
    return certificado


def revisar_certificado(
    db: Session, certificado: CertificadoAntecedente, admin: Usuario, accion: str, notas: Optional[str] = None,
) -> CertificadoAntecedente:
    """El ejecutivo aprueba (tras confirmar el código en registrocivil.cl) o rechaza."""
    if accion not in ("aprobar", "rechazar"):
        raise CertificadoError(400, "ACCION_INVALIDA", "La acción debe ser 'aprobar' o 'rechazar'.")
    if certificado.estado != "revision":
        raise CertificadoError(409, "NO_ESTA_EN_REVISION", "Este certificado ya fue resuelto.")

    aprobar = accion == "aprobar"
    certificado.estado = "aprobado" if aprobar else "rechazado"
    certificado.revisado_por_id = admin.id
    certificado.revisado_en = _ahora()
    if notas:
        certificado.motivo = f"{certificado.motivo or ''} [Revisión: {notas}]".strip()

    nombre = _NOMBRE_TIPO.get(certificado.tipo, "certificado")
    _avisar(
        db, _destinatario(db, certificado.sujeto_tipo, certificado.sujeto_id),
        "Certificado aprobado" if aprobar else "Certificado rechazado",
        f"Tu {nombre} fue aprobado." if aprobar else (notas or f"Tu {nombre} no pudo ser aprobado. Revísalo y vuelve a subirlo."),
        certificado.sujeto_id,
    )
    db.commit()

    _recalcular(db, certificado.sujeto_tipo, certificado.sujeto_id)
    db.refresh(certificado)
    return certificado


# ===========================================================================
# Retención
# ===========================================================================
def purgar_certificados(db: Session, ahora: Optional[datetime] = None) -> int:
    """
    Borra el PDF de los certificados ya resueltos pasado `ANTECEDENTES_RETENCION_DIAS`: es dato personal
    sensible y, una vez decidido, solo hace falta el rastro (hash, folio, resultado). Lo que espera al
    ejecutivo no se toca. Si el borrado falla queda para el próximo pase. Devuelve cuántos purgó.
    """
    ahora = ahora or _ahora()
    limite = ahora - timedelta(days=settings.ANTECEDENTES_RETENCION_DIAS)
    candidatos = (
        db.query(CertificadoAntecedente)
        .filter(CertificadoAntecedente.archivo_url.isnot(None), CertificadoAntecedente.estado.in_(("aprobado", "rechazado")))
        .all()
    )
    purgados = 0
    for c in candidatos:
        referencia = _aware(c.revisado_en) or _aware(c.creado_en)
        if not referencia or referencia > limite:
            continue
        if not StorageService.eliminar_archivo_privado(c.archivo_url):
            continue
        if c.sujeto_tipo == "auto":
            auto = db.query(Auto).filter(Auto.id == c.sujeto_id).first()
            if auto and auto.doc_anotaciones_vigentes_url == c.archivo_url:
                auto.doc_anotaciones_vigentes_url = None
        c.archivo_url = None
        purgados += 1
    if purgados:
        db.commit()
    return purgados

