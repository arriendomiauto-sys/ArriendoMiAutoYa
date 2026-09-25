"""
Cobro real de los cargos del arriendo (BUG-023, 024, 033 y 034).

Decisión de negocio (2026-09-20): lo que se cobra por combustible, kilómetros,
limpieza, atraso, multas y penalización GPS es **del dueño** (100 %, sin
comisión). Se le cobra al arrendatario así:

  · Cargos ligados al arriendo (devolución, multas, GPS) -> se descuentan de la
    **garantía**: una sola captura parcial al devolver, con tope en el monto de
    la garantía; el resto de la garantía se libera. Nada de esto se cobra
    "aparte" a una tarjeta sin que el arrendatario lo haya aceptado.
  · Extensión del arriendo -> **cobro aparte** al momento de extender, a la
    tarjeta del cobro; si el banco lo rechaza, no se extiende.
  · Cobro posterior (peaje, TAG, multa de tránsito) -> tarjeta de crédito, con
    tope en la garantía, y lo cobrado se le abona al dueño.

Al dueño solo se le liquida lo que efectivamente se cobró.
"""
from datetime import datetime, timedelta

import pytest

from app.features.bookings.reservations import gps_monitor_service
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Pago, Reserva, Tarjeta


def _fecha(dias):
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")


@pytest.fixture(autouse=True)
def sin_pasarela_real(monkeypatch):
    def prohibido(*a, **k):
        raise AssertionError("se intentó llamar a Mercado Pago de verdad en un test simulado")

    monkeypatch.setattr(MercadoPagoService, "_pedir", classmethod(lambda cls, *a, **k: prohibido()))


def _tarjeta(auth_as, usuario, token):
    r = auth_as(usuario).post("/api/v1/usuarios/me/tarjetas", json={"card_token": token, "payment_method_id": "visa"})
    assert r.status_code == 201, r.text
    return r.json()["tarjeta"]


@pytest.fixture
def escenario(usuario_factory, auth_as, db_session):
    """Reserva de 3 días ($20.000/día) pagada y confirmada por el dueño. Garantía: $250.000."""
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="KLPW-88",
        tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    debito = _tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242")
    credito = _tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111")

    reserva = auth_as(cliente).post(
        "/api/v1/reservas",
        json={"auto_id": auto.id, "fecha_inicio": _fecha(2), "fecha_fin": _fecha(5),
              "lugar_entrega_acordado": "Plaza de Armas"},
    ).json()
    rid = reserva["id"]
    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{rid}/pagar", json={"tarjeta_cobro_id": debito["id"], "tarjeta_garantia_id": credito["id"]}
    )
    assert pago.status_code == 200, pago.text
    conf = auth_as(dueno).patch(f"/api/v1/reservas/{rid}/estado", params={"nuevo_estado": "confirmada"})
    assert conf.status_code == 200, conf.text
    return {"dueno": dueno, "cliente": cliente, "auto": auto, "rid": rid, "debito": debito, "credito": credito}


def _entregar(auth_as, esc):
    rid = esc["rid"]
    qr = auth_as(esc["cliente"]).post(f"/api/v1/reservas/{rid}/generar-codigo").json()["codigo_qr_hash"]
    auth_as(esc["dueno"]).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr})
    auth_as(esc["dueno"]).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": "entrega"})
    # Ya juntos y con las fotos: el dueño firma con su huella; el arrendatario, con el trazo del checklist.
    assert auth_as(esc["dueno"]).post(
        f"/api/v1/reservas/{rid}/firmar-contrato", json={"metodo": "huella", "acepta_terminos": True}
    ).status_code == 200
    r = auth_as(esc["dueno"]).post(
        f"/api/v1/entrega/{rid}/checklist",
        json={"tipo": "antes", "fotos": ["https://ej.com/1.jpg", "https://ej.com/2.jpg"], "kilometraje": 25000,
              "nivel_combustible": "lleno", "notas": "Impecable.", "firma_svg": "M1 1L2 2"},
    )
    assert r.status_code == 200, r.text


def _devolver(auth_as, esc, combustible="lleno", limpieza="limpio", cargo_limpieza_clp=None):
    # Al devolver también se encuentran: QR del arrendatario e identidad verificada.
    rid = esc["rid"]
    qr = auth_as(esc["cliente"]).post(f"/api/v1/reservas/{rid}/generar-codigo").json()["codigo_qr_hash"]
    auth_as(esc["dueno"]).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr})
    auth_as(esc["dueno"]).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": "devolucion"})
    cuerpo = {"tipo": "despues", "fotos": ["https://ej.com/final.jpg"], "kilometraje": 25400,
              "nivel_combustible": combustible, "estado_limpieza": limpieza, "notas": "Devuelto."}
    if cargo_limpieza_clp is not None:
        cuerpo["cargo_limpieza_clp"] = cargo_limpieza_clp
    r = auth_as(esc["dueno"]).post(f"/api/v1/entrega/{esc['rid']}/checklist", json=cuerpo)
    assert r.status_code == 200, r.text
    return r.json()


def _pagos(db_session, rid, tipo):
    db_session.expire_all()
    return db_session.query(Pago).filter(Pago.reserva_id == rid, Pago.tipo == tipo).all()


def _uno(db_session, rid, tipo):
    filas = _pagos(db_session, rid, tipo)
    assert len(filas) == 1, f"se esperaba un Pago '{tipo}' y hay {len(filas)}"
    return filas[0]


# Combustible lleno -> 1/2 son 2 cuartos ($30.000) y sucio_estandar suma $15.000.
EXTRAS = 45000
BASE_DUENO = 51000  # 85 % de 3 días × $20.000


# ------------------------------------------------------------------ devolución
def test_la_devolucion_descuenta_los_extras_de_la_garantia(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    assert hold.estado == "capturado"
    assert hold.monto == EXTRAS, "el Pago de la garantía queda con lo que se capturó, no con lo que se retuvo"


def test_al_dueno_se_le_liquida_su_base_mas_lo_cobrado(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    resp = _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    liquidacion = _uno(db_session, escenario["rid"], "liquidacion_dueno")
    assert liquidacion.monto == BASE_DUENO + EXTRAS
    assert resp["liquidacion_dueno"] == BASE_DUENO + EXTRAS


def test_ya_no_se_inventa_un_cobro_final_capturado(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    assert _pagos(db_session, escenario["rid"], "cobro_final") == []


def test_sin_extras_se_libera_toda_la_garantia(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario)

    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    assert hold.estado == "liberado"
    assert _uno(db_session, escenario["rid"], "liquidacion_dueno").monto == BASE_DUENO


def test_en_produccion_se_captura_solo_el_monto_de_los_extras(escenario, auth_as, db_session, monkeypatch):
    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    hold.referencia_pago = "987654321"  # id de un pago real de Mercado Pago
    db_session.commit()

    capturas = []
    ok = {"success": True, "autorizada": True, "capturado": True, "estado": "approved", "payment_id": "987654321"}
    monkeypatch.setattr(
        MercadoPagoService, "capturar_pago",
        classmethod(lambda cls, payment_id, monto=None: capturas.append((payment_id, monto)) or ok),
    )

    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    assert capturas == [("987654321", EXTRAS)]


def test_los_cargos_mayores_a_la_garantia_se_cobran_solo_hasta_el_tope(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    assert _multa(auth_as, escenario, monto=240000).status_code == 200  # cabe: la garantía es de $250.000
    resp = _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")  # + $45.000 de extras

    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    assert hold.monto == 250000, "se cobra hasta el monto de la garantía y no más"
    assert _uno(db_session, escenario["rid"], "liquidacion_dueno").monto == BASE_DUENO + 250000
    assert resp["liquidacion_dueno"] == BASE_DUENO + 250000
    # Los extras van primero; la multa queda cobrada a medias y el resto sin cobrar.
    partes = {(p.estado, p.monto) for p in _pagos(db_session, escenario["rid"], "cargo_fumar")}
    assert partes == {("capturado", 205000), ("fallido", 35000)}


def test_si_la_pasarela_no_captura_no_se_le_paga_al_dueno_lo_que_no_se_cobro(escenario, auth_as, db_session, monkeypatch):
    from app.features.payments import cargos_service

    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    hold.referencia_pago = "987654321"
    db_session.commit()
    monkeypatch.setattr(
        MercadoPagoService, "capturar_pago",
        classmethod(lambda cls, payment_id, monto=None: {"success": False, "error": "timeout"}),
    )
    monkeypatch.setattr(
        MercadoPagoService, "liberar_hold",
        classmethod(lambda cls, payment_id: pytest.fail("una captura fallida no debe soltar la garantía")),
    )

    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    # No se cobró: el dueño recibe solo lo suyo del arriendo, la garantía sigue
    # retenida y los extras quedan anotados para cobrarse después.
    assert _uno(db_session, escenario["rid"], "liquidacion_dueno").monto == BASE_DUENO
    assert _uno(db_session, escenario["rid"], "hold_reserva").estado == "retenido"
    assert _uno(db_session, escenario["rid"], "cargo_devolucion").estado == "pendiente"

    # La pasarela se recupera: el barrido cobra los extras y se los abona al dueño.
    capturas = []

    def capturar(cls, payment_id, monto=None):
        capturas.append((payment_id, monto))
        return {"success": True, "capturado": True, "estado": "approved"}

    monkeypatch.setattr(MercadoPagoService, "capturar_pago", classmethod(capturar))
    assert cargos_service.reintentar_garantias(db_session)["cobradas"] == 1

    assert capturas == [("987654321", EXTRAS)]
    hold = _uno(db_session, escenario["rid"], "hold_reserva")
    assert (hold.estado, hold.monto) == ("capturado", EXTRAS)
    assert _uno(db_session, escenario["rid"], "cargo_devolucion").estado == "capturado"
    abonos = sorted(p.monto for p in _pagos(db_session, escenario["rid"], "liquidacion_dueno"))
    assert abonos == sorted([BASE_DUENO, EXTRAS])


# ------------------------------------------------------------------ multas
def _multa(auth_as, esc, tipo="fumar", monto=50000):
    return auth_as(esc["dueno"]).post(
        f"/api/v1/reservas/{esc['rid']}/aplicar-multa",
        json={"tipo": tipo, "monto_clp": monto, "motivo": "Olor a cigarrillo en el habitáculo.", "fotos": ["https://ej.com/f.jpg"]},
    )


def test_una_multa_durante_el_arriendo_queda_pendiente_y_no_toca_la_liquidacion(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    resp = _multa(auth_as, escenario)
    assert resp.status_code == 200, resp.text

    multa = _uno(db_session, escenario["rid"], "cargo_fumar")
    assert multa.estado == "pendiente"
    assert not multa.referencia_pago, "no debe llevar una referencia de pasarela inventada"
    assert db_session.get(Reserva, escenario["rid"]).liquidacion_dueno_clp in (0, None)


def test_al_devolver_la_multa_se_descuenta_de_la_garantia_junto_con_los_extras(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _multa(auth_as, escenario, monto=50000)
    _devolver(auth_as, escenario, combustible="1/2", limpieza="sucio_estandar")

    assert _uno(db_session, escenario["rid"], "hold_reserva").monto == EXTRAS + 50000
    assert _uno(db_session, escenario["rid"], "cargo_fumar").estado == "capturado"
    assert _uno(db_session, escenario["rid"], "liquidacion_dueno").monto == BASE_DUENO + EXTRAS + 50000


def test_las_multas_no_pueden_sumar_mas_que_la_garantia(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    assert _multa(auth_as, escenario, monto=200000).status_code == 200

    resp = _multa(auth_as, escenario, monto=100000)  # 300.000 > garantía de 250.000

    assert resp.status_code == 400, resp.text
    assert "garantía" in resp.text.lower()
    assert len(_pagos(db_session, escenario["rid"], "cargo_fumar")) == 1


def test_la_penalizacion_gps_queda_pendiente_y_sin_referencia_inventada(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    reserva = db_session.get(Reserva, escenario["rid"])

    monto = gps_monitor_service._aplicar_penalizacion(db_session, reserva)
    db_session.commit()

    fila = _uno(db_session, escenario["rid"], "cargo_gps_sin_senal")
    assert fila.monto == monto
    assert fila.estado == "pendiente"
    assert not fila.referencia_pago


# ------------------------------------------------------------------ extensión
def test_extender_cobra_los_dias_adicionales_a_la_tarjeta_del_cobro(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    antes = db_session.get(Reserva, escenario["rid"])
    fin_antes, hold_antes = antes.fecha_fin, antes.monto_hold

    resp = auth_as(escenario["cliente"]).post(f"/api/v1/reservas/{escenario['rid']}/extender", json={"dias_adicionales": 2})
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    reserva = db_session.get(Reserva, escenario["rid"])
    assert reserva.fecha_fin == fin_antes + timedelta(days=2)
    assert reserva.monto_hold == hold_antes, "la garantía es fija por categoría: extender no la sube"
    extensiones = [p for p in _pagos(db_session, escenario["rid"], "cobro_arriendo") if p.monto == 40000]
    assert len(extensiones) == 1
    assert extensiones[0].estado == "capturado"
    assert not extensiones[0].referencia_pago.startswith("MP-EXT-")
    # Ya no se registra como si fuera otra garantía capturada.
    assert [p for p in _pagos(db_session, escenario["rid"], "hold_reserva") if p.monto == 40000] == []


def test_si_el_banco_rechaza_la_extension_no_se_extiende(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    tarjeta = db_session.get(Tarjeta, escenario["debito"]["id"])
    tarjeta.ultimos4 = "0000"  # convención de pruebas: siempre rechaza
    db_session.commit()
    fin_antes = db_session.get(Reserva, escenario["rid"]).fecha_fin

    resp = auth_as(escenario["cliente"]).post(f"/api/v1/reservas/{escenario['rid']}/extender", json={"dias_adicionales": 2})

    assert resp.status_code == 402, resp.text
    db_session.expire_all()
    assert db_session.get(Reserva, escenario["rid"]).fecha_fin == fin_antes
    assert [p for p in _pagos(db_session, escenario["rid"], "cobro_arriendo") if p.monto == 40000] == []


def test_lo_extendido_se_le_liquida_al_dueno_al_devolver(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    auth_as(escenario["cliente"]).post(f"/api/v1/reservas/{escenario['rid']}/extender", json={"dias_adicionales": 2})
    _devolver(auth_as, escenario)

    # 5 días × $20.000 = $100.000; al dueño el 85 %.
    assert _uno(db_session, escenario["rid"], "liquidacion_dueno").monto == 85000


# ------------------------------------------------------------------ cobro posterior
def _cobro_posterior(auth_as, esc, monto):
    return auth_as(esc["dueno"]).post(
        f"/api/v1/reservas/{esc['rid']}/cobro-posterior",
        json={"tipo": "peaje", "monto": monto, "descripcion": "Peajes de la ruta 5", "comprobante_url": "https://ej.com/boleta.pdf"},
    )


def test_el_cobro_posterior_tiene_tope_en_la_garantia(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario)

    resp = _cobro_posterior(auth_as, escenario, 260000)

    assert resp.status_code == 400, resp.text
    assert "garantía" in resp.text.lower()
    assert _pagos(db_session, escenario["rid"], "cobro_posterior_peaje") == []


def test_lo_cobrado_como_cobro_posterior_se_le_abona_al_dueno(escenario, auth_as, db_session):
    _entregar(auth_as, escenario)
    _devolver(auth_as, escenario)

    resp = _cobro_posterior(auth_as, escenario, 12000)
    assert resp.status_code == 200, resp.text

    assert _uno(db_session, escenario["rid"], "cobro_posterior_peaje").estado == "capturado"
    abonos = [p.monto for p in _pagos(db_session, escenario["rid"], "liquidacion_dueno")]
    assert sorted(abonos) == [12000, BASE_DUENO]
