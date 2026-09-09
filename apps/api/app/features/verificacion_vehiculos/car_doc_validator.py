"""Compat shim — este módulo ES app.features.vehicles.verification.car_doc_validator."""
import sys
from app.features.vehicles.verification import car_doc_validator as _real

sys.modules[__name__] = _real
