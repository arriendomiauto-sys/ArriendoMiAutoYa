from datetime import datetime, timedelta, timezone
from app.core.validators import (
    validar_rut_chileno,
    validar_patente_chilena,
    validar_telefono_chileno,
    validar_disponibilidad_reserva
)
from app.models.entities import Auto, Reserva, Usuario

def test_validador_rut_chileno_modulo_11():
    # RUTs válidos conocidos
    assert validar_rut_chileno("18.456.789-K") is True
    assert validar_rut_chileno("18456789-k") is True
    assert validar_rut_chileno("18456789K") is True
    assert validar_rut_chileno("15.892.341-6") is True
    assert validar_rut_chileno("19.234.567-7") is True
    assert validar_rut_chileno("11.111.111-1") is True
    assert validar_rut_chileno("11.222.333-9") is True

    # RUTs inválidos
    assert validar_rut_chileno("18.456.789-0") is False # DV erróneo
    assert validar_rut_chileno("15.892.341-K") is False # DV erróneo
    assert validar_rut_chileno("12345") is False
    assert validar_rut_chileno("abcdefgh-k") is False
    assert validar_rut_chileno("") is False

def test_validador_patente_chilena():
    # Patentes formato nuevo (4 letras + 2 números)
    assert validar_patente_chilena("BBCL-10") is True
    assert validar_patente_chilena("bbcl10") is True
    assert validar_patente_chilena("CRTX-45") is True
    assert validar_patente_chilena("JKLM-56") is True

    # Patentes formato antiguo (2 letras + 4 números)
    assert validar_patente_chilena("AB-12-34") is True
    assert validar_patente_chilena("AB1234") is True

    # Patentes inválidas
    assert validar_patente_chilena("1234-AB") is False
    assert validar_patente_chilena("ABC") is False
    assert validar_patente_chilena("ABCDEF") is False

def test_validador_telefono_chileno():
    assert validar_telefono_chileno("+56912345678") is True
    assert validar_telefono_chileno("+56 9 1234 5678") is True
    assert validar_telefono_chileno("912345678") is True
    assert validar_telefono_chileno("123456") is False

def test_validador_no_solapamiento_reservas(db_session):
    auto = db_session.query(Auto).first()
    assert auto is not None

    ahora = datetime.now(timezone.utc)

    # El auto ya tiene una reserva confirmada desde 'ahora' hasta 'ahora + 3 días'
    # 1. Intento de reserva que se solapa exactamente -> debe retornar False
    disponible_solapada = validar_disponibilidad_reserva(
        auto_id=auto.id,
        fecha_inicio=ahora + timedelta(days=1),
        fecha_fin=ahora + timedelta(days=2),
        db=db_session
    )
    assert disponible_solapada is False

    # 2. Intento de reserva en fechas futuras libres (ej. dentro de 10 días) -> debe retornar True
    disponible_libre = validar_disponibilidad_reserva(
        auto_id=auto.id,
        fecha_inicio=ahora + timedelta(days=10),
        fecha_fin=ahora + timedelta(days=13),
        db=db_session
    )
    assert disponible_libre is True
