"""
Test Suite: qa-ocr-edge-cases
Verifica casos de borde (edge cases) y validaciones OCR críticas:
1. Pólizas con formatos diversos (BCI, Mapfre, HDI, Sura, Consorcio, Chilena Consolidada).
2. Detección y rechazo de comprobantes no aseguradores (boletas de retail, transferencias bancarias, fotos casuales).
3. Censura y normalización de patentes con caracteres especiales, guiones y espacios.
4. Robustez ante imágenes corruptas o sin texto extraíble.
"""
import pytest
from app.features.verificacion_vehiculos.car_doc_validator import (
    evaluar_poliza_seguro,
)
from app.features.verificacion_identidad.ocr_engine import _normalizar_texto
from app.core.validators import validar_patente_chilena
from app.services.image_privacy import ImagePrivacy


def test_polizas_aseguradoras_chilenas_diversas():
    textos_validos = [
        "PÓLIZA DE SEGURO AUTOMOTRIZ BCI SEGUROS GENERALES N° POLIZA 9876543 COBERTURA TOTAL",
        "MAPFRE COMPAÑIA DE SEGUROS VEHICULOS MOTORIZADOS DEDUCIBLE 15 UF CONDICIONES GENERALES",
        "HDI SEGUROS S.A. CERTIFICADO DE COBERTURA PÓLIZA INDIVIDUAL ARRIENDO PEER TO PEER",
        "SURA SEGURO AUTOMOTRIZ TITULAR VEHICULO FOLIO DE POLIZA 11223344 VIGENCIA ANUAL",
        "CONSORCIO NACIONAL DE SEGUROS POLIZA VEHICULAR PRIMA MENSUAL CLAUSULA DEDUCIBLE",
    ]
    for texto in textos_validos:
        res = evaluar_poliza_seguro(texto)
        assert res["es_poliza"] is True, f"Fallo al validar poliza: {res.get('motivo')} en '{texto}'"


def test_documentos_no_poliza_rechazados_correctamente():
    textos_invalidos = [
        "BOLETA ELECTRONICA N 12345 SODIMAC CONSTRUCTOR COMPRA MATERIALES",
        "COMPROBANTE DE TRANSFERENCIA BANCO ESTADO MONTO $50.000 CUENTA RUT",
        "FOTO DE PAISAJE EN LA CORDILLERA DE LOS ANDES CON SOL",
        "CONTRATO DE TRABAJO INDEFINIDO JORNADA COMPLETA EMPLEADOR TRABAJADOR",
        "",
        "    \n\t  ",
    ]
    for texto in textos_invalidos:
        res = evaluar_poliza_seguro(texto)
        assert res["es_poliza"] is False, f"Se acepto texto invalido como poliza: '{texto}'"


def test_normalizacion_de_patentes_edge_cases():
    # Formato nuevo 4 letras 2 digitos
    assert validar_patente_chilena("BBCL-10") is True
    assert validar_patente_chilena("bbcl10") is True
    assert validar_patente_chilena("BB CL 10") is True
    assert validar_patente_chilena("BB-CL-10") is True

    # Formato antiguo 2 letras 4 digitos
    assert validar_patente_chilena("AA-1000") is True
    assert validar_patente_chilena("aa1000") is True
    assert validar_patente_chilena("AA 10 00") is True

    # Patentes inválidas
    assert validar_patente_chilena("INVALIDA") is False
    assert validar_patente_chilena("1234-AB") is False
    assert validar_patente_chilena("") is False


def test_censura_patente_con_bytes_invalidos_no_explota():
    # Datos binarios que no son imagen
    invalid_bytes = b"NOT_AN_IMAGE_DATA"
    res = ImagePrivacy.censurar_patentes(invalid_bytes)
    assert res == invalid_bytes
