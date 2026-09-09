"""
Reglas de conducción para arrendatarios extranjeros en Chile.

Resumen de la norma que implementa el árbol de decisión:

* Si el país que emitió la licencia ratificó el **Convenio de Viena de 1968**,
  la licencia local basta para conducir en Chile: no se exige PIC.
* Si no lo ratificó, se exige el **Permiso Internacional de Conducir (PIC)**,
  que complementa —nunca reemplaza— la licencia original.
* Un **extranjero residente** puede conducir con PIC hasta 1 año contado desde
  el inicio de su residencia continua. Pasado ese plazo necesita licencia
  chilena.
* España, Perú y Corea tienen **acuerdo de homologación**: pueden canjear su
  licencia por una chilena sin rendir examen (pero igual necesitan el canje).

La lista de países es un dato normativo que cambia con cada adhesión nueva: un
país que no figura en ninguna lista NO se rechaza de plano, se manda a revisión
manual. Antes de tocar estas constantes hay que contrastarlas con el registro
oficial de tratados de la ONU.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

# Partes del Convenio de Viena sobre Circulación Vial (1968), en ISO-3166 alpha-2.
PAISES_CONVENIO_VIENA = {
    # Europa
    "AL", "AM", "AT", "AZ", "BE", "BG", "BA", "BY", "CH", "CY", "CZ", "DE",
    "DK", "EE", "ES", "FI", "FR", "GE", "GB", "GR", "HR", "HU", "IT", "LT",
    "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO",
    "RS", "RU", "SE", "SI", "SK", "SM", "UA",
    # América
    "BR", "CL", "CU", "EC", "GY", "PE", "UY",
    # Asia, África y Medio Oriente
    "AE", "BH", "CF", "CI", "CD", "IL", "IQ", "IR", "KG", "KR", "KW", "KZ",
    "MA", "MN", "NE", "PK", "PH", "QA", "SA", "SC", "SN", "TJ", "TM", "TN",
    "TR", "UZ", "VN", "ZA", "ZW",
}

# Canje de licencia por una chilena sin rendir examen (cédula chilena vigente
# + licencia vigente del país de origen).
PAISES_HOMOLOGACION = {"ES", "PE", "KR"}

# Firmaron el Convenio pero no lo ratificaron, o en la práctica no operan por
# reconocimiento automático en Chile: se les exige PIC o licencia chilena.
PAISES_EXCLUIDOS_PRACTICA = {"CO", "VE"}

DIAS_RESIDENCIA_PARA_LICENCIA_CHILENA = 365


def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    """La BD guarda datetimes naive; se comparan todos en el mismo plano."""
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _edad_en(fecha_nacimiento: datetime, referencia: datetime) -> int:
    anios = referencia.year - fecha_nacimiento.year
    if (referencia.month, referencia.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        anios -= 1
    return anios


def evaluar_licencia(
    pais_licencia: Optional[str],
    tiene_pic: bool = False,
    pic_vencimiento: Optional[datetime] = None,
    licencia_vencimiento: Optional[datetime] = None,
    es_residente: bool = False,
    fecha_inicio_residencia: Optional[datetime] = None,
    fecha_fin_reserva: Optional[datetime] = None,
    fecha_nacimiento: Optional[datetime] = None,
    edad_minima: int = 21,
    ahora: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Evalúa si una persona puede conducir en Chile hasta `fecha_fin_reserva`.

    Devuelve `{permitido, requiere_pic, requiere_licencia_chilena,
    vence_durante_arriendo, revision_manual, motivo}`.
    """
    ahora = _naive(ahora) or datetime.utcnow()
    hasta = _naive(fecha_fin_reserva) or ahora
    pic_vencimiento = _naive(pic_vencimiento)
    licencia_vencimiento = _naive(licencia_vencimiento)
    fecha_inicio_residencia = _naive(fecha_inicio_residencia)
    fecha_nacimiento = _naive(fecha_nacimiento)

    resultado: Dict[str, Any] = {
        "permitido": True,
        "requiere_pic": False,
        "requiere_licencia_chilena": False,
        "vence_durante_arriendo": False,
        "revision_manual": False,
        "motivo": None,
    }

    def rechazar(motivo: str, **flags) -> Dict[str, Any]:
        resultado.update(permitido=False, motivo=motivo, **flags)
        return resultado

    # 0. Edad mínima de la plataforma (parámetro RF-33).
    if fecha_nacimiento is not None and _edad_en(fecha_nacimiento, ahora) < edad_minima:
        return rechazar(f"La edad mínima para arrendar en la plataforma es {edad_minima} años.")

    pais = (pais_licencia or "").strip().upper()
    if not pais:
        resultado["revision_manual"] = True
        return rechazar("Falta el país que emitió la licencia de conducir.")

    # 1. La licencia debe estar vigente durante todo el arriendo.
    if licencia_vencimiento is not None and licencia_vencimiento < hasta:
        return rechazar(
            f"La licencia de conducir vence el {licencia_vencimiento:%d-%m-%Y}, "
            "antes del término del arriendo.",
            vence_durante_arriendo=True,
        )

    # 2. Licencia chilena: no hay nada más que revisar.
    if pais == "CL":
        return resultado

    # 3. Residente hace más de un año: debe tener licencia chilena.
    if es_residente and fecha_inicio_residencia is not None:
        antiguedad = ahora - fecha_inicio_residencia
        if antiguedad >= timedelta(days=DIAS_RESIDENCIA_PARA_LICENCIA_CHILENA):
            detalle = (
                " Su país tiene convenio de homologación: puede canjearla sin rendir examen."
                if pais in PAISES_HOMOLOGACION
                else " Debe obtener licencia chilena rindiendo los exámenes correspondientes."
            )
            return rechazar(
                "Lleva más de un año de residencia continua en Chile, por lo que su "
                "licencia extranjera ya no lo habilita para conducir." + detalle,
                requiere_licencia_chilena=True,
            )

    # 4. País del Convenio de Viena: su licencia local basta.
    if pais in PAISES_CONVENIO_VIENA and pais not in PAISES_EXCLUIDOS_PRACTICA:
        return resultado

    # 5. País que no tenemos catalogado: lo revisa una persona en vez de rechazarlo a ciegas.
    if pais not in PAISES_EXCLUIDOS_PRACTICA and pais not in PAISES_CONVENIO_VIENA:
        resultado["revision_manual"] = True
        return rechazar(
            f"No tenemos registrado el estatus del país '{pais}' frente al Convenio de "
            "Viena. Un ejecutivo revisará la documentación.",
            requiere_pic=True,
        )

    # 6. Resto: se exige PIC vigente además de la licencia original.
    resultado["requiere_pic"] = True
    if not tiene_pic:
        return rechazar(
            f"Las licencias emitidas en '{pais}' requieren Permiso Internacional de "
            "Conducir (PIC) vigente para conducir en Chile.",
            requiere_pic=True,
        )
    if pic_vencimiento is not None and pic_vencimiento < hasta:
        return rechazar(
            f"El Permiso Internacional de Conducir vence el {pic_vencimiento:%d-%m-%Y}, "
            "antes del término del arriendo.",
            requiere_pic=True,
            vence_durante_arriendo=True,
        )

    return resultado


def evaluar_licencia_usuario(
    usuario,
    fecha_fin_reserva: Optional[datetime] = None,
    edad_minima: int = 21,
    ahora: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Envoltorio sobre `evaluar_licencia` que lee los campos del modelo `Usuario`.

    Un usuario sin país de licencia registrado se asume chileno: son las cuentas
    verificadas antes de que existiera este flujo, y bloquearlas retroactivamente
    dejaría fuera a gente que ya pasó el KYC.
    """
    pais = usuario.licencia_pais_emisor or usuario.pais_documento or "CL"
    return evaluar_licencia(
        pais_licencia=pais,
        tiene_pic=bool(usuario.pic_url),
        pic_vencimiento=usuario.pic_vencimiento,
        licencia_vencimiento=usuario.licencia_vencimiento,
        es_residente=bool(usuario.es_residente_chile),
        fecha_inicio_residencia=usuario.fecha_inicio_residencia,
        fecha_fin_reserva=fecha_fin_reserva,
        fecha_nacimiento=usuario.fecha_nacimiento,
        edad_minima=edad_minima,
        ahora=ahora,
    )
