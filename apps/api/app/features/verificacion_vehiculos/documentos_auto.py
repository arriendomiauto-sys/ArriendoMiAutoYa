"""
Modelo de lectura y validación de los documentos legales de un vehículo:
padrón, permiso de circulación, seguro obligatorio (SOAP), seguro del auto
(póliza comercial) y revisión técnica.

Es deliberadamente puro: recibe el texto que devolvió el OCR y responde qué
documento es, de qué patente y hasta cuándo vale. Toda la parte de red
(descargar la imagen, llamar a Vision) vive en `car_doc_validator.py`, para
que estas reglas — que son las que deciden si un auto puede publicarse — se
puedan probar con texto de ejemplo, sin credenciales ni llamadas externas.

Qué valida, más allá de "se ve un documento":
  1. Que sea el documento que se pidió (un padrón subido como SOAP se rechaza).
  2. Que la patente impresa sea la del auto que se está publicando.
  3. Que esté vigente a la fecha, leyendo el vencimiento del propio documento.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.validators import validar_patente_chilena

# Un documento que vence en menos de esto se acepta, pero se avisa: el dueño
# alcanza a renovarlo antes de que se le caiga la publicación.
DIAS_AVISO_VENCIMIENTO = 30

# Menos texto que esto es una foto borrosa, un dedo tapando o una hoja en
# blanco: no es un documento que se pueda validar.
MINIMO_CARACTERES_LEGIBLE = 40


@dataclass(frozen=True)
class EspecificacionDocumento:
    tipo: str
    nombre: str
    # Frases impresas que identifican al documento. Se comparan sobre el
    # texto normalizado (mayúsculas, sin tildes).
    marcadores: Tuple[str, ...]
    # Rótulos que en ese documento anteceden a la fecha de término.
    marcadores_vencimiento: Tuple[str, ...]
    exige_vencimiento: bool
    obligatorio: bool


ESPECIFICACIONES: Dict[str, EspecificacionDocumento] = {
    "padron": EspecificacionDocumento(
        tipo="padron",
        nombre="Certificado de inscripción (padrón)",
        marcadores=(
            "CERTIFICADO DE INSCRIPCION",
            "REGISTRO DE VEHICULOS MOTORIZADOS",
            "SERVICIO DE REGISTRO CIVIL",
            "PADRON",
            "R.V.M",
            "RVM",
            "INSCRIPCION VIGENTE",
            "PROPIETARIO",
        ),
        # El padrón no vence: acredita inscripción, no vigencia.
        marcadores_vencimiento=(),
        exige_vencimiento=False,
        obligatorio=True,
    ),
    "permiso_circulacion": EspecificacionDocumento(
        tipo="permiso_circulacion",
        nombre="Permiso de circulación",
        marcadores=(
            "PERMISO DE CIRCULACION",
            "MUNICIPALIDAD",
            "DIRECCION DE TRANSITO",
            "TESORERIA MUNICIPAL",
            "VALOR PERMISO",
            "TASACION",
        ),
        marcadores_vencimiento=(
            "VENCE",
            "VENCIMIENTO",
            "VALIDO HASTA",
            "VALIDEZ",
            "HASTA EL",
            "PAGADO HASTA",
            "EXPIRA",
        ),
        exige_vencimiento=True,
        obligatorio=True,
    ),
    "soap": EspecificacionDocumento(
        tipo="soap",
        nombre="Seguro Obligatorio (SOAP)",
        marcadores=(
            "SEGURO OBLIGATORIO",
            "SOAP",
            "ACCIDENTES PERSONALES",
            "LEY 18.490",
            "LEY 18490",
        ),
        marcadores_vencimiento=(
            "HASTA",
            "VIGENCIA HASTA",
            "TERMINO DE VIGENCIA",
            "VENCIMIENTO",
            "VENCE",
            "VALIDO HASTA",
        ),
        exige_vencimiento=True,
        obligatorio=True,
    ),
    "seguro": EspecificacionDocumento(
        tipo="seguro",
        nombre="Seguro del auto (póliza)",
        marcadores=(
            "POLIZA",
            "COMPANIA DE SEGUROS",
            "SEGURO AUTOMOTRIZ",
            "COBERTURA",
            "DEDUCIBLE",
            "ASEGURADO",
            "PRIMA",
        ),
        marcadores_vencimiento=(
            "VIGENCIA HASTA",
            "HASTA",
            "TERMINO DE VIGENCIA",
            "VENCIMIENTO",
            "VENCE",
            "FIN DE VIGENCIA",
        ),
        exige_vencimiento=True,
        obligatorio=False,
    ),
    "revision_tecnica": EspecificacionDocumento(
        tipo="revision_tecnica",
        nombre="Revisión técnica",
        marcadores=(
            "REVISION TECNICA",
            "PLANTA DE REVISION",
            "CERTIFICADO DE REVISION",
            "ANALISIS DE GASES",
            "HOMOLOGACION",
            "MINISTERIO DE TRANSPORTES",
            "INSPECCION TECNICA",
        ),
        marcadores_vencimiento=(
            "VALIDO HASTA",
            "VENCE",
            "VENCIMIENTO",
            "PROXIMA REVISION",
            "HASTA",
        ),
        exige_vencimiento=True,
        obligatorio=True,
    ),
}

# El campo del modelo Auto que guarda cada documento.
CAMPO_POR_TIPO = {
    "padron": "doc_inscripcion_url",
    "permiso_circulacion": "doc_permiso_circulacion_url",
    "soap": "doc_soap_url",
    "seguro": "doc_seguro_url",
    "revision_tecnica": "doc_revision_tecnica_url",
}

_MESES = {
    "ENE": 1, "ENERO": 1, "FEB": 2, "FEBRERO": 2, "MAR": 3, "MARZO": 3,
    "ABR": 4, "ABRIL": 4, "MAY": 5, "MAYO": 5, "JUN": 6, "JUNIO": 6,
    "JUL": 7, "JULIO": 7, "AGO": 8, "AGOSTO": 8, "SEP": 9, "SEPT": 9,
    "SEPTIEMBRE": 9, "OCT": 10, "OCTUBRE": 10, "NOV": 11, "NOVIEMBRE": 11,
    "DIC": 12, "DICIEMBRE": 12,
}


def normalizar(texto: Optional[str]) -> str:
    """Mayúsculas, sin tildes y con espacios colapsados."""
    if not texto:
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    return re.sub(r"\s+", " ", sin_tildes.upper()).strip()


def _ultimo_dia_del_mes(anio: int, mes: int) -> int:
    if mes == 12:
        return 31
    return (date(anio, mes + 1, 1) - timedelta(days=1)).day


def _fecha(anio: int, mes: int, dia: int) -> Optional[date]:
    try:
        return date(anio, mes, dia)
    except ValueError:
        return None


def extraer_fechas(texto: str) -> List[Tuple[int, date]]:
    """
    Todas las fechas del documento con la posición donde aparecen, para poder
    después quedarse con la que sigue a un rótulo de vencimiento.

    Cubre lo que se ve impreso en estos documentos: 31/03/2027, 31-03-2027,
    2027-03-31, "31 de marzo de 2027" y el 03/2027 de la revisión técnica
    (que se interpreta como el último día de ese mes, que es hasta cuándo
    vale).
    """
    if not texto:
        return []

    norm = normalizar(texto)
    encontradas: List[Tuple[int, date]] = []

    for m in re.finditer(r"\b(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})\b", norm):
        f = _fecha(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if f:
            encontradas.append((m.start(), f))

    for m in re.finditer(r"\b(\d{1,2})[\-/\.](\d{1,2})[\-/\.](\d{2,4})\b", norm):
        anio = int(m.group(3))
        if anio < 100:
            anio += 2000
        f = _fecha(anio, int(m.group(2)), int(m.group(1)))
        if f:
            encontradas.append((m.start(), f))

    for m in re.finditer(r"\b(\d{1,2})\s*(?:DE\s+)?([A-Z]{3,10})\s*(?:DE\s+)?(\d{4})\b", norm):
        mes = _MESES.get(m.group(2))
        if mes:
            f = _fecha(int(m.group(3)), mes, int(m.group(1)))
            if f:
                encontradas.append((m.start(), f))

    # Solo mes y año (revisión técnica, sellos de vigencia): vale hasta el
    # último día de ese mes. Los delimitadores evitan que "15-08-2027" se lea
    # además como "08-2027" y termine corriendo el vencimiento a fin de mes.
    for m in re.finditer(r"(?<![\d/\-\.])(\d{1,2})[\-/](\d{4})(?![\d/\-])", norm):
        mes = int(m.group(1))
        anio = int(m.group(2))
        if 1 <= mes <= 12:
            f = _fecha(anio, mes, _ultimo_dia_del_mes(anio, mes))
            if f:
                encontradas.append((m.start(), f))

    # Deduplica por (posición, fecha) manteniendo el orden de aparición.
    vistas = set()
    unicas = []
    for pos, f in sorted(encontradas):
        clave = (pos, f)
        if clave not in vistas:
            vistas.add(clave)
            unicas.append((pos, f))
    return unicas


def extraer_vencimiento(texto: str, spec: EspecificacionDocumento) -> Optional[date]:
    """
    Fecha hasta la que vale el documento.

    Primero se busca una fecha justo después de un rótulo de vencimiento
    ("VÁLIDO HASTA", "VENCE", "VIGENCIA HASTA"), que es lo que dice el
    documento de sí mismo. Si no hay rótulo — el OCR se come rótulos con
    frecuencia — se toma la fecha más lejana del documento, que en un permiso,
    un SOAP o una póliza es siempre el término de la vigencia (las otras son
    emisión, pago o inicio).
    """
    fechas = extraer_fechas(texto)
    if not fechas:
        return None

    norm = normalizar(texto)
    candidatas: List[date] = []
    for marcador in spec.marcadores_vencimiento:
        for m in re.finditer(re.escape(marcador), norm):
            fin_marcador = m.end()
            # Una fecha "del rótulo" está pegada a él, no tres líneas abajo.
            cercanas = [f for pos, f in fechas if 0 <= pos - fin_marcador <= 40]
            if cercanas:
                candidatas.append(max(cercanas))

    if candidatas:
        return max(candidatas)

    return max(f for _, f in fechas)


def extraer_patente(texto: str) -> Optional[str]:
    """
    Patente impresa en el documento. Se prefiere la que sigue a un rótulo
    ("PLACA ÚNICA", "PATENTE", "PPU"); si no hay rótulo, la primera del texto
    que sea una patente chilena válida.
    """
    if not texto:
        return None

    norm = normalizar(texto)
    patron_patente = r"([A-Z]{4}[\s\-\.]?\d{2}|[A-Z]{2}[\s\-\.]?\d{4})"

    for rotulo in ("PLACA UNICA", "PLACA PATENTE", "PATENTE UNICA", "PPU", "PATENTE", "PLACA"):
        for m in re.finditer(re.escape(rotulo) + r"[\s:N°\.\-]{0,12}" + patron_patente, norm):
            candidata = re.sub(r"[^A-Z0-9]", "", m.group(1))
            if validar_patente_chilena(candidata):
                return candidata

    for m in re.finditer(r"\b" + patron_patente + r"\b", norm):
        candidata = re.sub(r"[^A-Z0-9]", "", m.group(1))
        if validar_patente_chilena(candidata):
            return candidata

    return None


def clasificar_documento(texto: str) -> Tuple[Optional[str], int]:
    """
    Qué documento es, según cuántos marcadores propios aparecen. Devuelve
    (tipo, aciertos); (None, 0) si no se parece a ninguno.

    El SOAP y la póliza comercial comparten vocabulario ("póliza",
    "compañía de seguros"), así que los marcadores exclusivos del SOAP
    (la ley 18.490, "seguro obligatorio") pesan doble para desempatar.
    """
    norm = normalizar(texto)
    if not norm:
        return None, 0

    puntajes: Dict[str, int] = {}
    for tipo, spec in ESPECIFICACIONES.items():
        aciertos = sum(1 for marcador in spec.marcadores if marcador in norm)
        if tipo == "soap":
            exclusivos = ("SEGURO OBLIGATORIO", "SOAP", "LEY 18.490", "LEY 18490")
            aciertos += sum(1 for marcador in exclusivos if marcador in norm)
        if aciertos:
            puntajes[tipo] = aciertos

    if not puntajes:
        return None, 0

    tipo = max(puntajes, key=lambda t: puntajes[t])
    return tipo, puntajes[tipo]


def extraer_folio(texto: str) -> Optional[str]:
    """Folio, número de certificado o de póliza, para poder cotejarlo a mano."""
    if not texto:
        return None
    patrones = (
        r"(?:N[°O]?\s*)?FOLIO[\s:N°\.\-]*([A-Z0-9\-]{4,})",
        r"(?:CODIGO\s*(?:DE\s*)?VERIFICACION)[\s:N°\.\-]*([A-Z0-9\-]{4,})",
        r"(?:CERTIFICADO)[\s:N°\.\-]*([A-Z0-9\-]{4,})",
        r"(?:POLIZA)[\s:N°\.\-]*([A-Z0-9\-]{4,})",
    )
    norm = normalizar(texto)
    for patron in patrones:
        m = re.search(patron, norm)
        if m:
            return m.group(1).strip("-")
    return None


def analizar_documento(
    texto: Optional[str],
    tipo_esperado: str,
    patente_esperada: Optional[str] = None,
    hoy: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Veredicto de un documento.

    `estado` es lo que se le muestra al dueño:
      vigente | por_vencer | vencido | patente_no_coincide | tipo_incorrecto |
      ilegible | sin_fecha | sin_vencimiento (padrón)

    `bloquea` marca lo que NO se puede publicar (vencido, de otro auto o de
    otro tipo). Lo dudoso — ilegible, sin fecha, sin patente legible — no
    bloquea: levanta `requiere_revision` para que lo mire un ejecutivo, que
    es como ya funciona el resto del enrolamiento.
    """
    hoy = hoy or date.today()
    spec = ESPECIFICACIONES.get(tipo_esperado)
    if spec is None:
        raise ValueError(f"Tipo de documento desconocido: {tipo_esperado}")

    base: Dict[str, Any] = {
        "tipo": tipo_esperado,
        "nombre": spec.nombre,
        "tipo_detectado": None,
        "patente_detectada": None,
        "coincide_patente": None,
        "vencimiento": None,
        "dias_para_vencer": None,
        "folio": None,
        "estado": "ilegible",
        "valido": False,
        "bloquea": False,
        "requiere_revision": True,
        "motivo": None,
    }

    if not texto or len(texto.strip()) < MINIMO_CARACTERES_LEGIBLE:
        base["motivo"] = (
            f"No pudimos leer {spec.nombre.lower()}. Vuelve a fotografiarlo completo, "
            "plano y con buena luz."
        )
        return base

    tipo_detectado, aciertos = clasificar_documento(texto)
    base["tipo_detectado"] = tipo_detectado
    base["folio"] = extraer_folio(texto)

    patente_detectada = extraer_patente(texto)
    base["patente_detectada"] = patente_detectada

    vencimiento = extraer_vencimiento(texto, spec) if spec.exige_vencimiento else None
    if vencimiento:
        base["vencimiento"] = vencimiento.isoformat()
        base["dias_para_vencer"] = (vencimiento - hoy).days

    # 1. ¿Es el documento que se pidió?
    if tipo_detectado and tipo_detectado != tipo_esperado and aciertos >= 2:
        otro = ESPECIFICACIONES[tipo_detectado].nombre
        base.update(
            estado="tipo_incorrecto",
            bloquea=True,
            requiere_revision=False,
            motivo=f"Subiste {otro.lower()} donde va {spec.nombre.lower()}.",
        )
        return base

    if not tipo_detectado:
        base["motivo"] = (
            f"La foto no se parece a {spec.nombre.lower()}. La revisará un ejecutivo."
        )
        return base

    # 2. ¿Es de este auto?
    if patente_esperada:
        esperada = re.sub(r"[^A-Z0-9]", "", (patente_esperada or "").upper())
        if patente_detectada:
            base["coincide_patente"] = patente_detectada == esperada
            if not base["coincide_patente"]:
                base.update(
                    estado="patente_no_coincide",
                    bloquea=True,
                    requiere_revision=False,
                    motivo=(
                        f"{spec.nombre} está a nombre de la patente {patente_detectada}, "
                        f"no de {esperada}."
                    ),
                )
                return base
        else:
            base["motivo"] = (
                f"No pudimos leer la patente en {spec.nombre.lower()}. La revisará un ejecutivo."
            )
            return base

    # 3. ¿Sigue vigente?
    if not spec.exige_vencimiento:
        base.update(
            estado="sin_vencimiento",
            valido=True,
            requiere_revision=False,
            motivo=None,
        )
        return base

    if not vencimiento:
        base.update(
            estado="sin_fecha",
            motivo=(
                f"No pudimos leer hasta cuándo vale {spec.nombre.lower()}. "
                "La revisará un ejecutivo."
            ),
        )
        return base

    dias = base["dias_para_vencer"]
    if dias < 0:
        base.update(
            estado="vencido",
            bloquea=True,
            requiere_revision=False,
            motivo=(
                f"{spec.nombre} venció el {vencimiento.strftime('%d-%m-%Y')}. "
                "Renuévalo y vuelve a subirlo."
            ),
        )
        return base

    if dias <= DIAS_AVISO_VENCIMIENTO:
        base.update(
            estado="por_vencer",
            valido=True,
            requiere_revision=False,
            motivo=(
                f"{spec.nombre} vence el {vencimiento.strftime('%d-%m-%Y')} "
                f"(en {dias} días). Renuévalo antes para no perder la publicación."
            ),
        )
        return base

    base.update(estado="vigente", valido=True, requiere_revision=False, motivo=None)
    return base


def resumir(analisis: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Junta los veredictos en la decisión que toma el enrolamiento del auto:
    publicar, rechazar o mandar a revisión manual.
    """
    bloqueantes = [a for a in analisis if a.get("bloquea")]
    a_revisar = [a for a in analisis if a.get("requiere_revision")]
    por_vencer = [a for a in analisis if a.get("estado") == "por_vencer"]

    return {
        "verificado": bool(analisis) and not bloqueantes and not a_revisar,
        "bloqueantes": [
            {"tipo": a["tipo"], "estado": a["estado"], "motivo": a["motivo"]} for a in bloqueantes
        ],
        "avisos": [
            {"tipo": a["tipo"], "estado": a["estado"], "motivo": a["motivo"]} for a in por_vencer
        ],
        "motivo_soporte": (
            "; ".join(a["motivo"] for a in a_revisar if a.get("motivo")) or None
        ) if a_revisar else None,
        "documentos": analisis,
    }
