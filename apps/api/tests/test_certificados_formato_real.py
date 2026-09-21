"""
Certificados con el formato REAL del Registro Civil.

Los textos de abajo reproducen la disposición de líneas de los PDF de `QA/docs` (extraídos con pypdf) pero
con datos inventados. Los PDF originales traen datos personales reales: no se copian al repositorio.

Diferencias con los textos sintéticos anteriores que rompían la lectura:
  · la fecha es "20 Septiembre 2026, 20:31." (sin "de");
  · la etiqueta es "Código Verificación:" (sin "de") y el código va en la línea siguiente;
  · el antecedentes dice "SIN ANTECEDENTESPARTICULARES" (pegado) bajo "REGISTRO GENERAL DE CONDENAS",
    y la palabra CONDENA aparece en los encabezados aunque no haya condenas;
  · la hoja de vida no dice "SIN ANOTACIONES": dice "SIN ANTECEDENTES PRNCONDUCTOR" y lista
    sentencias e infracciones aparte.
"""
import glob
import os
from datetime import date

import pytest

from app.features.auth.background_checks.certificados import (
    TIPO_ANTECEDENTES,
    TIPO_HOJA_VIDA,
    analizar_certificado,
    extraer_texto_pdf,
)

HOY = date(2026, 9, 20)
RUT = "11.111.111-1"
RUN = "11111111-1"


def _antecedentes_real(fila_general="SIN ANTECEDENTESPARTICULARES", fila_vif="SIN ANOTACIONESPARTICULARES", rut=RUT):
    run = rut.replace(".", "")
    return f"""SERVICIO DE REGISTRO
CIVIL E IDENTIFICACIÓN

REPUBLICA DE CHILE
FOLIO :   500000000001
Código Verificación:
a1b2c3d4e5f6
500000000001

CERTIFICADO DE ANTECEDENTES
Válido para FINES PARTICULARES
   NOMBRE : JUAN PEREZ PRUEBA
   R.U.N. : {rut}  Fecha nacimiento: 1 Enero 1980
      REGISTRO GENERAL DE CONDENAS
 R U N                     FINES
{run} {fila_general}
REGISTRO ESPECIAL DE CONDENAS POR ACTOS DE
     VIOLENCIA INTRAFAMILIAR
 R U N                    FINES
{run} {fila_vif}
FECHA EMISIÓN:
 20 Septiembre 2026, 20:31.
Certificado GratuitoCERTIFICADO ANTECEDENTES PARA FINES PARTICULARES
Verifique documento en www.registrocivil.gob.cl o a nuestro Call Center 600 370 2000
Timbre electrónico SRCeI
Incorpora Firma Electrónica
Avanzada
"""


def _hoja_vida_real(sentencias="", fila="SIN ANTECEDENTES PRNCONDUCTOR", rut=RUT):
    run = rut.replace(".", "")
    return f"""SERVICIO DE REGISTRO
CIVIL E IDENTIFICACIÓN
REPUBLICA DE CHILE
FOLIO :   500000000002
Código Verificación:
9f312c6e71f6
500000000002
HOJA DE VIDA DEL CONDUCTOR
No válido para obtener ni renovar LICENCIA CONDUCIR
   NOMBRE : JUAN PEREZ PRUEBA
   R.U.N. : {rut}  Fecha nacimiento: 1 Enero 1980
Domicilio : CALLE FALSA 123
Comuna    : SANTIAGO
LICENCIAS REGISTRADAS
PRIMERA Clase        : B Fecha otorgamiento :  3 Agosto 2000
      Municipalidad : SANTIAGO
ULTIMA  Clase        : B Fecha otorgamiento : 14 Agosto 2015
      Municipalidad : SANTIAGO
 R U N                         HOJA DE VIDA
{run} {fila}
{sentencias}FECHA EMISIÓN:
 20 Septiembre 2026, 20:31. -  Continúa en la página  2
Certificado GratuitoHOJA DE VIDA DEL CONDUCTOR
Verifique documento en www.registrocivil.gob.cl
Timbre electrónico SRCeI
"""


SENTENCIA_MULTA = """SENTENCIAS EJECUTORIADAS
Proceso Número        :      5706  Año : 2025
    Tribunal          : POLICIA LOCAL DE SANTIAGO
    Fecha Resolución  : 11 Noviembre 2025
    Vehículo          :
    Nro. parte        :            Fecha Denuncia :  1 Noviembre 2025
    U. policial       :
    Infracción        :      152: CONDUCIR UN VEHÍCULO SIN CINTURÓN
          DE SEGURIDAD, INFRACCIÓN NRO.10 DEL
          ARTÍCULO 75
    Resolución        :       MULTA
"""


# ---------------------------------------------------------------------------
# Certificado de antecedentes
# ---------------------------------------------------------------------------
def test_un_certificado_de_antecedentes_real_y_limpio_queda_con_contenido_ok():
    r = analizar_certificado(_antecedentes_real(), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is True, r.motivo
    assert r.estado == "revision"  # nunca aprueba solo: falta confirmar el código
    assert r.emitido_en == date(2026, 9, 20)
    assert r.folio == "500000000001"
    assert r.codigo_verificacion == "a1b2c3d4e5f6"
    assert r.hallazgos["sin_antecedentes"] is True


def test_la_palabra_condenas_del_encabezado_no_cuenta_como_condena():
    r = analizar_certificado(_antecedentes_real(), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)
    assert r.hallazgos["sin_antecedentes"] is True


@pytest.mark.parametrize(
    "fila",
    [
        "CON ANTECEDENTESPARTICULARES",
        "SIN ANTECEDENTESPARTICULARES\nROL 1234-2020 DELITO ROBO PENA 541 DIAS",
        "",
    ],
)
def test_si_la_fila_general_no_dice_solo_sin_antecedentes_va_a_revision(fila):
    r = analizar_certificado(_antecedentes_real(fila_general=fila), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is False
    assert r.estado == "revision"


def test_una_anotacion_de_violencia_intrafamiliar_va_a_revision():
    r = analizar_certificado(
        _antecedentes_real(fila_vif="CON ANOTACIONESPARTICULARES"), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY
    )
    assert r.contenido_ok is False
    assert "violencia intrafamiliar" in r.motivo.lower()


def test_sin_la_seccion_de_violencia_intrafamiliar_no_se_da_por_limpio():
    texto = _antecedentes_real().replace("SIN ANOTACIONESPARTICULARES", "")
    r = analizar_certificado(texto, TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is False


def test_el_antecedentes_real_de_otra_persona_se_rechaza():
    r = analizar_certificado(_antecedentes_real(), TIPO_ANTECEDENTES, rut_esperado="22.222.222-2", hoy=HOY)
    assert r.estado == "rechazado"


# ---------------------------------------------------------------------------
# Hoja de vida del conductor
# ---------------------------------------------------------------------------
def test_una_hoja_de_vida_real_sin_sentencias_queda_con_contenido_ok():
    r = analizar_certificado(_hoja_vida_real(), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is True, r.motivo
    assert r.emitido_en == date(2026, 9, 20)
    assert r.codigo_verificacion == "9f312c6e71f6"
    assert r.hallazgos["licencia_suspendida"] is False
    assert r.hallazgos["infracciones"] == 0


def test_una_hoja_de_vida_con_una_infraccion_va_a_revision_y_la_detalla():
    r = analizar_certificado(_hoja_vida_real(sentencias=SENTENCIA_MULTA), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is False
    assert r.estado == "revision"
    assert r.hallazgos["sentencias"] == 1
    assert r.hallazgos["infracciones"] == 1
    assert r.hallazgos["detalle_infracciones"][0]["resolucion"] == "MULTA"
    assert "CINTURÓN" in r.hallazgos["detalle_infracciones"][0]["descripcion"].upper()
    assert "infracci" in r.motivo.lower()


def test_la_hoja_de_vida_registra_las_clases_de_licencia():
    r = analizar_certificado(_hoja_vida_real(), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)
    assert r.hallazgos["clases_licencia"] == ["B"]


@pytest.mark.parametrize("palabra", ["SUSPENSION DE LICENCIA", "LICENCIA SUSPENDIDA", "CANCELACION DE LICENCIA"])
def test_suspension_o_cancelacion_de_licencia_se_detecta(palabra):
    sentencia = SENTENCIA_MULTA.replace("MULTA", palabra)
    r = analizar_certificado(_hoja_vida_real(sentencias=sentencia), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)
    assert r.hallazgos["licencia_suspendida"] is True
    assert r.contenido_ok is False


def test_una_hoja_de_vida_sin_la_fila_de_antecedentes_va_a_revision():
    r = analizar_certificado(_hoja_vida_real(fila=""), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)
    assert r.contenido_ok is False


# ---------------------------------------------------------------------------
# Contra los PDF reales de QA/docs (solo si están en la máquina)
# ---------------------------------------------------------------------------
_DOCS = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "QA", "docs")
_PDFS = sorted(glob.glob(os.path.join(_DOCS, "*.pdf")))


def _leer(prefijo):
    ruta = next((p for p in _PDFS if os.path.basename(p).startswith(prefijo)), None)
    if not ruta:
        pytest.skip(f"No hay un PDF {prefijo}* en QA/docs")
    with open(ruta, "rb") as f:
        return extraer_texto_pdf(f.read())


def test_los_pdf_reales_se_leen_y_se_reconoce_su_tipo():
    """El RUT sale del propio PDF: así el test no lleva datos personales."""
    ant = analizar_certificado(_leer("ANT"), TIPO_ANTECEDENTES, hoy=HOY)
    hoja = analizar_certificado(_leer("HVID"), TIPO_HOJA_VIDA, hoy=HOY)
    for r in (ant, hoja):
        assert r.rut, r.motivo
        assert r.emitido_en == date(2026, 9, 20)
        assert r.folio and r.codigo_verificacion
    assert ant.rut == hoja.rut
    assert ant.contenido_ok is True, ant.motivo
    assert hoja.estado == "revision"  # trae una infracción: lo decide un ejecutivo
    assert hoja.hallazgos["infracciones"] >= 1


def test_el_pdf_real_de_antecedentes_se_rechaza_con_el_rut_de_otra_persona():
    r = analizar_certificado(_leer("ANT"), TIPO_ANTECEDENTES, rut_esperado="22.222.222-2", hoy=HOY)
    assert r.estado == "rechazado"


def test_el_pdf_real_de_antecedentes_vencido_se_rechaza():
    r = analizar_certificado(_leer("ANT"), TIPO_ANTECEDENTES, hoy=date(2026, 12, 1))
    assert r.estado == "rechazado"
