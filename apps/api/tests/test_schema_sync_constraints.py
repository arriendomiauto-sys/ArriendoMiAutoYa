"""
`reconcile_check_constraints()` recrea en Postgres las CHECK que se quedaron
viejas (schema.sql tenía menos valores que el código, p. ej.
`reservas.estado = 'pendiente_pago'` del pago dual).

En SQLite (dev/tests) el schema sale de los modelos, que no declaran esas
CHECK, así que la función debe ser un no-op silencioso. Que una reserva
`pendiente_pago` se persista ya lo cubren test_pagos_duales /
test_verificacion_identidad vía el endpoint real.
"""
from app.core import schema_sync


def test_reconcile_check_constraints_noop_en_sqlite():
    # No debe tocar nada ni lanzar en SQLite.
    schema_sync.reconcile_check_constraints()


def test_constraint_reservas_incluye_pendiente_pago():
    _, _, valores = schema_sync._CHECKS_ESPERADAS["reservas"]
    assert "pendiente_pago" in valores


def test_constraint_pagos_incluye_procesando_y_retenido():
    _, _, valores = schema_sync._CHECKS_ESPERADAS["pagos"]
    assert "procesando" in valores
    assert "retenido" in valores  # ya se usa en el código y faltaba en schema.sql


def test_constraint_pagos_tipo_incluye_todos_los_tipos_que_inserta_el_codigo():
    """
    Cada uno de estos `Pago(tipo=...)` existe en el código (bono de
    referidos, cargo de GPS sin señal, multas por falta, cobro posterior de
    TAG/peaje) pero la CHECK de producción se quedó con la lista original de
    `schema.sql` -- un INSERT de cualquiera de estos tipos revienta con 500
    hasta que se reconcilie.
    """
    _, _, valores = schema_sync._CHECKS_ESPERADAS["pagos_tipo"]
    for tipo in (
        "bono_referido",
        "cargo_gps_sin_senal",
        "cargo_fumar",
        "cargo_lugar_no_acordado",
        "cargo_mascotas",
        "cargo_limpieza_estandar",
        "cargo_limpieza_profunda",
        "cargo_otro",
        "cobro_posterior_tag",
        "cobro_posterior_peaje",
        "cobro_posterior_multa",
        "cobro_posterior_otro",
    ):
        assert tipo in valores, f"falta '{tipo}' en pagos_tipo_check"
