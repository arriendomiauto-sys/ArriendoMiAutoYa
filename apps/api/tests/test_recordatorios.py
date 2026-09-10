"""
Recordatorios push de entrega/devolución.

Regresión: en Render el bucle crasheaba en CADA pasada con
`TypeError: can't compare offset-naive and offset-aware datetimes`. Postgres
devuelve `Reserva.fecha_inicio` / `fecha_fin` como datetimes *aware*
(`timestamptz`); el `ahora` por defecto del servicio era *naive*
(`datetime.utcnow()`). La suite local corre sobre SQLite, que entrega los
datetimes naive, así que nunca se vio en tests. Ahora `_debe_enviarse`
normaliza ambos lados a UTC naive antes de comparar.
"""
from datetime import datetime, timezone

from app.features.communications.notifications import reminders_service as rs


def test_debe_enviarse_objetivo_aware_ahora_naive():
    # objetivo como lo devuelve Postgres (aware), ahora como utcnow() (naive)
    ahora = datetime(2026, 1, 10, 12, 0, 0)
    objetivo = datetime(2026, 1, 11, 12, 0, 0, tzinfo=timezone.utc)
    # 24 h antes de `objetivo` == `ahora` exacto -> dentro de la ventana
    assert rs._debe_enviarse(objetivo, ahora, 24) is True


def test_debe_enviarse_ahora_aware_objetivo_naive():
    ahora = datetime(2026, 1, 10, 12, 0, 0, tzinfo=timezone.utc)
    objetivo = datetime(2026, 1, 11, 12, 0, 0)
    assert rs._debe_enviarse(objetivo, ahora, 24) is True


def test_debe_enviarse_ambos_aware_fuera_de_ventana():
    ahora = datetime(2026, 1, 10, 12, 0, 0, tzinfo=timezone.utc)
    objetivo = datetime(2026, 1, 12, 12, 0, 0, tzinfo=timezone.utc)  # 48 h -> lejos
    assert rs._debe_enviarse(objetivo, ahora, 24) is False


def test_enviar_recordatorios_no_crashea_con_ahora_aware(db_session):
    # El seed crea una reserva "confirmada" con fechas aware; pasar `ahora`
    # aware ejercita la comparación que petaba en Render.
    enviados = rs.enviar_recordatorios_pendientes(
        db_session, ahora=datetime.now(timezone.utc)
    )
    assert isinstance(enviados, int)
