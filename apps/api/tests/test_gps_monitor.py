"""
Vigilancia de señal GPS del celular del arrendatario durante el arriendo:
30 min sin reportar -> aviso preventivo al dueño; 60 min -> alerta crítica +
multa `gps_sin_senal` (ver gps_monitor_service.py).
"""
from datetime import datetime, timedelta, timezone

from app.features.bookings.reservations import gps_monitor_service as gm
from app.models.entities import Auto, Notificacion, Pago, Reserva


def _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=None, gps_consentimiento=True):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    ahora = datetime.now(timezone.utc)
    posicion = None
    if minutos_sin_senal is not None:
        ts = ahora - timedelta(minutes=minutos_sin_senal)
        posicion = {"latitud": -37.47, "longitud": -72.35, "timestamp": ts.isoformat()}

    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022,
        patente="GPSM-01", tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles",
        gps_consentimiento=gps_consentimiento, gps_ultima_posicion=posicion,
    )
    db_session.add(auto)
    db_session.flush()

    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=ahora - timedelta(hours=2), fecha_fin=ahora + timedelta(hours=2),
        estado="en_curso", monto_cobro=40000, monto_hold=250000,
        lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    return reserva, auto, dueno, cliente


def test_sin_reporte_nunca_no_hay_nada_que_vigilar(db_session, usuario_factory):
    reserva, *_ = _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=None)
    conteos = gm.revisar_reservas_en_curso(db_session)
    assert conteos == {"alertas_30m": 0, "alertas_60m": 0}
    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is False


def test_menos_de_30_min_no_alerta(db_session, usuario_factory):
    _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=10)
    conteos = gm.revisar_reservas_en_curso(db_session)
    assert conteos == {"alertas_30m": 0, "alertas_60m": 0}


def test_alerta_preventiva_a_los_30_minutos(db_session, usuario_factory):
    reserva, auto, dueno, _cliente = _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=35)

    conteos = gm.revisar_reservas_en_curso(db_session)
    assert conteos == {"alertas_30m": 1, "alertas_60m": 0}

    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is True
    assert reserva.gps_alerta_60m_enviada is False
    # Todavía no se penaliza a los 30 min.
    assert (reserva.cargo_falta_grave_clp or 0) == 0

    notif = db_session.query(Notificacion).filter_by(usuario_id=dueno.id, tipo="gps").first()
    assert notif is not None
    assert "30" in notif.mensaje or "35" in notif.mensaje


def test_no_repite_la_alerta_preventiva_en_la_siguiente_pasada(db_session, usuario_factory):
    _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=40)
    gm.revisar_reservas_en_curso(db_session)
    conteos_2 = gm.revisar_reservas_en_curso(db_session)
    assert conteos_2 == {"alertas_30m": 0, "alertas_60m": 0}


def test_alerta_critica_a_los_60_minutos_aplica_multa(db_session, usuario_factory):
    reserva, auto, dueno, cliente = _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=75)

    conteos = gm.revisar_reservas_en_curso(db_session)
    assert conteos == {"alertas_30m": 0, "alertas_60m": 1}

    db_session.refresh(reserva)
    assert reserva.gps_alerta_60m_enviada is True
    assert reserva.cargo_falta_grave_clp == 20000
    assert reserva.cargos_adicionales_clp == 20000
    # No se le liquida nada al dueño todavía: el cargo se cobra de la garantía al devolver el auto.
    assert (reserva.monto_cobro_final or 0) == 0
    assert (reserva.liquidacion_dueno_clp or 0) == 0
    assert reserva.multas_detalle[-1]["tipo"] == "gps_sin_senal"
    assert "gps_sin_senal" in (reserva.motivo_multas or "") or "Pérdida de señal" in reserva.motivo_multas

    pago = db_session.query(Pago).filter_by(reserva_id=reserva.id, tipo="cargo_gps_sin_senal").first()
    assert pago is not None
    assert pago.monto == 20000
    assert pago.usuario_id == cliente.id
    assert pago.estado == "pendiente"
    assert not pago.referencia_pago

    # Avisa a las dos partes.
    assert db_session.query(Notificacion).filter_by(usuario_id=dueno.id, tipo="gps").count() == 1
    assert db_session.query(Notificacion).filter_by(usuario_id=cliente.id, tipo="gps").count() == 1


def test_no_duplica_el_cargo_en_la_siguiente_pasada(db_session, usuario_factory):
    _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=90)
    gm.revisar_reservas_en_curso(db_session)
    gm.revisar_reservas_en_curso(db_session)
    assert Reserva  # noop, solo para claridad del intent
    pagos = db_session.query(Pago).filter_by(tipo="cargo_gps_sin_senal").count()
    assert pagos == 1


def test_sin_consentimiento_gps_no_se_vigila(db_session, usuario_factory):
    reserva, *_ = _reserva_en_curso(
        db_session, usuario_factory, minutos_sin_senal=90, gps_consentimiento=False
    )
    conteos = gm.revisar_reservas_en_curso(db_session)
    assert conteos == {"alertas_30m": 0, "alertas_60m": 0}
    db_session.refresh(reserva)
    assert (reserva.cargo_falta_grave_clp or 0) == 0


def test_senal_recuperada_resetea_flags_para_re_alertar(db_session, usuario_factory):
    reserva, auto, *_ = _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=40)
    gm.revisar_reservas_en_curso(db_session)
    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is True

    # El celular vuelve a reportar.
    auto.gps_ultima_posicion = {
        "latitud": -37.47, "longitud": -72.35,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    db_session.commit()

    gm.revisar_reservas_en_curso(db_session)
    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is False


def test_endpoint_de_telemetria_resetea_los_flags(db_session, usuario_factory, auth_as):
    reserva, auto, dueno, cliente = _reserva_en_curso(db_session, usuario_factory, minutos_sin_senal=40)
    gm.revisar_reservas_en_curso(db_session)
    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is True

    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/telemetria",
        json={"latitud": -37.47, "longitud": -72.35},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True

    db_session.refresh(reserva)
    assert reserva.gps_alerta_30m_enviada is False
    assert reserva.gps_alerta_60m_enviada is False
