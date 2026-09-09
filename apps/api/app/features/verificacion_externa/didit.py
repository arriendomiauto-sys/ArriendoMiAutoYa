"""Compat shim — este módulo ES app.features.auth.didit.didit."""
import sys
from app.features.auth.didit import didit as _real

sys.modules[__name__] = _real
