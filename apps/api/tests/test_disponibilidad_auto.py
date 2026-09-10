"""
`GET /autos/{id}/disponibilidad` — rangos ya reservados de un auto, para que
el calendario del móvil deshabilite esos días y no se elijan fechas que el
backend rechaza con 400.

Bloquean: `pendiente_pago` (no expirada), `confirmada`, `en_curso`.
No bloquean: `pendiente`, `finalizada`, `cancelada`, `disputada`, ni una
`pendiente_pago` cuyo TTL ya venció.
"""
from datetime import datetime, timedelta

from app.models.entities import Reserva


def _reserva(db, auto_id, cliente_id, estado, dia_desde, dia_hasta, expira_en=None):
    base = datetime.utcnow()
    r = Reserva(
        auto_id=auto_id,
        cliente_id=cliente_id,
        fecha_inicio=base + timedelta(days=dia_desde),
        fecha_fin=base + timedelta(days=dia_hasta),
        estado=estado,
        lugar_entrega_acordado="Plaza de Armas",
        expira_en=expira_en,
    )
    db.add(r)
    db.commit()
    return r


def test_disponibilidad_lista_solo_estados_que_ocupan(client, db_session):
    demo = db_session.query(Reserva).filter(Reserva.estado == "confirmada").first()
    auto_id = demo.auto_id
    cliente_id = demo.cliente_id
    ahora = datetime.utcnow()

    _reserva(db_session, auto_id, cliente_id, "pendiente_pago", 10, 15,
             expira_en=ahora + timedelta(minutes=20))          # cuenta
    _reserva(db_session, auto_id, cliente_id, "pendiente_pago", 40, 45,
             expira_en=ahora - timedelta(minutes=5))           # expirada -> NO cuenta
    _reserva(db_session, auto_id, cliente_id, "en_curso", 20, 22)   # cuenta
    _reserva(db_session, auto_id, cliente_id, "finalizada", 60, 63) # NO cuenta
    _reserva(db_session, auto_id, cliente_id, "cancelada", 70, 73)  # NO cuenta

    resp = client.get(f"/api/v1/autos/{auto_id}/disponibilidad")
    assert resp.status_code == 200
    rangos = resp.json()["rangos_ocupados"]
    # demo confirmada + pendiente_pago vigente + en_curso = 3
    assert len(rangos) == 3
    for r in rangos:
        assert "fecha_inicio" in r and "fecha_fin" in r


def test_disponibilidad_auto_inexistente_404(client):
    assert client.get("/api/v1/autos/no-existe/disponibilidad").status_code == 404


def test_pendiente_pago_bloquea_solapamiento(db_session):
    from app.core.validators import validar_disponibilidad_reserva

    demo = db_session.query(Reserva).filter(Reserva.estado == "confirmada").first()
    ahora = datetime.utcnow()
    _reserva(db_session, demo.auto_id, demo.cliente_id, "pendiente_pago", 100, 105,
             expira_en=ahora + timedelta(minutes=20))

    libre = validar_disponibilidad_reserva(
        demo.auto_id, ahora + timedelta(days=102), ahora + timedelta(days=104), db_session
    )
    assert libre is False
