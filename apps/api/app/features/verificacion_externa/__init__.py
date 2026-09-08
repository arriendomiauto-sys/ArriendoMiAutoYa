"""
Verificación de identidad con proveedor externo.

Hoy el único adaptador es Didit (sesión hosted: cédula + liveness + face
match + validación del RUT contra Registro Civil). Todo pasa por el flag
`settings.VERIFICACION_EXTERNA_HABILITADA`; apagado, el enrolamiento sigue
con el OCR in-process de `app.features.verificacion_identidad`.
"""
from app.features.verificacion_externa import didit

__all__ = ["didit"]
