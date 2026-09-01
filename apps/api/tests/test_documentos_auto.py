"""
Reglas de lectura y validación de los documentos legales del auto.

Los textos son los que devuelve el OCR de cada documento chileno real; el
modelo se prueba sin red ni credenciales, que es justamente para lo que se
separó de `car_doc_validator`.
"""
from datetime import date

import pytest

from app.features.verificacion_vehiculos.documentos_auto import (
    analizar_documento,
    clasificar_documento,
    extraer_patente,
    extraer_vencimiento,
    ESPECIFICACIONES,
    resumir,
)

HOY = date(2026, 9, 1)

PADRON = """
SERVICIO DE REGISTRO CIVIL E IDENTIFICACION
REGISTRO DE VEHICULOS MOTORIZADOS
CERTIFICADO DE INSCRIPCION
PLACA UNICA: BBCL-10
TIPO DE VEHICULO: STATION WAGON
MARCA: TOYOTA MODELO: RAV4 LIMITED
ANO: 2023
PROPIETARIO: JUAN CARLOS PEREZ SOTO
RUT: 18.456.789-K
FECHA DE INSCRIPCION: 12-05-2023
"""

PERMISO_VIGENTE = """
MUNICIPALIDAD DE LOS ANGELES
DIRECCION DE TRANSITO Y TRANSPORTE PUBLICO
PERMISO DE CIRCULACION
PLACA PATENTE: BBCL-10
TASACION: $ 8.450.000
VALOR PERMISO: $ 145.320
PAGADO EL 25-03-2026
VALIDO HASTA 31-03-2027
FOLIO N° 4457821
"""

PERMISO_VENCIDO = PERMISO_VIGENTE.replace("31-03-2027", "31-03-2025").replace(
    "PAGADO EL 25-03-2026", "PAGADO EL 25-03-2024"
)

SOAP = """
SEGURO OBLIGATORIO DE ACCIDENTES PERSONALES
LEY 18.490
COMPANIA DE SEGUROS GENERALES XYZ S.A.
POLIZA N° 987654321
PATENTE: BBCL-10
VIGENCIA DESDE 01-04-2026 HASTA 31-03-2027
"""

SEGURO_COMERCIAL = """
POLIZA DE SEGURO AUTOMOTRIZ
COMPANIA DE SEGUROS CONSORCIO
ASEGURADO: JUAN CARLOS PEREZ SOTO
PATENTE: BBCL-10
COBERTURA: DANOS PROPIOS Y RESPONSABILIDAD CIVIL
DEDUCIBLE: 15 UF
PRIMA ANUAL: $ 480.000
VIGENCIA HASTA 15-08-2027
"""

REVISION_TECNICA = """
MINISTERIO DE TRANSPORTES Y TELECOMUNICACIONES
CERTIFICADO DE REVISION TECNICA Y ANALISIS DE GASES
PLANTA DE REVISION TECNICA CLASE B N° 8104
PLACA PATENTE BBCL-10
FECHA REVISION 12-08-2026
VALIDO HASTA 08/2027
"""


class TestLectura:
    def test_reconoce_cada_documento(self):
        assert clasificar_documento(PADRON)[0] == "padron"
        assert clasificar_documento(PERMISO_VIGENTE)[0] == "permiso_circulacion"
        assert clasificar_documento(SOAP)[0] == "soap"
        assert clasificar_documento(SEGURO_COMERCIAL)[0] == "seguro"
        assert clasificar_documento(REVISION_TECNICA)[0] == "revision_tecnica"

    def test_no_confunde_el_soap_con_una_poliza_comercial(self):
        # Comparten vocabulario ("póliza", "compañía de seguros"): lo que
        # decide es la ley 18.490 / "seguro obligatorio".
        assert clasificar_documento(SOAP)[0] == "soap"
        assert clasificar_documento(SEGURO_COMERCIAL)[0] == "seguro"

    @pytest.mark.parametrize(
        "texto",
        [PADRON, PERMISO_VIGENTE, SOAP, SEGURO_COMERCIAL, REVISION_TECNICA],
    )
    def test_extrae_la_patente_de_todos(self, texto):
        assert extraer_patente(texto) == "BBCL10"

    def test_lee_el_vencimiento_del_rotulo(self):
        assert extraer_vencimiento(PERMISO_VIGENTE, ESPECIFICACIONES["permiso_circulacion"]) == date(2027, 3, 31)
        assert extraer_vencimiento(SOAP, ESPECIFICACIONES["soap"]) == date(2027, 3, 31)
        assert extraer_vencimiento(SEGURO_COMERCIAL, ESPECIFICACIONES["seguro"]) == date(2027, 8, 15)

    def test_el_mes_ano_de_la_revision_vale_hasta_fin_de_mes(self):
        assert extraer_vencimiento(REVISION_TECNICA, ESPECIFICACIONES["revision_tecnica"]) == date(2027, 8, 31)

    def test_sin_rotulo_toma_la_fecha_mas_lejana(self):
        # El OCR se come rótulos con frecuencia; el término de vigencia es
        # siempre la fecha más lejana del documento.
        sin_rotulo = SOAP.replace("VIGENCIA DESDE 01-04-2026 HASTA", "01-04-2026")
        assert extraer_vencimiento(sin_rotulo, ESPECIFICACIONES["soap"]) == date(2027, 3, 31)


class TestValidez:
    def test_documento_vigente_queda_valido(self):
        r = analizar_documento(PERMISO_VIGENTE, "permiso_circulacion", "BBCL-10", hoy=HOY)
        assert r["estado"] == "vigente"
        assert r["valido"] is True
        assert r["bloquea"] is False
        assert r["vencimiento"] == "2027-03-31"
        assert r["coincide_patente"] is True

    def test_documento_vencido_bloquea_la_publicacion(self):
        r = analizar_documento(PERMISO_VENCIDO, "permiso_circulacion", "BBCL-10", hoy=HOY)
        assert r["estado"] == "vencido"
        assert r["bloquea"] is True
        assert r["valido"] is False
        assert "vencio" in r["motivo"].lower().replace("ó", "o")

    def test_avisa_cuando_esta_por_vencer_pero_no_bloquea(self):
        r = analizar_documento(SOAP, "soap", "BBCL-10", hoy=date(2027, 3, 20))
        assert r["estado"] == "por_vencer"
        assert r["valido"] is True
        assert r["bloquea"] is False
        assert r["dias_para_vencer"] == 11

    def test_documento_de_otro_auto_bloquea(self):
        otro = SOAP.replace("BBCL-10", "JKLM-56")
        r = analizar_documento(otro, "soap", "BBCL-10", hoy=HOY)
        assert r["estado"] == "patente_no_coincide"
        assert r["bloquea"] is True
        assert r["patente_detectada"] == "JKLM56"

    def test_documento_del_tipo_equivocado_bloquea(self):
        r = analizar_documento(PADRON, "soap", "BBCL-10", hoy=HOY)
        assert r["estado"] == "tipo_incorrecto"
        assert r["bloquea"] is True

    def test_el_padron_no_vence(self):
        r = analizar_documento(PADRON, "padron", "BBCL-10", hoy=HOY)
        assert r["estado"] == "sin_vencimiento"
        assert r["valido"] is True
        assert r["vencimiento"] is None

    def test_ilegible_va_a_revision_pero_no_bloquea(self):
        r = analizar_documento("   ", "soap", "BBCL-10", hoy=HOY)
        assert r["estado"] == "ilegible"
        assert r["bloquea"] is False
        assert r["requiere_revision"] is True

    def test_sin_patente_legible_va_a_revision(self):
        sin_patente = SOAP.replace("PATENTE: BBCL-10", "PATENTE: ILEGIBLE")
        r = analizar_documento(sin_patente, "soap", "BBCL-10", hoy=HOY)
        assert r["bloquea"] is False
        assert r["requiere_revision"] is True
        assert r["patente_detectada"] is None

    def test_seguro_del_auto_se_valida_como_los_demas(self):
        r = analizar_documento(SEGURO_COMERCIAL, "seguro", "BBCL-10", hoy=HOY)
        assert r["estado"] == "vigente"
        assert r["vencimiento"] == "2027-08-15"

        vencido = SEGURO_COMERCIAL.replace("15-08-2027", "15-08-2025")
        assert analizar_documento(vencido, "seguro", "BBCL-10", hoy=HOY)["estado"] == "vencido"

    def test_tipo_desconocido_es_error_de_programacion(self):
        with pytest.raises(ValueError):
            analizar_documento(PADRON, "no_existe", "BBCL-10")


class TestResumen:
    def _analizar_todos(self, permiso=PERMISO_VIGENTE):
        return [
            analizar_documento(PADRON, "padron", "BBCL-10", hoy=HOY),
            analizar_documento(permiso, "permiso_circulacion", "BBCL-10", hoy=HOY),
            analizar_documento(SOAP, "soap", "BBCL-10", hoy=HOY),
            analizar_documento(REVISION_TECNICA, "revision_tecnica", "BBCL-10", hoy=HOY),
        ]

    def test_todo_vigente_queda_verificado(self):
        r = resumir(self._analizar_todos())
        assert r["verificado"] is True
        assert r["bloqueantes"] == []
        assert r["motivo_soporte"] is None

    def test_un_vencido_deja_el_bloqueante_a_la_vista(self):
        r = resumir(self._analizar_todos(permiso=PERMISO_VENCIDO))
        assert r["verificado"] is False
        assert len(r["bloqueantes"]) == 1
        assert r["bloqueantes"][0]["tipo"] == "permiso_circulacion"

    def test_un_ilegible_manda_a_revision_sin_bloquear(self):
        analisis = self._analizar_todos()
        analisis.append(analizar_documento("", "seguro", "BBCL-10", hoy=HOY))
        r = resumir(analisis)
        assert r["verificado"] is False
        assert r["bloqueantes"] == []
        assert r["motivo_soporte"]
