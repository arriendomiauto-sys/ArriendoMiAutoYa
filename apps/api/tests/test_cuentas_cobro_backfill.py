"""
backfill_cuentas_cobro(): por cada usuario con `cuenta_bancaria` JSON y sin
filas en `cuentas_cobro`, crea una CuentaCobro predeterminada. Idempotente.

`backfill_cuentas_cobro()` abre su propia sesión vía `schema_sync.SessionLocal`
(ligada al engine de la app). En la suite esa sesión se redirige al mismo
engine en memoria que `db_session`, con el patrón `NoCloseSession` que ya usa
test_socketio_chat_integration.py, para que el test ejercite la lógica real
contra la BD de pruebas.
"""
from unittest.mock import patch

from app.core import schema_sync
from app.models.entities import CuentaCobro, Usuario


class _NoCloseSession:
    """Delega en la sesión del test pero ignora `close()` (la cierra el fixture)."""

    def __init__(self, s):
        self._s = s

    def __getattr__(self, item):
        if item == "close":
            return lambda: None
        return getattr(self._s, item)


def test_backfill_crea_cuenta_desde_json(db_session):
    u = db_session.query(Usuario).first()
    u.cuenta_bancaria = {
        "banco": "BancoEstado", "tipo_cuenta": "CuentaRUT",
        "numero": "12345678", "titular": u.nombre, "rut": "11.111.111-1",
    }
    db_session.commit()

    with patch.object(schema_sync, "SessionLocal", return_value=_NoCloseSession(db_session)):
        creadas = schema_sync.backfill_cuentas_cobro()
        assert creadas >= 1

        fila = db_session.query(CuentaCobro).filter(CuentaCobro.usuario_id == u.id).one()
        assert fila.banco == "BancoEstado"
        assert fila.numero == "12345678"
        assert fila.predeterminada is True

        # Idempotente: segunda pasada no duplica.
        assert schema_sync.backfill_cuentas_cobro() == 0
        assert db_session.query(CuentaCobro).filter(CuentaCobro.usuario_id == u.id).count() == 1
