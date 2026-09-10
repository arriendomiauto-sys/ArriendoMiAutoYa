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
