"""
Análisis de certificados oficiales del Registro Civil en PDF: antecedentes,
hoja de vida del conductor y anotaciones vigentes de un vehículo. Los tres se
descargan gratis con ClaveÚnica y traen folio y código de verificación.

Reglas de diseño (falla cerrado):

  · Este módulo NUNCA aprueba. Comprueba todo lo que se puede ver en el
    documento (tipo, RUT, patente, fecha, contenido). La autenticidad (que no
    sea un PDF editado) solo la da el código de verificación de registrocivil.cl,
    y ese sitio rechaza las consultas automáticas (protección anti-bots), así que
    un documento correcto queda en `revision` con `contenido_ok=True`: al admin
    solo le falta confirmar el código en el navegador.
  · Solo lo claramente inválido se rechaza (otra persona, otra patente, vencido,
    otro tipo de documento). Todo lo dudoso, ilegible o no interpretado va a
    `revision`; jamás se asume "limpio".
  · Los patrones de antecedentes y hoja de vida se contrastaron con PDF reales (formato de
    2026-09; ver tests/test_certificados_formato_real.py). El de anotaciones vigentes sigue
    escrito contra texto sintético: no hay una muestra real.
"""
import io
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional

from app.core.validators import formatear_rut, normalizar_rut, validar_rut_chileno

logger = logging.getLogger(__name__)

TIPO_ANTECEDENTES = "antecedentes"
TIPO_HOJA_VIDA = "hoja_vida"
TIPO_ANOTACIONES = "anotaciones_vigentes"
TIPOS = (TIPO_ANTECEDENTES, TIPO_HOJA_VIDA, TIPO_ANOTACIONES)

_MARCADOR = {
    TIPO_ANTECEDENTES: "CERTIFICADO DE ANTECEDENTES",
    TIPO_HOJA_VIDA: "HOJA DE VIDA DEL CONDUCTOR",
    TIPO_ANOTACIONES: "ANOTACIONES VIGENTES",
}
_NOMBRE = {
    TIPO_ANTECEDENTES: "certificado de antecedentes",
    TIPO_HOJA_VIDA: "hoja de vida del conductor",
    TIPO_ANOTACIONES: "certificado de anotaciones vigentes",
}
_MESES = {
    "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4, "MAYO": 5, "JUNIO": 6, "JULIO": 7,
    "AGOSTO": 8, "SEPTIEMBRE": 9, "SETIEMBRE": 9, "OCTUBRE": 10, "NOVIEMBRE": 11, "DICIEMBRE": 12,
}

MAX_PAGINAS = 10


@dataclass
class ResultadoCertificado:
    estado: str  # "revision" | "rechazado" (este módulo nunca devuelve "aprobado")
    motivo: str
    contenido_ok: bool = False
    rut: Optional[str] = None
    patente: Optional[str] = None
    folio: Optional[str] = None
    codigo_verificacion: Optional[str] = None
    emitido_en: Optional[date] = None
    hallazgos: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Lectura del PDF
# ---------------------------------------------------------------------------
def extraer_texto_pdf(datos: Optional[bytes]) -> str:
    """Texto del PDF digital ("" si no es un PDF válido, está cifrado o no trae texto)."""
    if not datos or not isinstance(datos, (bytes, bytearray)) or not bytes(datos).lstrip()[:5] == b"%PDF-":
        return ""
    try:
        from pypdf import PdfReader

        lector = PdfReader(io.BytesIO(bytes(datos)))
        if lector.is_encrypted:
            return ""
        return "\n".join((pagina.extract_text() or "") for pagina in lector.pages[:MAX_PAGINAS])
    except Exception:  # noqa: BLE001 — un PDF corrupto no debe reventar la subida
        logger.warning("No se pudo leer el texto de un PDF de certificado")
        return ""


# ---------------------------------------------------------------------------
# Utilidades de texto
# ---------------------------------------------------------------------------
def _normalizar(texto: str) -> str:
    """Mayúsculas, sin tildes y con espacios colapsados."""
    sin_tildes = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin_tildes.upper()).strip()


def _ruts_validos(norm: str) -> List[str]:
    """RUT con dígito verificador correcto, formateados y sin repetidos, en orden de aparición."""
    encontrados: List[str] = []
    for m in re.finditer(r"(\d{1,2}(?:\.\d{3}){2}|\d{7,8})\s*-\s*([\dK])", norm):
        candidato = f"{m.group(1)}-{m.group(2)}"
        if validar_rut_chileno(candidato):
            formateado = formatear_rut(candidato)
            if formateado not in encontrados:
                encontrados.append(formateado)
    return encontrados


def _fecha_en(ventana: str) -> Optional[date]:
    m = re.search(r"(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s+(?:DE\s+|DEL\s+)?(\d{4})", ventana)
    if m and m.group(2) in _MESES:
        return _crear_fecha(int(m.group(3)), _MESES[m.group(2)], int(m.group(1)))
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", ventana)
    if m:
        return _crear_fecha(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", ventana)
    if m:
        return _crear_fecha(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def _crear_fecha(anio: int, mes: int, dia: int) -> Optional[date]:
    try:
        return date(anio, mes, dia)
    except ValueError:
        return None


def _fecha_de_emision(norm: str) -> Optional[date]:
    """Fecha que aparece justo después de la etiqueta de emisión (nunca la de nacimiento u otra)."""
    for etiqueta in re.finditer(r"(?:FECHA DE EMISION|EMISION|EMITIDO|EXPEDICION|EXPEDIDO)", norm):
        f = _fecha_en(norm[etiqueta.end():etiqueta.end() + 60])
        if f:
            return f
    return None


_PATRON_FECHA = re.compile(
    r"(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s+(?:DE\s+|DEL\s+)?(\d{4})|(\d{1,2})[/-](\d{1,2})[/-](\d{4})|(\d{4})-(\d{2})-(\d{2})"
)


def _fechas_en(ventana: str) -> List[date]:
    fechas: List[date] = []
    for m in _PATRON_FECHA.finditer(ventana):
        if m.group(1):
            f = _crear_fecha(int(m.group(3)), _MESES[m.group(2)], int(m.group(1))) if m.group(2) in _MESES else None
        elif m.group(4):
            f = _crear_fecha(int(m.group(6)), int(m.group(5)), int(m.group(4)))
        else:
            f = _crear_fecha(int(m.group(7)), int(m.group(8)), int(m.group(9)))
        if f:
            fechas.append(f)
    return fechas


def fecha_de_vencimiento(texto: Optional[str]) -> Optional[date]:
    """
    Fecha hasta la que vale un documento (SOAP, permiso, revisión técnica...): la última que aparece
    tras una etiqueta de vigencia ("VIGENCIA 01-04-2026 AL 31-03-2027" -> 31-03-2027). `None` si el
    texto no dice nada de vigencia: un documento sin fecha legible NO se da por vencido.
    """
    norm = _normalizar(texto or "")
    fechas: List[date] = []
    for etiqueta in re.finditer(r"(?:FECHA DE VENCIMIENTO|VENCIMIENTO|VENCE|VALIDO HASTA|VIGENTE HASTA|VIGENCIA|VALIDEZ)", norm):
        fechas.extend(_fechas_en(norm[etiqueta.end():etiqueta.end() + 50]))
    return max(fechas) if fechas else None


def _folio_y_codigo(texto: str) -> tuple[Optional[str], Optional[str]]:
    """Se busca en el texto ORIGINAL: el código distingue mayúsculas de minúsculas."""
    folio = re.search(r"folio\s*(?:n[°ºo.]*)?\s*[:\-]?\s*(\d{6,})", texto, re.I)
    codigo = re.search(
        r"(?:c[oó]digo\s+(?:de\s+)?verificaci[oó]n|c[oó]digo\s+verificador|cve)\s*[:\-]?\s*([A-Za-z0-9]{8,20})",
        texto, re.I,
    )
    return (folio.group(1) if folio else None, codigo.group(1) if codigo else None)


def _patente_normalizada(valor: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (valor or "").upper())


# ---------------------------------------------------------------------------
# Contenido por tipo de certificado
# ---------------------------------------------------------------------------
_RUT_EN_FILA = r"\d{7,8}-[\dK]"


def _seccion(norm: str, desde: str, hasta: tuple) -> Optional[str]:
    """Texto entre un encabezado y el siguiente marcador (None si el encabezado no está)."""
    i = norm.find(desde)
    if i < 0:
        return None
    resto = norm[i + len(desde):]
    cortes = [resto.find(h) for h in hasta if resto.find(h) >= 0]
    return resto[:min(cortes)] if cortes else resto


def _fila_de_registro(seccion: Optional[str], afirmativa: str) -> Optional[bool]:
    """
    Fila "RUN + resultado" de una sección del certificado real.
    True solo si dice `afirmativa` ("SIN ANTECEDENTES") y NO trae nada más que los encabezados de la
    tabla: una condena listada debajo, aunque el resto diga "sin", no puede pasar por limpia.
    """
    if seccion is None:
        return None
    if re.search(r"\b(?:CON|REGISTRA) (?:ANTECEDENTES|ANOTACIONES)", seccion):
        return False
    if afirmativa not in seccion:
        return None
    resto = seccion.replace(afirmativa, " ")
    resto = re.sub(_RUT_EN_FILA, " ", resto)
    resto = re.sub(r"\bR U N\b|\bFINES\b|\bPARTICULARES\b|VIOLENCIA INTRAFAMILIAR|POR ACTOS DE", " ", resto)
    return True if not resto.strip() else None


def _contenido_antecedentes(norm: str):
    if "REGISTRO GENERAL DE CONDENAS" in norm:
        # Formato real: los encabezados dicen "CONDENAS" aunque no haya ninguna, así que se lee la fila.
        general = _seccion(norm, "REGISTRO GENERAL DE CONDENAS", ("REGISTRO ESPECIAL DE CONDENAS", "FECHA EMISION"))
        vif = _seccion(norm, "REGISTRO ESPECIAL DE CONDENAS", ("FECHA EMISION",))
        sin = _fila_de_registro(general, "SIN ANTECEDENTES")
        vif_ok = _fila_de_registro(vif, "SIN ANOTACIONES")
        hallazgos = {"sin_antecedentes": sin, "vif_sin_anotaciones": vif_ok}
        if sin is False:
            return False, hallazgos, "El certificado indica que la persona registra antecedentes: lo decide un ejecutivo."
        if sin is None:
            return False, hallazgos, "No pudimos interpretar si el certificado registra antecedentes."
        if vif_ok is not True:
            return False, hallazgos, (
                "No pudimos confirmar que no haya anotaciones de violencia intrafamiliar: lo decide un ejecutivo."
            )
        return True, hallazgos, None

    dice_no = "NO REGISTRA ANTECEDENTES" in norm or "SIN ANTECEDENTES" in norm
    dice_si = bool(re.search(r"(?<!NO )REGISTRA ANTECEDENTES", norm)) or "CONDENA" in norm
    if dice_no and not dice_si:
        sin = True
    elif dice_si and not dice_no:
        sin = False
    else:
        sin = None  # no dice nada, o dice ambas cosas: no se interpreta
    hallazgos = {"sin_antecedentes": sin}
    if sin is True:
        return True, hallazgos, None
    if sin is False:
        return False, hallazgos, "El certificado indica que la persona registra antecedentes: lo decide un ejecutivo."
    return False, hallazgos, "No pudimos interpretar si el certificado registra antecedentes."


def _infracciones_de(texto: str) -> List[Dict[str, str]]:
    """Cada bloque "Infracción : ... Resolución : ..." de la hoja de vida (texto original, con tildes)."""
    detalle: List[Dict[str, str]] = []
    for m in re.finditer(r"Infracci[oó]n\s*:\s*(.+?)\s*Resoluci[oó]n\s*:\s*([^\n]*)", texto, re.S | re.I):
        detalle.append({
            "descripcion": re.sub(r"\s+", " ", m.group(1)).strip()[:200],
            "resolucion": re.sub(r"\s+", " ", m.group(2)).strip()[:60],
        })
    return detalle


def _contenido_hoja_vida(norm: str, texto: str = ""):
    suspendida = bool(re.search(r"SUSPENSION|SUSPENDID|CANCELACION|CANCELAD|INHABILITA", norm))
    graves = len(re.findall(r"GRAVISIM[AO]", norm)) + len(re.findall(r"\bGRAVE\b", norm))
    sentencias = len(re.findall(r"PROCESO NUMERO", norm))
    infracciones = len(re.findall(r"\bINFRACCION\s*:", norm))
    limpia = (
        bool(re.search(_RUT_EN_FILA + r" SIN ANTECEDENTES", norm))
        or "NO REGISTRA ANOTACIONES" in norm
        or "SIN ANOTACIONES" in norm
    )
    hallazgos = {
        "licencia_suspendida": suspendida,
        "infracciones_graves": graves,
        "sentencias": sentencias,
        "infracciones": infracciones,
        "detalle_infracciones": _infracciones_de(texto),
        "clases_licencia": sorted(set(re.findall(r"CLASE\s*:\s*([A-Z]\d?)\s+FECHA OTORGAMIENTO", norm))),
    }
    if suspendida:
        return False, hallazgos, "La hoja de vida indica una licencia suspendida o cancelada: lo decide un ejecutivo."
    if graves:
        return False, hallazgos, f"La hoja de vida registra {graves} infracción(es) grave(s) o gravísima(s): lo decide un ejecutivo."
    if sentencias or infracciones:
        # No se clasifica la gravedad por el texto: una multa por cinturón y una por conducir ebrio se ven igual.
        return False, hallazgos, (
            f"La hoja de vida registra {max(sentencias, infracciones)} sentencia(s) o infracción(es) de tránsito: "
            "lo decide un ejecutivo."
        )
    if limpia:
        return True, hallazgos, None
    return False, hallazgos, "No pudimos interpretar las anotaciones de la hoja de vida."


def _contenido_anotaciones(norm: str):
    gravamen = any(p in norm for p in ("PROHIBICION", "EMBARGO", "ENCARGO", "GRAVAMEN"))
    limpia = "SIN ANOTACIONES" in norm or "NO REGISTRA ANOTACIONES" in norm or "NO TIENE ANOTACIONES" in norm
    hallazgos = {"prohibiciones": gravamen}
    if gravamen:
        return False, hallazgos, "El vehículo registra prohibiciones, embargos o un encargo: lo decide un ejecutivo."
    if limpia:
        return True, hallazgos, None
    return False, hallazgos, "No pudimos interpretar las anotaciones del vehículo."


# ---------------------------------------------------------------------------
# Análisis
# ---------------------------------------------------------------------------
def analizar_certificado(
    texto: Optional[str],
    tipo: str,
    *,
    rut_esperado: Optional[str] = None,
    patente_esperada: Optional[str] = None,
    hoy: Optional[date] = None,
    vigencia_dias: int = 30,
) -> ResultadoCertificado:
    """
    Comprueba un certificado ya convertido a texto. Devuelve `rechazado` solo ante
    algo claramente inválido; en cualquier otro caso `revision`, con
    `contenido_ok=True` únicamente si todo coincide y solo falta confirmar el
    código de verificación.
    """
    if tipo not in TIPOS:
        raise ValueError(f"Tipo de certificado desconocido: {tipo}")
    hoy = hoy or date.today()

    if not texto or not texto.strip():
        return ResultadoCertificado(
            estado="revision",
            motivo="No pudimos leer texto en el PDF. Sube el archivo original descargado del Registro Civil (no una foto).",
        )

    norm = _normalizar(texto)

    # 1) ¿Es el documento que se pidió?
    if _MARCADOR[tipo] not in norm:
        for otro in TIPOS:
            if otro != tipo and _MARCADOR[otro] in norm:
                return ResultadoCertificado(
                    estado="rechazado",
                    motivo=f"Este documento es un {_NOMBRE[otro]}, no un {_NOMBRE[tipo]}. Sube el correcto.",
                )
        return ResultadoCertificado(
            estado="revision",
            motivo=f"No reconocimos el documento como un {_NOMBRE[tipo]}.",
        )

    resultado = ResultadoCertificado(estado="revision", motivo="")
    dudas: List[str] = []
    ruts = _ruts_validos(norm)
    esperado = normalizar_rut(rut_esperado)

    # 2) ¿Es de la persona o del auto correcto?
    if tipo == TIPO_ANOTACIONES:
        if patente_esperada:
            buscada = _patente_normalizada(patente_esperada)
            if buscada not in _patente_normalizada(norm):
                return ResultadoCertificado(
                    estado="rechazado",
                    motivo="El certificado es de otra patente que la del vehículo.",
                )
            resultado.patente = buscada
        if esperado and ruts and not any(normalizar_rut(r) == esperado for r in ruts):
            dudas.append("El titular del vehículo no coincide con el dueño de la cuenta: hay que confirmar la autorización.")
        elif not ruts:
            dudas.append("No pudimos leer el RUT del titular.")
        resultado.rut = next((r for r in ruts if normalizar_rut(r) == esperado), ruts[0] if ruts else None)
    else:
        if not ruts:
            dudas.append("No pudimos leer un RUT válido en el certificado.")
        elif esperado and not any(normalizar_rut(r) == esperado for r in ruts):
            return ResultadoCertificado(
                estado="rechazado",
                motivo="El certificado es de otra persona: el RUT no coincide con el de tu cuenta.",
            )
        resultado.rut = next((r for r in ruts if normalizar_rut(r) == esperado), ruts[0] if ruts else None)

    # 3) Vigencia
    emitido = _fecha_de_emision(norm)
    resultado.emitido_en = emitido
    if emitido is None:
        dudas.append("No pudimos leer la fecha de emisión.")
    elif emitido > hoy:
        dudas.append("La fecha de emisión del certificado es futura.")
    elif (hoy - emitido).days > vigencia_dias:
        return ResultadoCertificado(
            estado="rechazado",
            motivo=f"El certificado tiene más de {vigencia_dias} días. Descarga uno nuevo (es gratis).",
            rut=resultado.rut, emitido_en=emitido,
        )

    # 4) Folio y código de verificación
    resultado.folio, resultado.codigo_verificacion = _folio_y_codigo(texto)
    if not resultado.folio or not resultado.codigo_verificacion:
        dudas.append("No encontramos el folio y el código de verificación del certificado.")

    # 5) Contenido
    if tipo == TIPO_ANTECEDENTES:
        ok, resultado.hallazgos, duda = _contenido_antecedentes(norm)
    elif tipo == TIPO_HOJA_VIDA:
        ok, resultado.hallazgos, duda = _contenido_hoja_vida(norm, texto)
    else:
        ok, resultado.hallazgos, duda = _contenido_anotaciones(norm)
    if duda:
        dudas.append(duda)

    if dudas or not ok:
        resultado.contenido_ok = False
        resultado.motivo = " ".join(dudas) or "El contenido del certificado requiere revisión."
    else:
        resultado.contenido_ok = True
        resultado.motivo = (
            "Los datos del certificado coinciden. Falta confirmar el código de verificación en registrocivil.cl."
        )
    return resultado
