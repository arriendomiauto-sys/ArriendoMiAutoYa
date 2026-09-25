"""
Renovación de la garantía antes de que Mercado Pago la suelte sola.

  · Se toma el hold nuevo y RECIÉN después se suelta el viejo: el
    arrendatario nunca queda sin garantía.
  · Si el hold nuevo no se autoriza, el viejo sigue intacto.
  · Renovar dos veces (doble toque, app y barrido a la vez) no toma dos holds.
  · Si no se puede sin CVV, se le pide al arrendatario una sola vez.
"""
from datetime import datetime, timedelta

import pytest

from app.core.config import settings
from app.features.payments import checkout_service, garantia_renovacion as gr
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Pago, Reserva, Tarjeta, Usuario

MONTO = 250000


@pytest.fixture
def pasarela(monkeypatch):
    """Registra holds tomados y soltados; `autorizar` decide si Mercado Pago aprueba el nuevo."""
    estado = {"holds": [], "liberados": [], "autorizar": True}

    def mover(tarjeta, usuario, monto, capturar, ref, **_):
        assert capturar is False, "renovar nunca cobra: solo retiene"
        estado["holds"].append(monto)
        if not estado["autorizar"]:
            return {"success": True, "autorizada": False, "estado": "rejected",
                    "detalle_estado": "cc_rejected_insufficient_amount", "payment_id": "2000000099"}
        return {"success": True, "autorizada": True, "retenido": True, "estado": "authorized",
                "payment_id": str(2000000000 + len(estado["holds"]))}

    def liberar(cls, payment_id):
        estado["liberados"].append(payment_id)
        return {"success": True, "estado": "cancelled"}

    monkeypatch.setattr(checkout_service, "_mover", mover)
    monkeypatch.setattr(MercadoPagoService, "liberar_hold", classmethod(liberar))
    return estado


@pytest.fixture
def reserva(db_session, usuario_factory):
    """Reserva confirmada de 10 días cuya garantía (válida 7 días) vence mañana."""
    dueno = usuario_factory(roles_activos=["dueno"])
    cliente = usuario_factory(roles_activos=["cliente"])
    auto = Auto(dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente="RENO-01",
                tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico")
    db_session.add(auto)
    db_session.flush()
    tarjeta = Tarjeta(usuario_id=cliente.id, tipo="credito", estado="validada", ultimos4="1111",
                      mp_card_id="9001")
    db_session.add(tarjeta)
    db_session.flush()
    ahora = datetime.utcnow()
    r = Reserva(auto_id=auto.id, cliente_id=cliente.id, estado="confirmada",
                fecha_inicio=ahora + timedelta(days=1), fecha_fin=ahora + timedelta(days=10),
                monto_cobro=200000, monto_hold=MONTO, tarjeta_garantia_id=tarjeta.id,
                lugar_entrega_acordado="Plaza de Armas")
    db_session.add(r)
    db_session.flush()
    db_session.add(Pago(reserva_id=r.id, usuario_id=cliente.id, tipo="hold_reserva", monto=MONTO,
                        estado="retenido", referencia_pago="2000000000",
                        timestamp=ahora - timedelta(days=settings.GARANTIA_HOLD_VALIDEZ_DIAS - 1)))
    db_session.commit()
    return r


def _holds(db_session, reserva):
    db_session.expire_all()
    return {p.referencia_pago: p.estado for p in
            db_session.query(Pago).filter(Pago.reserva_id == reserva.id, Pago.tipo == "hold_reserva")}


def test_renovar_toma_uno_nuevo_y_suelta_el_viejo(db_session, reserva, pasarela):
    nuevo = gr.renovar(db_session, reserva)

    assert pasarela["holds"] == [MONTO]
    assert pasarela["liberados"] == ["2000000000"]
    assert _holds(db_session, reserva) == {"2000000000": "liberado", nuevo.referencia_pago: "retenido"}


def test_si_el_nuevo_no_se_autoriza_el_viejo_sigue_intacto(db_session, reserva, pasarela):
    pasarela["autorizar"] = False

    with pytest.raises(gr.RenovacionError) as err:
        gr.renovar(db_session, reserva)

    assert err.value.codigo == "SIN_CUPO"
    assert pasarela["liberados"] == []
    assert _holds(db_session, reserva) == {"2000000000": "retenido"}


def test_renovar_dos_veces_no_toma_dos_holds(db_session, reserva, pasarela):
    primero = gr.renovar(db_session, reserva)
    segundo = gr.renovar(db_session, reserva)

    assert segundo.id == primero.id
    assert pasarela["holds"] == [MONTO]
    assert list(_holds(db_session, reserva).values()).count("retenido") == 1


def test_una_garantia_que_no_vence_pronto_no_se_renueva(db_session, reserva, pasarela):
    hold = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).one()
    hold.timestamp = datetime.utcnow()  # recién tomada: cubre 7 días, faltan 10 → aún no toca
    reserva.fecha_fin = datetime.utcnow() + timedelta(days=5)  # ya cubre todo el arriendo
    db_session.commit()

    gr.renovar(db_session, reserva)

    assert pasarela["holds"] == []


def test_el_barrido_renueva_la_que_esta_por_vencer(db_session, reserva, pasarela):
    resumen = gr.renovar_garantias_por_vencer(db_session)

    assert resumen["renovadas"] == 1
    assert pasarela["holds"] == [MONTO]


def test_si_el_barrido_no_puede_le_pide_el_cvv_una_sola_vez(db_session, reserva, pasarela):
    pasarela["autorizar"] = False

    assert gr.renovar_garantias_por_vencer(db_session)["pedidas"] == 1
    assert gr.renovar_garantias_por_vencer(db_session)["pedidas"] == 0

    assert pasarela["holds"] == [MONTO]  # no se reintenta sin CVV
    db_session.expire_all()
    assert db_session.get(Reserva, reserva.id).garantia_renovacion_pedida_en is not None


def test_con_el_cvv_pedido_la_app_puede_renovar(db_session, reserva, pasarela):
    pasarela["autorizar"] = False
    gr.renovar_garantias_por_vencer(db_session)
    pasarela["autorizar"] = True

    gr.renovar(db_session, reserva, token_app="token-con-cvv")

    db_session.expire_all()
    assert db_session.get(Reserva, reserva.id).garantia_renovacion_pedida_en is None
    assert list(_holds(db_session, reserva).values()).count("retenido") == 1
