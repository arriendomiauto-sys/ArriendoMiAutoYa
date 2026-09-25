"""
Cancelación de reservas: qué pasa con el dinero.

Antes, `PATCH /reservas/{id}/estado?nuevo_estado=cancelada` solo cambiaba el
string de estado: la garantía (hold) seguía retenida en la tarjeta del
arrendatario y el cobro del arriendo nunca se devolvía, aunque la app le
prometía "tu garantía queda liberada".

Política implementada (los umbrales viven en `cancelacion_service`):
  · La garantía SIEMPRE se libera al cancelar.
  · Cancela el dueño, o rechaza una solicitud: reembolso total del arriendo.
  · Cancela el arrendatario con >= 24 h de anticipación: reembolso total.
  · Cancela el arrendatario con < 24 h: el arriendo NO se reembolsa solo,
    queda para que soporte lo coordine (es lo que ya le dice la app).

También cubre el barrido de TTL de `pendiente_pago` y un hueco de permisos:
el arrendatario podía confirmar su propia reserva sin pagar.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Notificacion, Pago, Reserva

MONTO_COBRO = 90000
MONTO_HOLD = 250000


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _auto(db_session, dueno, patente="CANC-01"):
    auto = Auto(
        dueno_id=dueno.id, marca="Suzuki", modelo="Swift", anio=2023,
        patente=patente, tarifa_dia=30000, estado="activo",
        ubicacion_base="Plaza de Armas, Los Ángeles",
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)
    return auto


def _reserva(
    db_session, cliente, dueno, estado="confirmada", horas_para_inicio=72,
    con_pagos=True, expira_en=None, cobro_estado="capturado", patente="CANC-01",
):
    auto = _auto(db_session, dueno, patente=patente)
    inicio = _ahora() + timedelta(hours=horas_para_inicio)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=3),
        estado=estado, monto_cobro=MONTO_COBRO, monto_hold=MONTO_HOLD,
        expira_en=expira_en, lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)
    if con_pagos:
        db_session.add_all([
            Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="hold_reserva",
                 monto=MONTO_HOLD, estado="retenido", referencia_pago="1000000001"),
            Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="cobro_arriendo",
                 monto=MONTO_COBRO, estado=cobro_estado, referencia_pago="1000000002"),
        ])
        db_session.commit()
    return reserva


def _pago(db_session, reserva, tipo):
    db_session.expire_all()
    return db_session.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo == tipo).one()


def _notificaciones(db_session, usuario):
    db_session.expire_all()
    return db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id).all()


@pytest.fixture
def pasarela(monkeypatch):
    """Registra las llamadas a Mercado Pago; ambas operaciones "funcionan"."""
    llamadas = {"liberar": [], "reembolsar": []}

    def liberar(cls, payment_id):
        llamadas["liberar"].append(payment_id)
        return {"success": True}

    def reembolsar(cls, payment_id, monto=None):
        llamadas["reembolsar"].append((payment_id, monto))
        return {"success": True}

    monkeypatch.setattr(MercadoPagoService, "liberar_hold", classmethod(liberar))
    monkeypatch.setattr(MercadoPagoService, "reembolsar", classmethod(reembolsar))
    return llamadas


def _cancelar(auth_as, usuario, reserva):
    return auth_as(usuario).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "cancelada"}
    )


@pytest.fixture
def partes(usuario_factory):
    return (
        usuario_factory(roles_activos=["cliente"]),
        usuario_factory(roles_activos=["dueno"]),
    )


# ===========================================================================
# Cancela el arrendatario
# ===========================================================================
def test_arrendatario_cancela_con_anticipacion_recibe_todo_de_vuelta(
    partes, auth_as, db_session, pasarela
):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=72)

    resp = _cancelar(auth_as, cliente, reserva)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "cancelada"
    assert _pago(db_session, reserva, "hold_reserva").estado == "liberado"
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "reembolsado"
    assert pasarela["liberar"] == ["1000000001"]
    assert pasarela["reembolsar"] == [("1000000002", None)]


def test_arrendatario_cancela_tarde_libera_garantia_pero_no_reembolsa_solo(
    partes, auth_as, db_session, pasarela
):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=6)

    resp = _cancelar(auth_as, cliente, reserva)

    assert resp.status_code == 200, resp.text
    assert _pago(db_session, reserva, "hold_reserva").estado == "liberado"
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "capturado"
    assert pasarela["liberar"] == ["1000000001"]
    assert pasarela["reembolsar"] == []


def test_cancelar_avisa_a_ambas_partes(partes, auth_as, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=72)

    _cancelar(auth_as, cliente, reserva)

    assert any(n.entidad_id == reserva.id for n in _notificaciones(db_session, dueno))
    assert any(n.entidad_id == reserva.id for n in _notificaciones(db_session, cliente))


# ===========================================================================
# Cancela el dueño
# ===========================================================================
def test_dueno_cancela_y_el_arrendatario_recupera_todo_aunque_falte_poco(
    partes, auth_as, db_session, pasarela
):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=2)

    resp = _cancelar(auth_as, dueno, reserva)

    assert resp.status_code == 200, resp.text
    assert _pago(db_session, reserva, "hold_reserva").estado == "liberado"
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "reembolsado"
    assert any(n.entidad_id == reserva.id for n in _notificaciones(db_session, cliente))


def test_rechazar_una_solicitud_sin_pagos_solo_la_cancela(partes, auth_as, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="pendiente", con_pagos=False)

    resp = _cancelar(auth_as, dueno, reserva)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "cancelada"
    assert pasarela == {"liberar": [], "reembolsar": []}


# ===========================================================================
# Robustez
# ===========================================================================
def test_cancelar_dos_veces_no_devuelve_el_dinero_dos_veces(partes, auth_as, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=72)

    assert _cancelar(auth_as, cliente, reserva).status_code == 200
    segunda = _cancelar(auth_as, cliente, reserva)

    assert segunda.status_code == 400
    assert len(pasarela["liberar"]) == 1
    assert len(pasarela["reembolsar"]) == 1


def test_si_la_pasarela_falla_el_pago_no_se_marca_como_devuelto(
    partes, auth_as, db_session, monkeypatch
):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=72)
    monkeypatch.setattr(
        MercadoPagoService, "liberar_hold",
        classmethod(lambda cls, pid: {"success": False, "error": "timeout"}),
    )
    monkeypatch.setattr(
        MercadoPagoService, "reembolsar",
        classmethod(lambda cls, pid, monto=None: {"success": False, "error": "timeout"}),
    )

    resp = _cancelar(auth_as, cliente, reserva)

    # La reserva se cancela igual (es lo que el usuario pidió), pero el dinero
    # sigue marcado como pendiente de devolver para que no se pierda de vista.
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "cancelada"
    assert _pago(db_session, reserva, "hold_reserva").estado == "retenido"
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "capturado"


def test_pagos_simulados_no_llaman_a_la_pasarela(partes, auth_as, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, horas_para_inicio=72)
    for p in db_session.query(Pago).filter(Pago.reserva_id == reserva.id):
        p.referencia_pago = "SIMULADO-CREDITO-1234"
    db_session.commit()

    resp = _cancelar(auth_as, cliente, reserva)

    assert resp.status_code == 200, resp.text
    assert pasarela == {"liberar": [], "reembolsar": []}
    assert _pago(db_session, reserva, "hold_reserva").estado == "liberado"
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "reembolsado"


# ===========================================================================
# Hueco de permisos: confirmar sin pagar
# ===========================================================================
def test_arrendatario_no_puede_confirmar_su_propia_reserva_pendiente_de_pago(
    partes, auth_as, db_session
):
    cliente, dueno = partes
    reserva = _reserva(
        db_session, cliente, dueno, estado="pendiente_pago", con_pagos=False,
        expira_en=_ahora() + timedelta(minutes=20),
    )

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code in (400, 403), resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "pendiente_pago"


def test_arrendatario_no_puede_aceptar_su_propia_solicitud(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="pendiente", con_pagos=False)

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code == 403, resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "pendiente"


def test_dueno_si_puede_aceptar_una_solicitud_pendiente(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="pendiente", con_pagos=False)

    resp = auth_as(dueno).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "confirmada"


# ===========================================================================
# Barrido de TTL de pendiente_pago
# ===========================================================================
def test_barrido_cancela_las_pendientes_de_pago_vencidas(partes, db_session, pasarela):
    from app.features.bookings.reservations.cancelacion_service import expirar_reservas_vencidas

    cliente, dueno = partes
    vencida = _reserva(
        db_session, cliente, dueno, estado="pendiente_pago", con_pagos=False,
        expira_en=_ahora() - timedelta(minutes=1), patente="TTL-001",
    )
    vigente = _reserva(
        db_session, cliente, dueno, estado="pendiente_pago", con_pagos=False,
        expira_en=_ahora() + timedelta(minutes=20), patente="TTL-002",
    )
    confirmada = _reserva(
        db_session, cliente, dueno, estado="confirmada", con_pagos=False,
        expira_en=_ahora() - timedelta(days=1), patente="TTL-003",
    )

    canceladas = expirar_reservas_vencidas(db_session)

    assert canceladas == 1
    db_session.expire_all()
    assert db_session.get(Reserva, vencida.id).estado == "cancelada"
    assert db_session.get(Reserva, vigente.id).estado == "pendiente_pago"
    assert db_session.get(Reserva, confirmada.id).estado == "confirmada"


def test_barrido_libera_la_garantia_que_quedo_retenida(partes, db_session, pasarela):
    """Cobro en revisión del banco: la garantía quedó tomada y el TTL venció."""
    from app.features.bookings.reservations.cancelacion_service import expirar_reservas_vencidas

    cliente, dueno = partes
    reserva = _reserva(
        db_session, cliente, dueno, estado="pendiente_pago",
        expira_en=_ahora() - timedelta(minutes=1), cobro_estado="pendiente",
    )

    expirar_reservas_vencidas(db_session)

    assert _pago(db_session, reserva, "hold_reserva").estado == "liberado"
    assert pasarela["liberar"][0] == "1000000001"
    # Un cobro que nunca se acreditó no se "reembolsa": se cancela en la pasarela.
    assert pasarela["reembolsar"] == []
    assert _pago(db_session, reserva, "cobro_arriendo").estado == "liberado"


# ===========================================================================
# Garantías que quedaron colgadas en reservas ya canceladas
# ===========================================================================
def test_barrido_libera_garantias_de_reservas_ya_canceladas(partes, db_session, pasarela):
    """
    Herencia del bug anterior (canceladas que nunca soltaron el hold) y
    reintento cuando la pasarela falló en la cancelación: una reserva
    cancelada jamás debe seguir reteniendo la tarjeta del arrendatario.
    """
    from app.features.bookings.reservations.cancelacion_service import liberar_garantias_colgadas

    cliente, dueno = partes
    colgada = _reserva(db_session, cliente, dueno, estado="cancelada", patente="COLG-01")
    viva = _reserva(db_session, cliente, dueno, estado="confirmada", patente="COLG-02")
    # Misma referencia en ambas: el test distingue por estado del Pago, no por id.
    for p in db_session.query(Pago).filter(Pago.reserva_id == viva.id):
        p.referencia_pago = f"VIVA-{p.tipo}"
    db_session.commit()

    liberadas = liberar_garantias_colgadas(db_session)

    assert liberadas == 1
    assert _pago(db_session, colgada, "hold_reserva").estado == "liberado"
    assert _pago(db_session, viva, "hold_reserva").estado == "retenido"
    assert pasarela["liberar"] == ["1000000001"]
    # El cobro no se toca: si correspondía devolverlo se hizo al cancelar.
    assert _pago(db_session, colgada, "cobro_arriendo").estado == "capturado"


def test_una_pasada_del_barrido_hace_ambas_tareas(partes, db_session, pasarela):
    from app.features.bookings.reservations.cancelacion_service import barrido_reservas

    cliente, dueno = partes
    _reserva(db_session, cliente, dueno, estado="pendiente_pago", con_pagos=False,
             expira_en=_ahora() - timedelta(minutes=1), patente="PAS-001")
    _reserva(db_session, cliente, dueno, estado="cancelada", patente="PAS-002")

    resumen = barrido_reservas(db_session)
    assert resumen["expiradas"] == 1
    assert resumen["garantias_liberadas"] == 1
    assert resumen["confirmaciones_vencidas"] == 0
    assert resumen["recordatorios"] == {"confirmacion": 0, "aviso_previo_multa": 0}
    assert resumen["no_presentaciones"] == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    assert "error" not in resumen.values()
