"""
Política de reservas pedida por el cliente (2026-09-20):

  1. El dueño tiene 24 h para confirmar la reserva. Si no lo hace, se avisa al conductor y la
     reserva se cancela (con todo devuelto: la culpa no es del arrendatario).
  2. Si la reserva quedó confirmada y el arrendatario no se presenta, se le aplica una multa y esa
     multa va para el dueño.

Antes el pago dejaba la reserva en `confirmada` de inmediato: el dueño nunca tenía que aceptar.
Ahora el pago la deja en `pendiente` (pagada, esperando al dueño) con un plazo, y solo el dueño
(o un admin) la pasa a `confirmada`.

Supuestos que el cliente debe validar (viven como constantes en `confirmacion_service`):
  · plazo de confirmación: 24 h (acotado por la hora de inicio del arriendo);
  · hora de gracia para dar por ausente al arrendatario: 2 h desde el inicio;
  · multa: un día de arriendo, descontada de lo ya cobrado; el 100 % va al dueño (sin comisión).
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.features.bookings.reservations import cancelacion_service, confirmacion_service
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Notificacion, Pago, Reserva

MONTO_COBRO = 90000  # 3 días × 30.000
MONTO_HOLD = 250000


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fecha(dias):
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")


def _auto(db_session, dueno, patente="PLKA-01"):
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
    db_session, cliente, dueno, estado="pendiente", horas_para_inicio=72, dias=3,
    confirmar_antes_de="auto", cobro_estado="capturado", patente="PLKA-01", con_pagos=True,
):
    """`confirmar_antes_de="auto"` = dentro de 24 h; también acepta un datetime o None."""
    auto = _auto(db_session, dueno, patente=patente)
    inicio = _ahora() + timedelta(hours=horas_para_inicio)
    if confirmar_antes_de == "auto":
        confirmar_antes_de = _ahora() + timedelta(hours=24)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=dias),
        estado=estado, monto_cobro=MONTO_COBRO, monto_hold=MONTO_HOLD,
        confirmar_dueno_antes_de=confirmar_antes_de,
        lugar_entrega_acordado="Plaza de Armas",
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


def _pagos(db_session, reserva, tipo):
    db_session.expire_all()
    return db_session.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo == tipo).all()


def _notificaciones(db_session, usuario):
    db_session.expire_all()
    return db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id).all()


def _texto(notificaciones):
    return " ".join(f"{n.titulo} {n.mensaje}" for n in notificaciones).lower()


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


# ===========================================================================
# 1. El pago deja la reserva esperando al dueño
# ===========================================================================
def _pagar(auth_as, db_session, cliente, dueno, patente="PLKP-11"):
    auto = _auto(db_session, dueno, patente=patente)
    deb = auth_as(cliente).post(
        "/api/v1/usuarios/me/tarjetas",
        json={"card_token": "SIMULADO-DEBITO-4242", "payment_method_id": "visadebito"},
    ).json()["tarjeta"]
    cred = auth_as(cliente).post(
        "/api/v1/usuarios/me/tarjetas",
        json={"card_token": "SIMULADO-CREDITO-1111", "payment_method_id": "visa"},
    ).json()["tarjeta"]
    reserva = auth_as(cliente).post(
        "/api/v1/reservas",
        json={"auto_id": auto.id, "fecha_inicio": _fecha(10), "fecha_fin": _fecha(13),
              "lugar_entrega_acordado": "Plaza de Armas"},
    ).json()
    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    return reserva["id"], resp


def test_pagar_deja_la_reserva_esperando_al_dueno_con_plazo_de_24_horas(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva_id, resp = _pagar(auth_as, db_session, cliente, dueno)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "esperando_dueno"
    assert resp.json()["confirmar_antes_de"]

    db_session.expire_all()
    reserva = db_session.query(Reserva).filter(Reserva.id == reserva_id).one()
    assert reserva.estado == "pendiente"
    faltan = (reserva.confirmar_dueno_antes_de - _ahora()).total_seconds() / 3600
    assert 23.9 < faltan <= 24.0


def test_al_pagar_se_avisa_al_dueno_del_plazo_y_al_arrendatario_de_la_espera(partes, auth_as, db_session):
    cliente, dueno = partes
    _pagar(auth_as, db_session, cliente, dueno, patente="PLKN-22")

    para_dueno = _texto(_notificaciones(db_session, dueno))
    assert "confirm" in para_dueno and "24" in para_dueno
    para_cliente = _texto(_notificaciones(db_session, cliente))
    assert "dueño" in para_cliente and "24" in para_cliente


def test_el_plazo_nunca_pasa_de_la_hora_de_inicio():
    ahora = datetime(2026, 9, 20, 12, 0)

    class R:
        fecha_inicio = datetime(2026, 9, 20, 17, 0)  # dentro de 5 h

    assert confirmacion_service.plazo_de_confirmacion(R, ahora) == datetime(2026, 9, 20, 17, 0)

    class Lejos:
        fecha_inicio = datetime(2026, 10, 30, 12, 0)

    assert confirmacion_service.plazo_de_confirmacion(Lejos, ahora) == ahora + timedelta(hours=24)


def test_un_inicio_inminente_igual_da_al_menos_una_hora_para_confirmar():
    ahora = datetime(2026, 9, 20, 12, 0)

    class R:
        fecha_inicio = datetime(2026, 9, 20, 12, 10)

    assert confirmacion_service.plazo_de_confirmacion(R, ahora) == ahora + timedelta(hours=1)


def test_una_reserva_esperando_al_dueno_sigue_ocupando_el_auto(partes, db_session):
    from app.core.validators import validar_disponibilidad_reserva

    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="pendiente")

    libre = validar_disponibilidad_reserva(
        reserva.auto_id, reserva.fecha_inicio, reserva.fecha_fin, db_session
    )
    assert libre is False


def test_un_resultado_tardio_de_la_pasarela_no_confirma_una_reserva_esperando_al_dueno(partes, db_session):
    from app.features.payments.router import _aplicar_resultado

    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="pendiente", con_pagos=False)
    pago = Pago(reserva_id=reserva.id, usuario_id=cliente.id, tipo="hold_reserva",
                monto=MONTO_HOLD, estado="procesando", referencia_pago="1000000003")
    db_session.add(pago)
    db_session.commit()

    _aplicar_resultado(db_session, pago, {"autorizada": True, "retenido": True, "payment_id": "1000000003"})

    db_session.refresh(reserva)
    assert reserva.estado == "pendiente"  # solo el dueño la confirma


# ===========================================================================
# 2. El dueño confirma (o no)
# ===========================================================================
def test_el_dueno_confirma_y_se_avisa_al_arrendatario(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno)

    resp = auth_as(dueno).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "confirmada"
    assert "confirm" in _texto(_notificaciones(db_session, cliente))


def test_confirmar_despues_del_plazo_se_rechaza(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, confirmar_antes_de=_ahora() - timedelta(minutes=5))

    resp = auth_as(dueno).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code == 409, resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "pendiente"  # la cancela el barrido, con su devolución


def test_el_arrendatario_no_puede_confirmar_su_propia_reserva(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno)

    resp = auth_as(cliente).patch(
        f"/api/v1/reservas/{reserva.id}/estado", params={"nuevo_estado": "confirmada"}
    )

    assert resp.status_code == 403


def test_si_el_dueno_no_confirma_en_plazo_se_cancela_devolviendo_todo(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, confirmar_antes_de=_ahora() - timedelta(minutes=1))

    n = confirmacion_service.expirar_confirmaciones_vencidas(db_session)

    assert n == 1
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert reserva.motivo_cancelacion == "dueno_no_confirmo"
    assert _pagos(db_session, reserva, "hold_reserva")[0].estado == "liberado"
    assert _pagos(db_session, reserva, "cobro_arriendo")[0].estado == "reembolsado"
    assert pasarela["reembolsar"] == [("1000000002", None)]  # reembolso TOTAL


def test_al_vencer_el_plazo_se_avisa_al_conductor_y_al_dueno(partes, db_session, pasarela):
    cliente, dueno = partes
    _reserva(db_session, cliente, dueno, confirmar_antes_de=_ahora() - timedelta(minutes=1))

    confirmacion_service.expirar_confirmaciones_vencidas(db_session)

    para_cliente = _texto(_notificaciones(db_session, cliente))
    assert "no confirm" in para_cliente and "devol" in para_cliente
    assert "no confirm" in _texto(_notificaciones(db_session, dueno))


@pytest.mark.parametrize(
    "estado, plazo",
    [
        ("pendiente", "futuro"),      # aún tiene tiempo
        ("pendiente", None),          # reservas anteriores a la política: sin plazo
        ("confirmada", "vencido"),    # ya confirmada: el plazo no aplica
        ("en_curso", "vencido"),
    ],
)
def test_el_barrido_no_toca_lo_que_no_corresponde(partes, db_session, pasarela, estado, plazo):
    cliente, dueno = partes
    fijado = {"futuro": _ahora() + timedelta(hours=5), "vencido": _ahora() - timedelta(hours=1), None: None}[plazo]
    reserva = _reserva(db_session, cliente, dueno, estado=estado, confirmar_antes_de=fijado)

    assert confirmacion_service.expirar_confirmaciones_vencidas(db_session) == 0
    db_session.refresh(reserva)
    assert reserva.estado == estado
    assert pasarela == {"liberar": [], "reembolsar": []}


def test_el_barrido_general_incluye_las_confirmaciones_vencidas(partes, db_session, pasarela):
    cliente, dueno = partes
    _reserva(db_session, cliente, dueno, confirmar_antes_de=_ahora() - timedelta(minutes=1))

    resultado = cancelacion_service.barrido_reservas(db_session)

    assert resultado["confirmaciones_vencidas"] == 1


def test_una_pasada_repetida_no_cancela_ni_devuelve_dos_veces(partes, db_session, pasarela):
    cliente, dueno = partes
    _reserva(db_session, cliente, dueno, confirmar_antes_de=_ahora() - timedelta(minutes=1))

    assert confirmacion_service.expirar_confirmaciones_vencidas(db_session) == 1
    assert confirmacion_service.expirar_confirmaciones_vencidas(db_session) == 0
    assert len(pasarela["reembolsar"]) == 1


# ===========================================================================
# 3. No presentación: la multa la paga quien confirmó y no llegó
#
# El cliente pidió que fuera simétrica: si el arrendatario no llega, multa para el arrendatario (va al
# dueño); si el dueño no llega, multa para el dueño. Un reloj no sabe quién falló, así que cada parte
# avisa "ya llegué" y el barrido decide con eso (sección 5).
# ===========================================================================
def _no_presentacion(auth_as, usuario, reserva):
    """Reporte manual del arrendatario ausente: solo un admin (el barrido decide solo con los avisos)."""
    return auth_as(usuario).post(f"/api/v1/reservas/{reserva.id}/no-presentacion")


@pytest.fixture
def admin(usuario_factory):
    return usuario_factory(roles_activos=["admin"], estado_documentos="verificado")


def test_el_reporte_manual_es_solo_del_admin(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    # El dueño no puede multar a quien sí llegó: eso lo decide el barrido con los avisos de llegada.
    assert _no_presentacion(auth_as, dueno, reserva).status_code == 403
    assert _no_presentacion(auth_as, cliente, reserva).status_code == 403
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"
    assert _no_presentacion(auth_as, admin, reserva).status_code == 200


def test_la_multa_al_arrendatario_cancela_y_se_cobra(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    # Inició hace 3 h: pasó la hora de gracia.
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    resp = _no_presentacion(auth_as, admin, reserva)

    assert resp.status_code == 200, resp.text
    assert resp.json()["estado"] == "cancelada"
    db_session.refresh(reserva)
    assert reserva.motivo_cancelacion == "no_presentacion"
    multa = reserva.multas_detalle[0]
    assert multa["tipo"] == "no_presentacion"
    assert multa["monto_clp"] == 30000  # un día de arriendo (90.000 / 3)


def test_la_multa_se_descuenta_de_lo_cobrado_y_se_devuelve_el_resto(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    _no_presentacion(auth_as, admin, reserva)

    assert pasarela["reembolsar"] == [("1000000002", 60000)]  # 90.000 − 30.000
    assert pasarela["liberar"] == ["1000000001"]               # la garantía se suelta entera
    assert _pagos(db_session, reserva, "hold_reserva")[0].estado == "liberado"
    reembolso = _pagos(db_session, reserva, "reembolso_parcial")[0]
    assert reembolso.monto == 60000 and reembolso.estado == "reembolsado"
    assert reembolso.usuario_id == cliente.id


def test_la_multa_al_arrendatario_va_completa_al_dueno_como_liquidacion(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    _no_presentacion(auth_as, admin, reserva)

    liquidaciones = _pagos(db_session, reserva, "liquidacion_dueno")
    assert len(liquidaciones) == 1
    assert liquidaciones[0].usuario_id == dueno.id
    assert liquidaciones[0].monto == 30000  # el 100 %, sin comisión
    assert liquidaciones[0].estado == "pendiente"  # la deposita liquidaciones_service


def test_se_avisa_a_ambas_partes_de_la_multa_al_arrendatario(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    _no_presentacion(auth_as, admin, reserva)

    para_cliente = _texto(_notificaciones(db_session, cliente))
    assert "multa" in para_cliente and "30.000" in para_cliente
    assert "no te presentaste" in para_cliente
    para_dueno = _texto(_notificaciones(db_session, dueno))
    assert "multa" in para_dueno and "30.000" in para_dueno


@pytest.mark.parametrize("horas", [-0.5, 5])
def test_no_se_puede_multar_dentro_de_la_gracia_ni_antes_del_inicio(partes, auth_as, db_session, pasarela, admin, horas):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=horas)

    assert _no_presentacion(auth_as, admin, reserva).status_code == 409
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"
    assert pasarela == {"liberar": [], "reembolsar": []}


@pytest.mark.parametrize("estado", ["pendiente", "en_curso", "finalizada", "cancelada"])
def test_solo_una_reserva_confirmada_admite_no_presentacion(partes, auth_as, db_session, pasarela, admin, estado):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado=estado, horas_para_inicio=-3)

    assert _no_presentacion(auth_as, admin, reserva).status_code == 409
    assert pasarela == {"liberar": [], "reembolsar": []}


def test_multar_dos_veces_no_multa_dos_veces(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    assert _no_presentacion(auth_as, admin, reserva).status_code == 200
    assert _no_presentacion(auth_as, admin, reserva).status_code == 409
    assert len(_pagos(db_session, reserva, "liquidacion_dueno")) == 1
    assert len(pasarela["reembolsar"]) == 1


def test_si_lo_cobrado_es_un_dia_la_multa_lo_retiene_todo_y_no_hay_reembolso(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, dias=1)

    resp = _no_presentacion(auth_as, admin, reserva)

    assert resp.status_code == 200, resp.text
    db_session.refresh(reserva)
    assert reserva.multas_detalle[0]["monto_clp"] == MONTO_COBRO  # nunca más que lo cobrado
    assert pasarela["reembolsar"] == []
    assert _pagos(db_session, reserva, "reembolso_parcial") == []
    assert _pagos(db_session, reserva, "liquidacion_dueno")[0].monto == MONTO_COBRO


def test_si_el_cobro_nunca_se_acredito_no_hay_multa_que_cobrar(partes, auth_as, db_session, pasarela, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, cobro_estado="pendiente")

    resp = _no_presentacion(auth_as, admin, reserva)

    assert resp.status_code == 200, resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada"
    assert not reserva.multas_detalle
    assert _pagos(db_session, reserva, "liquidacion_dueno") == []


def test_si_el_reembolso_falla_queda_pendiente_y_visible(partes, auth_as, db_session, monkeypatch, admin):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    monkeypatch.setattr(MercadoPagoService, "liberar_hold", classmethod(lambda cls, p: {"success": True}))
    monkeypatch.setattr(
        MercadoPagoService, "reembolsar", classmethod(lambda cls, p, monto=None: {"success": False, "error": "caído"})
    )

    resp = _no_presentacion(auth_as, admin, reserva)

    assert resp.status_code == 200, resp.text  # la reserva se cancela igual
    reembolso = _pagos(db_session, reserva, "reembolso_parcial")[0]
    assert reembolso.estado == "pendiente"  # soporte lo ve y lo reintenta
    assert reembolso.monto == 60000


# ===========================================================================
# 4. "Ya llegué": la señal que permite decidir quién no se presentó
# ===========================================================================
def _llegada(auth_as, usuario, reserva):
    return auth_as(usuario).post(f"/api/v1/reservas/{reserva.id}/llegada")


def test_cada_parte_avisa_que_llego_y_la_otra_se_entera(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-0.2)

    r1 = _llegada(auth_as, cliente, reserva)
    assert r1.status_code == 200, r1.text
    assert r1.json()["llegada_cliente_en"] and r1.json()["llegada_dueno_en"] is None
    assert "llegó" in _texto(_notificaciones(db_session, dueno))

    r2 = _llegada(auth_as, dueno, reserva)
    assert r2.status_code == 200, r2.text
    assert r2.json()["llegada_dueno_en"]
    assert "llegó" in _texto(_notificaciones(db_session, cliente))


def test_avisar_dos_veces_no_cambia_la_hora_ni_vuelve_a_notificar(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-0.2)

    primera = _llegada(auth_as, cliente, reserva).json()["llegada_cliente_en"]
    segunda = _llegada(auth_as, cliente, reserva)

    assert segunda.status_code == 200
    assert segunda.json()["llegada_cliente_en"] == primera
    avisos = [n for n in _notificaciones(db_session, dueno) if "llegó" in f"{n.titulo} {n.mensaje}".lower()]
    assert len(avisos) == 1


def test_no_se_puede_avisar_la_llegada_con_horas_de_anticipacion(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=6)

    assert _llegada(auth_as, cliente, reserva).status_code == 409


def test_se_puede_avisar_un_poco_antes_de_la_hora(partes, auth_as, db_session):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=1)

    assert _llegada(auth_as, dueno, reserva).status_code == 200


@pytest.mark.parametrize("estado", ["pendiente", "en_curso", "finalizada", "cancelada"])
def test_solo_una_reserva_confirmada_admite_aviso_de_llegada(partes, auth_as, db_session, estado):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado=estado, horas_para_inicio=-0.2)

    assert _llegada(auth_as, cliente, reserva).status_code == 409


def test_un_tercero_no_puede_avisar_la_llegada(partes, auth_as, db_session, usuario_factory):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-0.2)
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    assert _llegada(auth_as, intruso, reserva).status_code == 403
    db_session.refresh(reserva)
    assert reserva.llegada_cliente_en is None and reserva.llegada_dueno_en is None


# ===========================================================================
# 5. Barrido automático: decide con los avisos de llegada
# ===========================================================================
def _con_llegadas(db_session, reserva, cliente=False, dueno=False):
    ahora = _ahora()
    reserva.llegada_cliente_en = ahora - timedelta(hours=2) if cliente else None
    reserva.llegada_dueno_en = ahora - timedelta(hours=2) if dueno else None
    db_session.commit()
    return reserva


def _barrer(db_session):
    return confirmacion_service.resolver_no_presentaciones(db_session)


def test_llega_el_dueno_y_no_el_arrendatario_se_multa_al_arrendatario(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    _con_llegadas(db_session, reserva, dueno=True)

    resultado = _barrer(db_session)

    assert resultado == {"arrendatario": 1, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada" and reserva.motivo_cancelacion == "no_presentacion"
    assert _pagos(db_session, reserva, "liquidacion_dueno")[0].monto == 30000
    assert pasarela["reembolsar"] == [("1000000002", 60000)]


def test_llega_el_arrendatario_y_no_el_dueno_se_multa_al_dueno_y_se_devuelve_todo(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    _con_llegadas(db_session, reserva, cliente=True)

    resultado = _barrer(db_session)

    assert resultado == {"arrendatario": 0, "dueno": 1, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada" and reserva.motivo_cancelacion == "dueno_no_presentacion"
    # El arrendatario recupera TODO: la falla es del dueño.
    assert pasarela["reembolsar"] == [("1000000002", None)]
    assert pasarela["liberar"] == ["1000000001"]
    assert _pagos(db_session, reserva, "cobro_arriendo")[0].estado == "reembolsado"
    assert _pagos(db_session, reserva, "hold_reserva")[0].estado == "liberado"
    # Y la multa queda como deuda del dueño: no se le paga nada por esta reserva.
    multa = _pagos(db_session, reserva, "multa_dueno")
    assert len(multa) == 1
    assert multa[0].usuario_id == dueno.id and multa[0].monto == 30000 and multa[0].estado == "pendiente"
    assert _pagos(db_session, reserva, "liquidacion_dueno") == []
    assert reserva.multas_detalle[0]["tipo"] == "no_presentacion_dueno"


def test_los_avisos_de_la_multa_al_dueno(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    _con_llegadas(db_session, reserva, cliente=True)

    _barrer(db_session)

    para_dueno = _texto(_notificaciones(db_session, dueno))
    assert "no te presentaste" in para_dueno and "multa" in para_dueno and "30.000" in para_dueno
    para_cliente = _texto(_notificaciones(db_session, cliente))
    assert "dueño no se presentó" in para_cliente and "devolvimos" in para_cliente


def test_si_no_llega_ninguno_se_cancela_devolviendo_todo_sin_multas(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    resultado = _barrer(db_session)

    assert resultado == {"arrendatario": 0, "dueno": 0, "ninguno": 1}
    db_session.refresh(reserva)
    assert reserva.estado == "cancelada" and reserva.motivo_cancelacion == "ninguno_se_presento"
    assert pasarela["reembolsar"] == [("1000000002", None)]
    assert pasarela["liberar"] == ["1000000001"]
    assert not reserva.multas_detalle
    assert _pagos(db_session, reserva, "multa_dueno") == []
    assert _pagos(db_session, reserva, "liquidacion_dueno") == []
    assert "nadie se presentó" in _texto(_notificaciones(db_session, cliente))
    assert "nadie se presentó" in _texto(_notificaciones(db_session, dueno))


def test_si_llegaron_los_dos_no_se_toca(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    _con_llegadas(db_session, reserva, cliente=True, dueno=True)

    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"
    assert pasarela == {"liberar": [], "reembolsar": []}


def test_dentro_de_la_hora_de_gracia_no_se_decide_nada(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-1)
    _con_llegadas(db_session, reserva, dueno=True)

    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"


def test_si_la_entrega_ya_empezo_no_se_multa_a_nadie(partes, db_session, pasarela):
    """Un QR escaneado o un checklist iniciado prueba que hubo encuentro, aunque nadie avisara."""
    from app.models.entities import ChecklistAuto, VerificacionEntrega

    cliente, dueno = partes
    con_qr = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, patente="PLKB-02")
    con_checklist = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, patente="PLKC-03")
    _con_llegadas(db_session, con_qr, dueno=True)
    _con_llegadas(db_session, con_checklist, dueno=True)
    db_session.add_all([
        VerificacionEntrega(reserva_id=con_qr.id, tipo="entrega", resultado="rechazada",
                            dueno_id_que_verifica=dueno.id),
        ChecklistAuto(reserva_id=con_checklist.id, tipo="antes", fotos=[], kilometraje=1000,
                      nivel_combustible="lleno", estado_limpieza="limpio"),
    ])
    db_session.commit()

    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    assert pasarela == {"liberar": [], "reembolsar": []}


def test_las_reservas_anteriores_a_la_politica_no_se_tocan(partes, db_session, pasarela):
    """Sin `confirmar_dueno_antes_de` la reserva es de antes: nadie pudo avisar su llegada."""
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-72, confirmar_antes_de=None)

    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"
    assert pasarela == {"liberar": [], "reembolsar": []}


@pytest.mark.parametrize("estado", ["pendiente", "en_curso", "finalizada", "cancelada"])
def test_el_barrido_solo_mira_reservas_confirmadas(partes, db_session, pasarela, estado):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado=estado, horas_para_inicio=-3)

    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    db_session.refresh(reserva)
    assert reserva.estado == estado


def test_una_segunda_pasada_no_repite_multas_ni_reembolsos(partes, db_session, pasarela):
    cliente, dueno = partes
    reserva = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)
    _con_llegadas(db_session, reserva, cliente=True)

    _barrer(db_session)
    assert _barrer(db_session) == {"arrendatario": 0, "dueno": 0, "ninguno": 0}
    assert len(_pagos(db_session, reserva, "multa_dueno")) == 1
    assert len(pasarela["reembolsar"]) == 1


def test_un_error_en_una_reserva_no_frena_a_las_demas(partes, db_session, pasarela, monkeypatch):
    cliente, dueno = partes
    mala = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, patente="PLKD-04")
    buena = _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3, patente="PLKE-05")
    _con_llegadas(db_session, mala, dueno=True)
    _con_llegadas(db_session, buena, dueno=True)
    original = confirmacion_service.registrar_no_presentacion
    fallo_id = mala.id

    def a_veces_falla(db, reserva, *a, **k):
        if reserva.id == fallo_id:
            raise RuntimeError("falla simulada")
        return original(db, reserva, *a, **k)

    monkeypatch.setattr(confirmacion_service, "registrar_no_presentacion", a_veces_falla)

    resultado = _barrer(db_session)

    assert resultado["arrendatario"] == 1
    db_session.expire_all()
    assert db_session.get(Reserva, buena.id).estado == "cancelada"
    assert db_session.get(Reserva, mala.id).estado == "confirmada"  # se reintenta en la próxima pasada


def test_el_barrido_general_incluye_las_no_presentaciones(partes, db_session, pasarela):
    cliente, dueno = partes
    _reserva(db_session, cliente, dueno, estado="confirmada", horas_para_inicio=-3)

    resultado = cancelacion_service.barrido_reservas(db_session)

    assert resultado["no_presentaciones"] == {"arrendatario": 0, "dueno": 0, "ninguno": 1}


def test_el_bucle_no_loguea_pasadas_sin_trabajo_aunque_haya_dicts_anidados():
    from app.features.bookings.reservations.cancelacion_loop import _hubo_trabajo

    sin_nada = {"expiradas": 0, "no_presentaciones": {"arrendatario": 0, "dueno": 0, "ninguno": 0}}
    con_algo = {"expiradas": 0, "no_presentaciones": {"arrendatario": 0, "dueno": 1, "ninguno": 0}}

    assert _hubo_trabajo(sin_nada) is False
    assert _hubo_trabajo(con_algo) is True
