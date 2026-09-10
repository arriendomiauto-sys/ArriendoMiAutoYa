import re
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.entities import Reserva

def validar_rut_chileno(rut_completo: str) -> bool:
    """
    Validador oficial de RUT chileno con algoritmo Módulo 11.
    Acepta formatos: '18.456.789-K', '18456789-k', '18456789K', etc.
    """
    if not rut_completo or not isinstance(rut_completo, str):
        return False

    # Limpiar puntos, espacios y guiones
    limpio = re.sub(r"[\.\-\s]", "", rut_completo).upper()
    if len(limpio) < 8 or len(limpio) > 9:
        return False

    cuerpo = limpio[:-1]
    dv = limpio[-1]

    if not cuerpo.isdigit():
        return False

    # Algoritmo Módulo 11
    suma = 0
    multiplicador = 2

    for d in reversed(cuerpo):
        suma += int(d) * multiplicador
        multiplicador = 2 if multiplicador == 7 else multiplicador + 1

    resto = suma % 11
    dv_esperado = 11 - resto

    if dv_esperado == 11:
        dv_calculado = "0"
    elif dv_esperado == 10:
        dv_calculado = "K"
    else:
        dv_calculado = str(dv_esperado)

    return dv == dv_calculado

def formatear_rut(rut_completo: Optional[str]) -> Optional[str]:
    """
    Formatea un RUT chileno en el estándar oficial '11.111.111-1' o '1.111.111-1'.
    Limpia puntos y guiones previos y formatea con separadores de miles y guion con DV en mayúscula.
    """
    if not rut_completo or not isinstance(rut_completo, str):
        return None

    limpio = re.sub(r"[\.\-\s]", "", rut_completo).upper()
    if len(limpio) < 2:
        return limpio

    cuerpo = limpio[:-1]
    dv = limpio[-1]

    if not cuerpo.isdigit():
        return limpio

    cuerpo_fmt = f"{int(cuerpo):,}".replace(",", ".")
    return f"{cuerpo_fmt}-{dv}"

def normalizar_rut(rut_completo: Optional[str]) -> Optional[str]:
    """Limpia puntos, guiones y espacios del RUT para comparaciones seguras."""
    if not rut_completo or not isinstance(rut_completo, str):
        return None
    return re.sub(r"[\.\-\s]", "", rut_completo).upper()

def formatear_telefono_chileno(telefono: Optional[str]) -> Optional[str]:
    """
    Formatea un teléfono móvil chileno al formato estándar '+56 9 1111 1111'.
    Acepta '912345678', '+56912345678', '56912345678', '12345678', etc.
    """
    if not telefono or not isinstance(telefono, str):
        return None

    digitos = re.sub(r"\D", "", telefono)
    if not digitos:
        return None

    if digitos.startswith("569") and len(digitos) >= 11:
        movil = digitos[3:11]
    elif digitos.startswith("56") and len(digitos) == 10:
        movil = digitos[2:10]
    elif digitos.startswith("9") and len(digitos) >= 9:
        movil = digitos[1:9]
    elif len(digitos) == 8:
        movil = digitos
    elif len(digitos) > 8:
        movil = digitos[-8:]
    else:
        movil = digitos

    if len(movil) == 8:
        return f"+56 9 {movil[:4]} {movil[4:]}"
    elif len(movil) > 4:
        return f"+56 9 {movil[:4]} {movil[4:]}"
    return f"+56 9 {movil}"

def validar_documento_identidad(
    tipo_documento: Optional[str],
    numero: Optional[str],
    pais: Optional[str] = None,
) -> tuple:
    """
    Valida el documento de identidad según su tipo y devuelve `(es_valido, motivo)`.

    El chileno se sigue validando con Módulo 11. Para un extranjero no existe
    algoritmo verificable desde acá (el número de pasaporte no tiene dígito
    verificador universal), así que la validación es de formato y la
    autenticidad la resuelve el proveedor KYC sobre la imagen del documento.
    """
    tipo = (tipo_documento or "rut").lower()

    if tipo == "rut":
        if not validar_rut_chileno(numero):
            return False, "RUT chileno inválido (falla verificación de dígito verificador Módulo 11)."
        return True, None

    if tipo not in ("pasaporte", "dni_extranjero"):
        return False, f"Tipo de documento no soportado: '{tipo_documento}'."

    limpio = re.sub(r"[\.\-\s]", "", numero or "").upper()
    if not limpio.isalnum() or not (5 <= len(limpio) <= 20):
        return False, "Número de documento inválido: debe tener entre 5 y 20 caracteres alfanuméricos."

    pais_norm = (pais or "").strip().upper()
    if len(pais_norm) != 2:
        return False, "Debes indicar el país emisor del documento (código de 2 letras, ej. 'AR')."
    if pais_norm == "CL":
        return False, "Para documentos chilenos usa el RUT, no pasaporte ni DNI extranjero."

    return True, None

def validar_patente_chilena(patente: str) -> bool:
    """
    Validador de patentes vehiculares chilenas.
    - Formato nuevo (desde 2007): 4 letras + 2 dígitos (ej. BBCL10, ABCD-12, JKLM-56)
    - Formato antiguo: 2 letras + 4 dígitos (ej. AB1234, AB-12-34)
    """
    if not patente or not isinstance(patente, str):
        return False

    limpia = re.sub(r"[\-\s]", "", patente).upper()

    # Formato nuevo: 4 letras + 2 dígitos
    regex_nueva = r"^[A-Z]{4}\d{2}$"
    # Formato antiguo: 2 letras + 4 dígitos
    regex_antigua = r"^[A-Z]{2}\d{4}$"

    return bool(re.match(regex_nueva, limpia) or re.match(regex_antigua, limpia))

def validar_telefono_chileno(telefono: str) -> bool:
    """
    Validador de teléfono móvil de Chile (+56 9 XXXXXXXX o 9XXXXXXXX).
    """
    if not telefono or not isinstance(telefono, str):
        return False

    limpio = re.sub(r"[\s\-\+]", "", telefono)
    
    # Si tiene prefijo 56
    if limpio.startswith("569") and len(limpio) == 11:
        return True
    # Si empieza directamente con 9
    if limpio.startswith("9") and len(limpio) == 9:
        return True

    return False

# Estados de reserva que "ocupan" el auto y bloquean el rango en el calendario.
# `pendiente_pago` cuenta mientras no expire su TTL: si no, dos personas podrían
# arrancar el checkout para las mismas fechas y solo se descubre al pagar.
ESTADOS_OCUPAN_AUTO = ("pendiente_pago", "confirmada", "en_curso")


def _reservas_que_ocupan(auto_id: str, db: Session, ahora: Optional[datetime] = None):
    """Query base de reservas vigentes que ocupan el auto (sin filtro de rango)."""
    ahora = ahora or datetime.now(timezone.utc).replace(tzinfo=None)
    return db.query(Reserva).filter(
        Reserva.auto_id == auto_id,
        Reserva.estado.in_(ESTADOS_OCUPAN_AUTO),
        # Un `pendiente_pago` ya expirado no bloquea nada (el barrido de TTL lo
        # pasará a "cancelada", pero no hay que esperar a eso).
        (Reserva.estado != "pendiente_pago")
        | (Reserva.expira_en.is_(None))
        | (Reserva.expira_en > ahora),
    )


def rangos_ocupados_auto(auto_id: str, db: Session) -> list:
    """
    Rangos `[{fecha_inicio, fecha_fin}]` en que el auto NO está disponible.
    Lo consume el calendario del móvil para deshabilitar esos días.
    """
    reservas = _reservas_que_ocupan(auto_id, db).order_by(Reserva.fecha_inicio).all()
    return [{"fecha_inicio": r.fecha_inicio, "fecha_fin": r.fecha_fin} for r in reservas]


def validar_disponibilidad_reserva(
    auto_id: str,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    db: Session,
    excluir_reserva_id: Optional[str] = None
) -> bool:
    """
    Verifica que el auto no tenga otra reserva vigente (ver `ESTADOS_OCUPAN_AUTO`)
    que se solape con el rango de fechas solicitado.
    """
    query = _reservas_que_ocupan(auto_id, db)

    if excluir_reserva_id:
        query = query.filter(Reserva.id != excluir_reserva_id)

    # Dos intervalos [A, B] y [C, D] se solapan si A < D y B > C
    reservas_solapadas = query.filter(
        Reserva.fecha_inicio < fecha_fin,
        Reserva.fecha_fin > fecha_inicio
    ).all()

    return len(reservas_solapadas) == 0
