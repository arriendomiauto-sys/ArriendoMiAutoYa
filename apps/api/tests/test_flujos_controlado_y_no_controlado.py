"""
Flujo CONTROLADO y NO CONTROLADO del arriendo, por los endpoints reales.

- Controlado: el camino que el negocio exige, paso a paso, y que cada paso deja
  el dinero y los documentos en el estado correcto.
- No controlado: cada intento de saltarse un paso (arrendatario, dueño o un
  tercero). Cada uno tiene que ser rechazado SIN mover plata ni estados.

Corre en modo simulado: cualquier salida a la pasarela real revienta el test.
"""
from datetime import datetime, timedelta

import pytest

from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, ChecklistAuto, FirmaContrato, Pago, Reserva

FOTO = "https://ej.com/1.jpg"
TRAZO = "M1 1 L10 10"


@pytest.fixture(autouse=True)
def sin_pasarela_real(monkeypatch):
    def prohibido(*a, **k):
        raise AssertionError("se intentó llamar a Mercado Pago de verdad en un test simulado")

    monkeypatch.setattr(MercadoPagoService, "_pedir", classmethod(lambda cls, *a, **k: prohibido()))


def _fecha(dias=0, horas=0):
    return (datetime.utcnow() + timedelta(days=dias, hours=horas)).strftime("%Y-%m-%dT%H:%M:%S")


def _auto(db_session, dueno, patente="FLJO-01", estado="activo"):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente=patente,
        tarifa_dia=20000, estado=estado, ubicacion_base="Concepción", categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    return auto


def _tarjetas(auth_as, usuario):
    out = {}
    for tipo, token in (("debito", "SIMULADO-DEBITO-4242"), ("credito", "SIMULADO-CREDITO-1111")):
        r = auth_as(usuario).post("/api/v1/usuarios/me/tarjetas", json={"card_token": token, "payment_method_id": "visa"})
        assert r.status_code == 201, r.text
        out[tipo] = r.json()["tarjeta"]
    return out


def _reservar(auth_as, cliente, auto, inicio=60, dias=3):
    return auth_as(cliente).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": _fecha(inicio), "fecha_fin": _fecha(inicio + dias),
        "lugar_entrega_acordado": "Plaza de Armas",
    })


def _pagar(auth_as, cliente, rid, tj):
    return auth_as(cliente).post(f"/api/v1/reservas/{rid}/pagar", json={
        "tarjeta_cobro_id": tj["debito"]["id"], "tarjeta_garantia_id": tj["credito"]["id"],
    })


def _estado(db_session, rid):
    db_session.expire_all()
    return db_session.get(Reserva, rid).estado


def _pagos(db_session, rid):
    db_session.expire_all()
    return sorted((p.tipo, p.estado) for p in db_session.query(Pago).filter(Pago.reserva_id == rid))


def _qr(auth_as, cliente, rid):
    r = auth_as(cliente).post(f"/api/v1/reservas/{rid}/generar-codigo")
    assert r.status_code == 200, r.text
    return r.json()["codigo_qr_hash"]


def _verificar(auth_as, dueno, cliente, rid, tipo="entrega"):
    qr = _qr(auth_as, cliente, rid)
    assert auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 200
    r = auth_as(dueno).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": tipo})
    assert r.status_code == 200, r.text


def _checklist(auth_as, quien, rid, tipo, **extra):
    body = {"tipo": tipo, "fotos": [FOTO], "kilometraje": 25000 if tipo == "antes" else 25300,
            "nivel_combustible": "lleno", **extra}
    return auth_as(quien).post(f"/api/v1/entrega/{rid}/checklist", json=body)


@pytest.fixture
def partes(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno", "cliente"], estado_documentos="verificado", nombre="Dueña Pérez")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado", nombre="Cliente Soto")
    auto = _auto(db_session, dueno)
    tj = _tarjetas(auth_as, cliente)
    return {"dueno": dueno, "cliente": cliente, "auto": auto, "tj": tj}


@pytest.fixture
def confirmada(partes, auth_as, db_session):
    """Reserva pagada y confirmada por el dueño, con el retiro en 1 hora."""
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    assert _pagar(auth_as, partes["cliente"], rid, partes["tj"]).status_code == 200
    r = auth_as(partes["dueno"]).patch(f"/api/v1/reservas/{rid}/estado", params={"nuevo_estado": "confirmada"})
    assert r.status_code == 200, r.text
    reserva = db_session.get(Reserva, rid)
    reserva.fecha_inicio = datetime.utcnow() + timedelta(hours=1)
    reserva.fecha_fin = datetime.utcnow() + timedelta(days=3)
    db_session.commit()
    return {**partes, "rid": rid}


def _entregar(auth_as, c):
    _verificar(auth_as, c["dueno"], c["cliente"], c["rid"])
    assert auth_as(c["dueno"]).post(
        f"/api/v1/reservas/{c['rid']}/firmar-contrato", json={"metodo": "huella", "acepta_terminos": True}
    ).status_code == 200
    r = _checklist(auth_as, c["dueno"], c["rid"], "antes", firma_svg=TRAZO)
    assert r.status_code == 200, r.text


# =========================================================================== #
# FLUJO CONTROLADO
# =========================================================================== #
def test_flujo_controlado_de_punta_a_punta(partes, auth_as, db_session):
    dueno, cliente, auto, tj = partes["dueno"], partes["cliente"], partes["auto"], partes["tj"]

    # 1. Reserva: nace esperando pago, con la garantía y el cobro que fija el servidor.
    r = _reservar(auth_as, cliente, auto)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert r.json()["estado"] == "pendiente_pago"

    # 2. Pago sin firmar (el contrato se firma en la entrega): queda esperando al dueño.
    pago = _pagar(auth_as, cliente, rid, tj)
    assert pago.status_code == 200, pago.text
    assert pago.json()["estado"] == "esperando_dueno"
    assert _pagos(db_session, rid) == [("cobro_arriendo", "capturado"), ("hold_reserva", "retenido")]

    # 3. El dueño confirma.
    assert auth_as(dueno).patch(f"/api/v1/reservas/{rid}/estado", params={"nuevo_estado": "confirmada"}).status_code == 200
    assert _estado(db_session, rid) == "confirmada"
    reserva = db_session.get(Reserva, rid)
    reserva.fecha_inicio = datetime.utcnow() + timedelta(hours=1)
    reserva.fecha_fin = datetime.utcnow() + timedelta(days=3)
    db_session.commit()

    # 4. Entrega: QR + identidad en persona, fotos, firma del dueño (huella) y del arrendatario (trazo).
    _entregar(auth_as, {"dueno": dueno, "cliente": cliente, "rid": rid})
    assert _estado(db_session, rid) == "en_curso"
    db_session.expire_all()
    reserva = db_session.get(Reserva, rid)
    assert reserva.fecha_firma_biometrica is not None and reserva.hash_contrato_sha256
    firmas = {f.rol for f in db_session.query(FirmaContrato).filter(FirmaContrato.reserva_id == rid)}
    assert firmas == {"arrendatario", "arrendador"}

    # 5. Devolución: QR + identidad en persona y checklist final.
    _verificar(auth_as, dueno, cliente, rid, tipo="devolucion")
    fin = _checklist(auth_as, dueno, rid, "despues")
    assert fin.status_code == 200, fin.text
    assert _estado(db_session, rid) == "finalizada"

    # 6. Dinero al cierre: garantía liberada, arriendo cobrado y liquidación del dueño pendiente.
    pagos = dict(_pagos(db_session, rid))
    assert pagos["hold_reserva"] == "liberado"
    assert pagos["cobro_arriendo"] == "capturado"
    assert pagos["liquidacion_dueno"] == "pendiente"
    assert db_session.query(ChecklistAuto).filter(ChecklistAuto.reserva_id == rid).count() == 2


# =========================================================================== #
# FLUJO NO CONTROLADO — cada atajo tiene que rechazarse sin mover nada
# =========================================================================== #
def test_no_se_reserva_sin_identidad_verificada(usuario_factory, auth_as, db_session, partes):
    sin_kyc = usuario_factory(roles_activos=["cliente"], estado_documentos="pendiente")
    assert _reservar(auth_as, sin_kyc, partes["auto"]).status_code == 403


def test_no_se_paga_con_las_tarjetas_de_otro(usuario_factory, auth_as, db_session, partes):
    """Sin tarjeta propia se puede reservar (la reserva vence por TTL), pero no pagar con las ajenas."""
    otro = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    r = _reservar(auth_as, otro, partes["auto"])
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert _pagar(auth_as, otro, rid, partes["tj"]).status_code in (400, 402, 403, 404)
    assert _pagos(db_session, rid) == []
    assert _estado(db_session, rid) == "pendiente_pago"


def test_el_dueno_no_reserva_su_propio_auto(auth_as, partes):
    _tarjetas(auth_as, partes["dueno"])
    r = _reservar(auth_as, partes["dueno"], partes["auto"])
    assert r.status_code in (400, 403), r.text


def test_no_se_reserva_un_auto_pausado(auth_as, db_session, partes):
    pausado = _auto(db_session, partes["dueno"], patente="PAUS-01", estado="pausado")
    assert _reservar(auth_as, partes["cliente"], pausado).status_code in (400, 404)


def test_fechas_invalidas_se_rechazan(auth_as, partes):
    c, auto = partes["cliente"], partes["auto"]
    pasado = auth_as(c).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": _fecha(-2), "fecha_fin": _fecha(1), "lugar_entrega_acordado": "X"})
    invertida = auth_as(c).post("/api/v1/reservas", json={
        "auto_id": auto.id, "fecha_inicio": _fecha(10), "fecha_fin": _fecha(8), "lugar_entrega_acordado": "X"})
    assert pasado.status_code in (400, 422)
    assert invertida.status_code in (400, 422)


def test_no_se_reservan_fechas_ya_tomadas(usuario_factory, auth_as, db_session, confirmada):
    otro = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    _tarjetas(auth_as, otro)
    r = auth_as(otro).post("/api/v1/reservas", json={
        "auto_id": confirmada["auto"].id, "fecha_inicio": _fecha(0, 2), "fecha_fin": _fecha(2),
        "lugar_entrega_acordado": "X"})
    assert r.status_code == 400, r.text


def test_un_tercero_no_paga_ni_ve_la_reserva_de_otro(usuario_factory, auth_as, db_session, partes):
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    intruso = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    tj = _tarjetas(auth_as, intruso)
    assert _pagar(auth_as, intruso, rid, tj).status_code == 403
    assert auth_as(intruso).get(f"/api/v1/reservas/{rid}").status_code in (403, 404)
    assert _pagos(db_session, rid) == []


def test_el_arrendatario_no_confirma_su_propia_reserva(auth_as, db_session, partes):
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    assert _pagar(auth_as, partes["cliente"], rid, partes["tj"]).status_code == 200
    r = auth_as(partes["cliente"]).patch(f"/api/v1/reservas/{rid}/estado", params={"nuevo_estado": "confirmada"})
    assert r.status_code in (400, 403)
    assert _estado(db_session, rid) == "pendiente"


def test_el_dueno_no_confirma_una_reserva_sin_pagar(auth_as, db_session, partes):
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    r = auth_as(partes["dueno"]).patch(f"/api/v1/reservas/{rid}/estado", params={"nuevo_estado": "confirmada"})
    assert r.status_code == 400
    assert _estado(db_session, rid) == "pendiente_pago"


def test_no_se_entrega_una_reserva_sin_pagar(auth_as, db_session, partes):
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    assert auth_as(partes["cliente"]).post(f"/api/v1/reservas/{rid}/generar-codigo").status_code == 400
    assert _checklist(auth_as, partes["dueno"], rid, "antes", firma_svg=TRAZO).status_code in (400, 409)
    assert _estado(db_session, rid) == "pendiente_pago"


def test_no_se_entrega_sin_verificar_la_identidad_en_persona(auth_as, db_session, confirmada):
    rid = confirmada["rid"]
    firma = auth_as(confirmada["dueno"]).post(
        f"/api/v1/reservas/{rid}/firmar-contrato", json={"metodo": "huella", "acepta_terminos": True})
    assert firma.status_code == 409
    assert _checklist(auth_as, confirmada["dueno"], rid, "antes", firma_svg=TRAZO).status_code == 409
    assert _estado(db_session, rid) == "confirmada"


def test_el_arrendatario_no_registra_la_entrega_ni_valida_el_qr(auth_as, db_session, confirmada):
    rid, cliente = confirmada["rid"], confirmada["cliente"]
    qr = _qr(auth_as, cliente, rid)
    assert auth_as(cliente).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 403
    assert auth_as(cliente).post(
        f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": "entrega"}
    ).status_code == 403
    assert _checklist(auth_as, cliente, rid, "antes", firma_svg=TRAZO).status_code == 403
    assert _estado(db_session, rid) == "confirmada"


def test_el_dueno_de_otro_auto_no_valida_el_qr(usuario_factory, auth_as, confirmada):
    otro_dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    qr = _qr(auth_as, confirmada["cliente"], confirmada["rid"])
    assert auth_as(otro_dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 403


def test_no_se_cierra_la_devolucion_sin_el_arrendatario_presente(auth_as, db_session, confirmada):
    """Sin la verificación en persona de la devolución, el dueño no puede cobrarse cargos solo."""
    _entregar(auth_as, confirmada)
    rid = confirmada["rid"]
    r = _checklist(auth_as, confirmada["dueno"], rid, "despues", nivel_combustible="1/4", estado_limpieza="sucio_profundo")
    assert r.status_code == 409, r.text
    assert _estado(db_session, rid) == "en_curso"
    assert dict(_pagos(db_session, rid))["hold_reserva"] == "retenido"


def test_la_verificacion_de_entrega_no_sirve_para_la_devolucion(auth_as, db_session, confirmada):
    _entregar(auth_as, confirmada)
    r = _checklist(auth_as, confirmada["dueno"], confirmada["rid"], "despues")
    assert r.status_code == 409
    assert _estado(db_session, confirmada["rid"]) == "en_curso"


def test_no_se_cancela_un_arriendo_en_curso(auth_as, db_session, confirmada):
    _entregar(auth_as, confirmada)
    for quien in (confirmada["cliente"], confirmada["dueno"]):
        r = auth_as(quien).patch(f"/api/v1/reservas/{confirmada['rid']}/estado", params={"nuevo_estado": "cancelada"})
        assert r.status_code == 400
    assert _estado(db_session, confirmada["rid"]) == "en_curso"


def test_no_se_entrega_dos_veces(auth_as, db_session, confirmada):
    _entregar(auth_as, confirmada)
    r = _checklist(auth_as, confirmada["dueno"], confirmada["rid"], "antes", firma_svg=TRAZO)
    assert r.status_code == 409
    assert db_session.query(ChecklistAuto).filter(ChecklistAuto.reserva_id == confirmada["rid"]).count() == 1


def test_no_se_paga_dos_veces(auth_as, db_session, partes):
    rid = _reservar(auth_as, partes["cliente"], partes["auto"]).json()["id"]
    assert _pagar(auth_as, partes["cliente"], rid, partes["tj"]).status_code == 200
    segundo = _pagar(auth_as, partes["cliente"], rid, partes["tj"])
    assert segundo.status_code in (200, 409)
    cobros = [p for p in _pagos(db_session, rid) if p[0] == "cobro_arriendo"]
    assert len(cobros) == 1


def test_un_tercero_no_extiende_ni_cobra_posterior(usuario_factory, auth_as, db_session, confirmada):
    _entregar(auth_as, confirmada)
    intruso = usuario_factory(roles_activos=["cliente", "dueno"], estado_documentos="verificado")
    assert auth_as(intruso).post(
        f"/api/v1/reservas/{confirmada['rid']}/extender", json={"dias_adicionales": 1}
    ).status_code == 403
    assert auth_as(intruso).post(f"/api/v1/reservas/{confirmada['rid']}/cobro-posterior", json={
        "tipo": "tag", "monto": 5000, "descripcion": "Peaje", "comprobante_url": FOTO,
    }).status_code == 403


def test_no_se_cobra_posterior_en_un_arriendo_sin_terminar(auth_as, confirmada):
    _entregar(auth_as, confirmada)
    r = auth_as(confirmada["dueno"]).post(f"/api/v1/reservas/{confirmada['rid']}/cobro-posterior", json={
        "tipo": "tag", "monto": 5000, "descripcion": "Peaje", "comprobante_url": FOTO,
    })
    assert r.status_code == 400


def test_el_dueno_no_verifica_la_identidad_sin_escanear_el_qr(auth_as, db_session, confirmada):
    """Confirmar (o rechazar) la identidad a distancia, sin el QR del arrendatario, no vale."""
    rid, dueno = confirmada["rid"], confirmada["dueno"]
    for body in (
        {"resultado": "confirmada", "tipo": "entrega"},
        {"resultado": "rechazada", "tipo": "entrega", "motivo_rechazo": "no vino"},
    ):
        r = auth_as(dueno).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json=body)
        assert r.status_code == 409, r.text
    assert _estado(db_session, rid) == "confirmada"


def test_el_qr_es_de_un_solo_uso(auth_as, confirmada):
    qr = _qr(auth_as, confirmada["cliente"], confirmada["rid"])
    dueno = confirmada["dueno"]
    assert auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 200
    assert auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 404


def test_un_escaneo_sirve_para_una_sola_verificacion(auth_as, db_session, confirmada):
    rid, dueno = confirmada["rid"], confirmada["dueno"]
    _verificar(auth_as, dueno, confirmada["cliente"], rid)
    otra = auth_as(dueno).post(
        f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "rechazada", "tipo": "entrega", "motivo_rechazo": "x"})
    assert otra.status_code == 409
    assert _estado(db_session, rid) == "confirmada"


def test_la_verificacion_debe_corresponder_al_momento(auth_as, db_session, confirmada):
    """No se 'verifica la devolución' antes de entregar el auto, ni la entrega de un arriendo en curso."""
    rid, dueno, cliente = confirmada["rid"], confirmada["dueno"], confirmada["cliente"]
    qr = _qr(auth_as, cliente, rid)
    assert auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 200
    r = auth_as(dueno).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": "devolucion"})
    assert r.status_code == 409

    _entregar(auth_as, confirmada)
    qr = _qr(auth_as, cliente, rid)
    assert auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr}).status_code == 200
    r = auth_as(dueno).post(f"/api/v1/entrega/{rid}/confirmar-verificacion", json={"resultado": "confirmada", "tipo": "entrega"})
    assert r.status_code == 409
    assert _estado(db_session, rid) == "en_curso"
