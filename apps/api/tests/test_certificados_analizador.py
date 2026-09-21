"""
Analizador de certificados oficiales del Registro Civil (antecedentes, hoja de
vida del conductor, anotaciones vigentes de un vehículo).

Decisión de diseño: el analizador NUNCA devuelve "aprobado". Verifica todo lo
que se puede comprobar mirando el documento (tipo, RUT, patente, fecha,
contenido), pero la autenticidad del certificado (que no sea un PDF editado)
solo la da el código de verificación de registrocivil.cl, y ese sitio rechaza
las consultas automáticas (protección anti-bots). Por eso un documento
correcto queda en `revision` con `contenido_ok=True`: al admin solo le falta
confirmar el código, y cualquier duda o campo ilegible también va a `revision`.
Solo lo claramente inválido (otra persona, vencido, otro tipo) se rechaza.

Los textos de estos tests son sintéticos: hay que contrastarlos con PDF reales
(ver el plan de antecedentes, fase 0).
"""
from datetime import date

import pytest

from app.features.auth.background_checks.certificados import (
    TIPO_ANOTACIONES,
    TIPO_ANTECEDENTES,
    TIPO_HOJA_VIDA,
    analizar_certificado,
    extraer_texto_pdf,
)

HOY = date(2026, 9, 20)
RUT = "11.111.111-1"


def _antecedentes(rut=RUT, emision="12 de septiembre de 2026", cuerpo="NO REGISTRA ANTECEDENTES", extra=""):
    return f"""
    SERVICIO DE REGISTRO CIVIL E IDENTIFICACION
    CERTIFICADO DE ANTECEDENTES
    Para fines particulares
    RUN: {rut}
    Fecha de emisión: {emision}
    El Servicio de Registro Civil certifica que la persona indicada {cuerpo}.
    Folio: 500004443232
    Código de verificación: 2rR4t56Cv332
    {extra}
    """


def _hoja_vida(rut=RUT, emision="12/09/2026", cuerpo="NO REGISTRA ANOTACIONES", extra=""):
    return f"""
    CERTIFICADO HOJA DE VIDA DEL CONDUCTOR
    RUN: {rut}
    Fecha de emisión: {emision}
    Registro Nacional de Conductores: {cuerpo}
    {extra}
    Folio: 600001112223
    Código de verificación: 9xY8w7Vu6T5s
    """


def _anotaciones(patente="KLPW-88", rut=RUT, emision="2026-09-12", cuerpo="SIN ANOTACIONES VIGENTES", extra=""):
    return f"""
    CERTIFICADO DE ANOTACIONES VIGENTES
    Vehículo motorizado
    PPU: {patente}
    Propietario: JUAN PEREZ RUN {rut}
    Fecha de emisión: {emision}
    {cuerpo}
    {extra}
    Folio: 700009998887
    Código de verificación: 1aB2c3D4e5F6
    """


# ---------------------------------------------------------------------------
# Regla general
# ---------------------------------------------------------------------------
def test_un_certificado_correcto_queda_en_revision_con_el_contenido_ok():
    r = analizar_certificado(_antecedentes(), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is True
    assert "código" in r.motivo.lower()
    assert r.rut == "11.111.111-1"
    assert r.emitido_en == date(2026, 9, 12)
    assert r.folio == "500004443232"
    assert r.codigo_verificacion == "2rR4t56Cv332"
    assert r.hallazgos["sin_antecedentes"] is True


@pytest.mark.parametrize("texto,tipo", [
    (_antecedentes(), TIPO_ANTECEDENTES),
    (_hoja_vida(), TIPO_HOJA_VIDA),
    (_anotaciones(), TIPO_ANOTACIONES),
    (_antecedentes(rut="20.222.333-8"), TIPO_ANTECEDENTES),
    ("", TIPO_ANTECEDENTES),
])
def test_el_analizador_nunca_aprueba_solo(texto, tipo):
    r = analizar_certificado(texto, tipo, rut_esperado=RUT, patente_esperada="KLPW-88", hoy=HOY)

    assert r.estado in ("revision", "rechazado")


# ---------------------------------------------------------------------------
# Rechazos claros
# ---------------------------------------------------------------------------
def test_el_certificado_de_otra_persona_se_rechaza():
    r = analizar_certificado(_antecedentes(rut="20.222.333-8"), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "rechazado"
    assert "otra persona" in r.motivo.lower()


def test_un_certificado_vencido_se_rechaza():
    r = analizar_certificado(_antecedentes(emision="1 de agosto de 2026"), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "rechazado"
    assert "30 días" in r.motivo


def test_un_certificado_del_tipo_equivocado_se_rechaza():
    r = analizar_certificado(_hoja_vida(), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "rechazado"
    assert "hoja de vida" in r.motivo.lower()


# ---------------------------------------------------------------------------
# Todo lo dudoso va a revisión, nunca a "limpio"
# ---------------------------------------------------------------------------
def test_un_documento_ilegible_va_a_revision():
    r = analizar_certificado("", TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False


def test_sin_fecha_de_emision_va_a_revision():
    texto = _antecedentes().replace("Fecha de emisión: 12 de septiembre de 2026", "")

    r = analizar_certificado(texto, TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False


def test_una_fecha_de_emision_futura_va_a_revision():
    r = analizar_certificado(_antecedentes(emision="12 de octubre de 2026"), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False


def test_sin_folio_ni_codigo_va_a_revision():
    texto = _antecedentes().replace("Folio: 500004443232", "").replace("Código de verificación: 2rR4t56Cv332", "")

    r = analizar_certificado(texto, TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False


def test_un_rut_con_digito_verificador_falso_no_cuenta():
    r = analizar_certificado(_antecedentes(rut="11.111.111-9"), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False


# ---------------------------------------------------------------------------
# Contenido: antecedentes
# ---------------------------------------------------------------------------
def test_una_persona_con_antecedentes_va_a_revision_y_lo_deja_dicho():
    texto = _antecedentes(cuerpo="REGISTRA ANTECEDENTES")

    r = analizar_certificado(texto, TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False
    assert r.hallazgos["sin_antecedentes"] is False


def test_un_texto_que_no_dice_ni_si_ni_no_va_a_revision():
    texto = _antecedentes(cuerpo="figura en el registro").replace("NO REGISTRA ANTECEDENTES", "")

    r = analizar_certificado(texto, TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False
    assert r.hallazgos["sin_antecedentes"] is None


# ---------------------------------------------------------------------------
# Contenido: hoja de vida
# ---------------------------------------------------------------------------
def test_hoja_de_vida_limpia():
    r = analizar_certificado(_hoja_vida(), TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is True
    assert r.hallazgos["licencia_suspendida"] is False


def test_hoja_de_vida_con_licencia_suspendida():
    texto = _hoja_vida(cuerpo="", extra="Licencia de conducir clase B: SUSPENDIDA hasta 2027")

    r = analizar_certificado(texto, TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)

    assert r.contenido_ok is False
    assert r.hallazgos["licencia_suspendida"] is True


def test_hoja_de_vida_con_infracciones_graves():
    texto = _hoja_vida(cuerpo="", extra="Anotación 1: infracción GRAVISIMA. Anotación 2: infracción GRAVE.")

    r = analizar_certificado(texto, TIPO_HOJA_VIDA, rut_esperado=RUT, hoy=HOY)

    assert r.contenido_ok is False
    assert r.hallazgos["infracciones_graves"] == 2


# ---------------------------------------------------------------------------
# Anotaciones vigentes del vehículo
# ---------------------------------------------------------------------------
def test_anotaciones_de_un_auto_limpio_y_del_titular():
    r = analizar_certificado(_anotaciones(), TIPO_ANOTACIONES, rut_esperado=RUT, patente_esperada="KLPW-88", hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is True
    assert r.patente == "KLPW88"


def test_anotaciones_de_otra_patente_se_rechazan():
    r = analizar_certificado(_anotaciones(patente="ABCD-12"), TIPO_ANOTACIONES,
                             rut_esperado=RUT, patente_esperada="KLPW-88", hoy=HOY)

    assert r.estado == "rechazado"
    assert "patente" in r.motivo.lower()


def test_anotaciones_con_otro_titular_van_a_revision_no_se_rechazan():
    r = analizar_certificado(_anotaciones(rut="20.222.333-8"), TIPO_ANOTACIONES,
                             rut_esperado=RUT, patente_esperada="KLPW-88", hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False
    assert "titular" in r.motivo.lower()


@pytest.mark.parametrize("extra", ["PROHIBICION de gravar y enajenar", "EMBARGO vigente", "ENCARGO POR ROBO"])
def test_anotaciones_con_gravamenes_o_encargo_van_a_revision(extra):
    r = analizar_certificado(_anotaciones(cuerpo="", extra=extra), TIPO_ANOTACIONES,
                             rut_esperado=RUT, patente_esperada="KLPW-88", hoy=HOY)

    assert r.estado == "revision"
    assert r.contenido_ok is False
    assert r.hallazgos["prohibiciones"] is True


# ---------------------------------------------------------------------------
# Lectura del PDF
# ---------------------------------------------------------------------------
def _pdf_con_texto(lineas):
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 800
    for linea in lineas:
        c.drawString(50, y, linea)
        y -= 18
    c.save()
    return buf.getvalue()


def test_se_lee_el_texto_de_un_pdf_digital():
    pdf = _pdf_con_texto(["CERTIFICADO DE ANTECEDENTES", "RUN: 11.111.111-1", "NO REGISTRA ANTECEDENTES"])

    texto = extraer_texto_pdf(pdf)

    assert "CERTIFICADO DE ANTECEDENTES" in texto
    assert "11.111.111-1" in texto


def test_un_pdf_completo_se_analiza_de_punta_a_punta():
    pdf = _pdf_con_texto([
        "CERTIFICADO DE ANTECEDENTES", "RUN: 11.111.111-1", "Fecha de emision: 12/09/2026",
        "NO REGISTRA ANTECEDENTES", "Folio: 500004443232", "Codigo de verificacion: 2rR4t56Cv332",
    ])

    r = analizar_certificado(extraer_texto_pdf(pdf), TIPO_ANTECEDENTES, rut_esperado=RUT, hoy=HOY)

    assert r.contenido_ok is True


@pytest.mark.parametrize("basura", [b"", b"no soy un pdf", b"%PDF-1.4 roto\x00\x01", None])
def test_un_archivo_que_no_es_un_pdf_da_texto_vacio_sin_reventar(basura):
    assert extraer_texto_pdf(basura) == ""
