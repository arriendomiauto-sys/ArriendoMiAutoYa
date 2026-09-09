"""Compat shim — este módulo ES app.features.auth.ocr.ocr_engine.

El refactor a app/features/* dejó una copia acá; en vez de duplicar el motor
de OCR, se aliasea al módulo real para que cualquier import legacy y cualquier
`patch("app.features.verificacion_identidad.ocr_engine.OCRService...")` apunten
exactamente al mismo objeto.
"""
import sys
from app.features.auth.ocr import ocr_engine as _real

sys.modules[__name__] = _real
