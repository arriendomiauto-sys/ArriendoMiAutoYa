import re


def validar_rut_chileno(rut_completo: str) -> bool:
    """
    Validador oficial de RUT chileno con algoritmo Módulo 11.
    Acepta formatos: '18.456.789-K', '18456789-k', '18456789K', etc.

    (Copia deliberada de app/core/validators.py del backend: este servicio
    es independiente y no debe importar del monolito.)
    """
    if not rut_completo or not isinstance(rut_completo, str):
        return False

    limpio = re.sub(r"[\.\-\s]", "", rut_completo).upper()
    if len(limpio) < 8 or len(limpio) > 9:
        return False

    cuerpo = limpio[:-1]
    dv = limpio[-1]
    if not cuerpo.isdigit():
        return False

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
