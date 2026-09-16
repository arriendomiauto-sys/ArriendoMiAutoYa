"""
`Auto.categoria` antes solo se validaba como Literal en el schema Pydantic
(app/schemas/schemas.py) — una fila insertada por fuera de esa capa (script,
migración de datos, panel admin directo a la BD) podía quedar con un valor
libre. Esto verifica el CHECK constraint agregado a nivel de columna
(ck_auto_categoria_valida en app/models/entities.py).
"""
import pytest
from sqlalchemy.exc import IntegrityError
from app.models.entities import Auto


def test_categoria_invalida_rechazada_por_constraint(db_session, usuario_factory):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Suzuki",
        modelo="Swift",
        anio=2021,
        patente="ZZCL-99",
        tarifa_dia=20000,
        ubicacion_base="Los Ángeles",
        categoria="camion_pesado",  # no es uno de los 5 valores válidos
    )
    db_session.add(auto)
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_categoria_valida_se_guarda_sin_problema(db_session, usuario_factory):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Suzuki",
        modelo="Swift",
        anio=2021,
        patente="ZZCL-98",
        tarifa_dia=20000,
        ubicacion_base="Los Ángeles",
        categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    assert auto.categoria == "economico"


def test_categoria_nula_se_permite(db_session, usuario_factory):
    """El campo sigue siendo opcional: NULL no viola el CHECK."""
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id,
        marca="Suzuki",
        modelo="Swift",
        anio=2021,
        patente="ZZCL-97",
        tarifa_dia=20000,
        ubicacion_base="Los Ángeles",
    )
    db_session.add(auto)
    db_session.commit()
    assert auto.categoria is None
