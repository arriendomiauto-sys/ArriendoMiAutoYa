"""
Un celular = una cuenta.

El celular identifica a cada cliente: dos cuentas con el mismo número
permitían, por ejemplo, abrir una segunda cuenta después de un bloqueo. Se
compara siempre en el formato normalizado ('+56 9 1234 5678') con que el
schema de entrada guarda el número.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.validators import formatear_telefono_chileno
from app.models.entities import Usuario

MENSAJE_TELEFONO_OCUPADO = "Ese celular ya está asociado a otra cuenta. Inicia sesión con esa cuenta."


def telefono_ocupado(db: Session, telefono: Optional[str], excepto_usuario_id: Optional[str] = None) -> bool:
    normalizado = formatear_telefono_chileno(telefono)
    if not normalizado:
        return False
    consulta = db.query(Usuario.id).filter(Usuario.telefono == normalizado)
    if excepto_usuario_id:
        consulta = consulta.filter(Usuario.id != excepto_usuario_id)
    return consulta.first() is not None


def exigir_telefono_libre(db: Session, telefono: Optional[str], usuario_id: str) -> None:
    """409 si el número ya es de otra cuenta. Guardar el propio número otra vez está bien."""
    if telefono_ocupado(db, telefono, excepto_usuario_id=usuario_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=MENSAJE_TELEFONO_OCUPADO)
