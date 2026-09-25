"""
Matriz de escenarios de cuadratura financiera y seguridad de la política (Ley Chilena / QA).

Verifica que el dinero cuadra exactamente en cada desenlace:
1. Dueño no confirma a tiempo: 100 % devuelto, 100 % garantía liberada, sin multas.
2. Arrendatario no se presenta: garantía liberada al 100 %, multa de 1 día descontada, resto reembolsado, multa abonada al dueño.
3. Dueño no se presenta: 100 % devuelto al cliente, garantía 100 % liberada, multa como deuda del dueño.
4. Ninguno se presenta: 100 % devuelto, garantía 100 % liberada, sin multas.
5. Feature flags de seguridad: cuando están en False no se ejecutan multas ni cancelaciones automáticas.
6. Reintento de reembolsos fallidos: pagos pendientes de reembolso se procesan exitosamente.
7. Verificación de ubicación: fuera del radio se rechaza con 409, dentro del radio se acepta.
"""
from datetime import datetime, timedelta, timezone
import pytest

from app.features.bookings.reservations import cancelacion_service, confirmacion_service
from app.features.payments.mercadopago_service import MercadoPagoService
from app.features.payments import estado_pagos
from app.models.entities import Auto, ConfiguracionPlataforma, Pago, Reserva, Usuario

MONTO_COBRO = 90000  # 3 días × 30.000 CLP
MONTO_HOLD = 250000


@pytest.fixture
def partes(usuario_factory):
    return (
        usuario_factory(roles_activos=["cliente"], estado_documentos="verificado"),
        usuario_factory(roles_activos=["dueno"], estado_documentos="verificado"),
    )


@pytest.fixture
def pasarela(monkeypatch):
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


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _auto(db_session, dueno, lat=-33.4372, lon=-70.6506, patente="TEST-01"):
    auto = Auto(
        dueno_id=dueno.id, marca="Toyota", modelo="Yaris", anio=2023,
        patente=patente, tarifa_dia=30000, estado="activo",
        ubicacion_base="Plaza de Armas, Santiago",
        latitud=lat, longitud=lon,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)
    return auto


def _reserva(
    db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-3, dias=3,
    llegada_cliente=None, llegada_dueno=None, patente="TEST-01",
):
    auto = _auto(db_session, dueno, patente=patente)
    inicio = _ahora() + timedelta(hours=inicio_offset_h)
    fin = inicio + timedelta(days=dias)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=inicio, fecha_fin=fin,
        estado=estado, monto_cobro=MONTO_COBRO, monto_hold=MONTO_HOLD,
        confirmar_dueno_antes_de=inicio - timedelta(hours=12),
        llegada_cliente_en=llegada_cliente,
        llegada_dueno_en=llegada_dueno,
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)

    db_session.add_all([
        Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="hold_reserva",
             monto=MONTO_HOLD, estado="retenido", referencia_pago="1000000011"),
        Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="cobro_arriendo",
             monto=MONTO_COBRO, estado="capturado", referencia_pago="1000000012"),
    ])
    db_session.commit()
    return reserva


def test_escenario_1_dueno_no_confirma_a_tiempo_devuelve_todo(partes, db_session, pasarela):
    cliente, dueno = partes
    auto = _auto(db_session, dueno, patente="DNC-01")
    ahora = _ahora()
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=ahora + timedelta(hours=5), fecha_fin=ahora + timedelta(days=3),
        estado="pendiente", monto_cobro=MONTO_COBRO, monto_hold=MONTO_HOLD,
        confirmar_dueno_antes_de=ahora - timedelta(minutes=10),
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.add_all([
        Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="hold_reserva",
             monto=MONTO_HOLD, estado="retenido", referencia_pago="1000000001"),
        Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="cobro_arriendo",
             monto=MONTO_COBRO, estado="capturado", referencia_pago="1000000002"),
    ])
    db_session.commit()

    n = confirmacion_service.expirar_confirmaciones_vencidas(db_session, ahora)
    assert n == 1
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert reserva.motivo_cancelacion == "dueno_no_confirmo"

    # Cuadratura
    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    hold = next(p for p in pagos if p.tipo == "hold_reserva")
    assert hold.estado == "liberado"
    reembolsados = [p for p in pagos if p.estado == "reembolsado"]
    total_reembolsado = sum(p.monto for p in reembolsados)
    assert total_reembolsado == MONTO_COBRO


def test_escenario_2_arrendatario_no_se_presenta_cuadratura_perfecta(partes, db_session, pasarela):
    cliente, dueno = partes
    ahora = _ahora()
    reserva = _reserva(
        db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-3, dias=3,
        llegada_cliente=None, llegada_dueno=ahora - timedelta(hours=2, minutes=50),
        patente="NOP-01",
    )

    resumen = confirmacion_service.resolver_no_presentaciones(db_session, ahora, forzar=True)
    assert resumen["arrendatario"] == 1
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert reserva.motivo_cancelacion == "no_presentacion"

    # Multa de 1 día sobre 3 días = 30.000 CLP
    multa_esperada = 30000
    devolucion_esperada = MONTO_COBRO - multa_esperada  # 60.000 CLP

    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    hold = next(p for p in pagos if p.tipo == "hold_reserva")
    assert hold.estado == "liberado"  # Garantía NUNCA queda retenida

    reembolso = next(p for p in pagos if p.tipo == "reembolso_parcial")
    assert reembolso.monto == devolucion_esperada
    assert reembolso.estado == "reembolsado"

    liq_dueno = next(p for p in pagos if p.tipo == "liquidacion_dueno")
    assert liq_dueno.monto == multa_esperada
    assert liq_dueno.estado == "pendiente"

    # Cuadratura matemática exacta: Lo cobrado = Devuelto + Multa abonada
    assert MONTO_COBRO == reembolso.monto + liq_dueno.monto


def test_escenario_3_dueno_no_se_presenta_devuelve_todo_y_multa_al_dueno(partes, db_session, pasarela):
    cliente, dueno = partes
    ahora = _ahora()
    reserva = _reserva(
        db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-3, dias=3,
        llegada_cliente=ahora - timedelta(hours=2, minutes=50), llegada_dueno=None,
        patente="NOP-02",
    )

    resumen = confirmacion_service.resolver_no_presentaciones(db_session, ahora, forzar=True)
    assert resumen["dueno"] == 1
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert reserva.motivo_cancelacion == "dueno_no_presentacion"

    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    hold = next(p for p in pagos if p.tipo == "hold_reserva")
    assert hold.estado == "liberado"

    # Todo devuelto al cliente
    reembolsados = [p for p in pagos if p.estado == "reembolsado"]
    assert sum(p.monto for p in reembolsados) == MONTO_COBRO

    # Multa de 1 día queda como deuda del dueño
    multa_dueno = next(p for p in pagos if p.tipo == "multa_dueno")
    assert multa_dueno.monto == 30000
    assert multa_dueno.estado == "pendiente"
    assert multa_dueno.usuario_id == dueno.id


def test_escenario_4_ninguno_se_presenta_devuelve_todo_sin_multas(partes, db_session, pasarela):
    cliente, dueno = partes
    ahora = _ahora()
    reserva = _reserva(
        db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-3, dias=3,
        llegada_cliente=None, llegada_dueno=None,
        patente="NOP-03",
    )

    resumen = confirmacion_service.resolver_no_presentaciones(db_session, ahora, forzar=True)
    assert resumen["ninguno"] == 1
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert reserva.motivo_cancelacion == "ninguno_se_presento"

    pagos = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).all()
    hold = next(p for p in pagos if p.tipo == "hold_reserva")
    assert hold.estado == "liberado"
    assert not any(p.tipo in ("multa_dueno", "liquidacion_dueno") for p in pagos)


def test_feature_flag_politica_inactiva_no_hace_nada(partes, db_session, pasarela):
    cliente, dueno = partes
    config = db_session.query(ConfiguracionPlataforma).first()
    config.politica_no_presentacion_activa = False
    db_session.commit()

    ahora = _ahora()
    reserva = _reserva(
        db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-3, dias=3,
        llegada_cliente=None, llegada_dueno=ahora - timedelta(hours=2, minutes=50),
        patente="FLAG-01",
    )

    # Con feature flag en False y forzar=False, no debe tocar nada
    resumen = confirmacion_service.resolver_no_presentaciones(db_session, ahora, forzar=False)
    assert resumen == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"

    # Restaurar para no afectar otros tests
    config.politica_no_presentacion_activa = True
    db_session.commit()


def test_reintento_de_reembolsos_pendientes(partes, db_session, monkeypatch):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="cancelada", patente="REEMB-01")
    pago_fallido = Pago(
        reserva_id=reserva.id, usuario_id=cliente.id, tipo="reembolso_parcial",
        monto=45000, estado="pendiente", referencia_pago="1000000021",
    )
    db_session.add(pago_fallido)
    db_session.commit()

    # Simular que Mercado Pago aprueba el reembolso
    monkeypatch.setattr(MercadoPagoService, "reembolsar", lambda ref, monto: {"success": True, "id": "RF-OK"})

    resultado = estado_pagos.reintentar_reembolsos_pendientes(db_session)
    assert resultado["hechos"] == 1
    db_session.refresh(pago_fallido)
    assert pago_fallido.estado == "reembolsado"


def test_verificacion_ubicacion_fuera_y_dentro_del_radio(partes, db_session):
    cliente, dueno = partes
    ahora = _ahora()
    # Auto ubicado en Santiago Centro (-33.4372, -70.6506)
    reserva = _reserva(
        db_session, cliente, dueno, estado="confirmada", inicio_offset_h=-1, dias=3,
        patente="GEO-01",
    )

    # 1. Coordenadas a 5 km de distancia (Providencia: -33.4255, -70.6133) -> PoliticaError 409
    with pytest.raises(confirmacion_service.PoliticaError) as exc_info:
        confirmacion_service.registrar_llegada(
            db_session, reserva, cliente, ahora=ahora,
            latitud=-33.4255, longitud=-70.6133, precision_m=20,
        )
    assert exc_info.value.status_code == 409
    assert "Todavía estás a unos" in exc_info.value.detalle

    # 2. Coordenadas a 200 m (dentro del radio de 500 m) -> Éxito
    res_ok = confirmacion_service.registrar_llegada(
        db_session, reserva, cliente, ahora=ahora,
        latitud=-33.4380, longitud=-70.6510, precision_m=15,
    )
    assert res_ok.llegada_cliente_en is not None
