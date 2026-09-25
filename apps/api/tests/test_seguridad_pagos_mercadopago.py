"""
Seguridad de los endpoints de pago de Mercado Pago (`/pagos/mercadopago/*`).

Hallazgos de la revisión de QA (2026-09-20), todos por endpoints que la app ya
no usa pero que seguían publicados y sin pruebas:

  · `/iniciar` dejaba que CUALQUIER usuario creara un `Pago` con el `tipo` y el
    `monto` que quisiera. El barrido de liquidaciones paga todo `Pago` de tipo
    `liquidacion_dueno` en estado `pendiente`: bastaba pedir un "pago" de
    5.000.000 de ese tipo para que la plataforma se lo depositara (con los
    payouts BCI encendidos).
  · `/confirmar` no pedía autenticación ni comprobaba que el pago de Mercado
    Pago correspondiera al `Pago` que se iba a marcar como cobrado.
  · `/estado/{payment_id}` devolvía cualquier pago de la cuenta (incluido el
    JSON crudo de MP) a cualquier usuario autenticado.
"""
import pytest

from app.core.config import settings
from app.features.payments import cuentas_cobro_service as cc
from app.features.payments import liquidaciones_service as liq
from app.features.payments.mercadopago_service import MercadoPagoService
from app.models.entities import Auto, Pago, Reserva

URL = "/api/v1/pagos/mercadopago"


@pytest.fixture(autouse=True)
def modo_simulado(monkeypatch):
    monkeypatch.setattr(settings, "PAGOS_SIMULADOS", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")


def _reserva_de(db_session, usuario_factory, cliente, patente="PGSC-77"):
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022, patente=patente,
        tarifa_dia=20000, estado="activo", ubicacion_base="Los Ángeles", categoria="economico",
    )
    db_session.add(auto)
    db_session.commit()
    from datetime import datetime, timedelta
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id, estado="pendiente_pago",
        fecha_inicio=datetime.utcnow() + timedelta(days=5),
        fecha_fin=datetime.utcnow() + timedelta(days=8),
        monto_cobro=60000, monto_hold=250000, lugar_entrega_acordado="Plaza de Armas",
    )
    db_session.add(reserva)
    db_session.commit()
    return reserva


def _iniciar(auth_as, usuario, **cuerpo):
    return auth_as(usuario).post(f"{URL}/iniciar", json=cuerpo)


# ===========================================================================
# /iniciar
# ===========================================================================
@pytest.mark.parametrize("tipo", ["liquidacion_dueno", "bono_referido", "cargo_limpieza", "lo_que_sea"])
def test_iniciar_solo_acepta_tipos_de_cobro_al_arrendatario(usuario_factory, auth_as, tipo):
    user = usuario_factory(roles_activos=["cliente"])

    resp = _iniciar(auth_as, user, monto=5_000_000, tipo=tipo)

    assert resp.status_code in (400, 422), resp.text


def test_un_usuario_no_puede_fabricarse_una_liquidacion_y_cobrarla(
    usuario_factory, auth_as, db_session, monkeypatch
):
    """Impacto real: con los payouts encendidos, el "pago" falso terminaba depositado."""
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)
    atacante = usuario_factory(roles_activos=["cliente", "dueno"])
    atacante.cuenta_bancaria = None
    db_session.commit()
    cc.agregar(db_session, atacante, banco="BancoEstado", tipo_cuenta="Cuenta Corriente",
               numero="22224444", titular=atacante.nombre, rut="11.111.111-1")
    reserva = _reserva_de(db_session, usuario_factory, atacante)

    _iniciar(auth_as, atacante, monto=5_000_000, tipo="liquidacion_dueno", reserva_id=reserva.id)
    liq.ejecutar_liquidaciones_pendientes(db_session)

    db_session.expire_all()
    pagados = (
        db_session.query(Pago)
        .filter(Pago.usuario_id == atacante.id, Pago.tipo == "liquidacion_dueno", Pago.estado == "pagado")
        .count()
    )
    assert pagados == 0, "el usuario se depositó a sí mismo una liquidación inventada"


@pytest.mark.parametrize("monto", [0, -50000])
def test_iniciar_rechaza_montos_no_positivos(usuario_factory, auth_as, monto):
    user = usuario_factory(roles_activos=["cliente"])

    resp = _iniciar(auth_as, user, monto=monto, tipo="hold_reserva")

    assert resp.status_code in (400, 422), resp.text


def test_iniciar_no_deja_atar_un_pago_a_la_reserva_de_otro(usuario_factory, auth_as, db_session):
    victima = usuario_factory(roles_activos=["cliente"])
    intruso = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, victima)

    resp = _iniciar(auth_as, intruso, monto=1000, tipo="hold_reserva", reserva_id=reserva.id)

    assert resp.status_code in (403, 404), resp.text


def test_iniciar_y_confirmar_siguen_funcionando_para_un_pago_legitimo(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, cliente)

    iniciado = _iniciar(auth_as, cliente, monto=250000, tipo="hold_reserva", reserva_id=reserva.id)
    assert iniciado.status_code == 200, iniciado.text
    datos = iniciado.json()

    confirmado = auth_as(cliente).post(
        f"{URL}/confirmar", json={"payment_id": datos["preferencia_id"], "pago_id": datos["pago_id"]}
    )
    assert confirmado.status_code == 200, confirmado.text
    assert confirmado.json()["autorizada"] is True
    db_session.expire_all()
    assert db_session.get(Pago, datos["pago_id"]).estado in ("capturado", "retenido")
    # Con la garantía sola no está pagada: falta cobrar el arriendo ($60.000), que va
    # por el checkout de la reserva (/reservas/{id}/pagar). Ver test_blindaje_checkout.py.
    assert db_session.get(Reserva, reserva.id).estado == "pendiente_pago"


# ===========================================================================
# /confirmar
# ===========================================================================
def test_confirmar_exige_estar_autenticado(usuario_factory, auth_as, client, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, cliente)
    datos = _iniciar(auth_as, cliente, monto=250000, tipo="hold_reserva", reserva_id=reserva.id).json()
    client.app.dependency_overrides.clear()  # sin sesión

    resp = client.post(f"{URL}/confirmar", json={"payment_id": datos["preferencia_id"], "pago_id": datos["pago_id"]})

    assert resp.status_code in (401, 403), resp.text
    db_session.expire_all()
    assert db_session.get(Pago, datos["pago_id"]).estado == "pendiente"


def test_confirmar_no_marca_como_cobrado_el_pago_de_otro_usuario(usuario_factory, auth_as, db_session):
    victima = usuario_factory(roles_activos=["cliente"])
    intruso = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, victima)
    datos = _iniciar(auth_as, victima, monto=250000, tipo="hold_reserva", reserva_id=reserva.id).json()

    resp = auth_as(intruso).post(
        f"{URL}/confirmar", json={"payment_id": datos["preferencia_id"], "pago_id": datos["pago_id"]}
    )

    assert resp.status_code in (403, 404), resp.text
    db_session.expire_all()
    assert db_session.get(Pago, datos["pago_id"]).estado == "pendiente"


def test_confirmar_no_acepta_un_pago_de_mp_que_no_corresponde(usuario_factory, auth_as, db_session, monkeypatch):
    """Modo real: el pago aprobado en MP es de otra referencia y por otro monto."""
    monkeypatch.setattr(settings, "PAGOS_SIMULADOS", False)
    cliente = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, cliente)
    monkeypatch.setattr(
        MercadoPagoService, "crear_preferencia",
        classmethod(lambda cls, **k: {"success": True, "preferencia_id": "PREF-1", "url": "https://mp"}),
    )
    datos = _iniciar(auth_as, cliente, monto=250000, tipo="hold_reserva", reserva_id=reserva.id).json()
    monkeypatch.setattr(
        MercadoPagoService, "obtener_pago",
        classmethod(lambda cls, pid: {
            "success": True, "autorizada": True, "capturado": True, "retenido": False, "estado": "approved",
            "payment_id": pid, "monto": 1000, "referencia_externa": "OTRO-PAGO-AJENO",
        }),
    )

    resp = auth_as(cliente).post(f"{URL}/confirmar", json={"payment_id": "999", "pago_id": datos["pago_id"]})

    assert resp.status_code in (400, 409), resp.text
    db_session.expire_all()
    assert db_session.get(Pago, datos["pago_id"]).estado == "pendiente"
    # Un pago ajeno no puede avanzar la reserva: sigue sin pagar (ni siquiera llega a esperar al dueño).
    assert db_session.get(Reserva, reserva.id).estado == "pendiente_pago"


# ===========================================================================
# /estado/{payment_id}
# ===========================================================================
def test_estado_no_muestra_pagos_de_otros_ni_el_json_crudo(usuario_factory, auth_as, db_session, monkeypatch):
    monkeypatch.setattr(settings, "PAGOS_SIMULADOS", False)
    duenio_del_pago = usuario_factory(roles_activos=["cliente"])
    curioso = usuario_factory(roles_activos=["cliente"])
    reserva = _reserva_de(db_session, usuario_factory, duenio_del_pago)
    db_session.add(Pago(reserva_id=reserva.id, usuario_id=duenio_del_pago.id, tipo="hold_reserva",
                        monto=250000, estado="retenido", referencia_pago="123456"))
    db_session.commit()
    monkeypatch.setattr(
        MercadoPagoService, "obtener_pago",
        classmethod(lambda cls, pid: {"success": True, "estado": "authorized", "payment_id": pid,
                                      "tarjeta": {"ultimos4": "7115"}, "raw": {"payer": {"email": "x@y.cl"}}}),
    )

    ajeno = auth_as(curioso).get(f"{URL}/estado/123456")
    propio = auth_as(duenio_del_pago).get(f"{URL}/estado/123456")

    assert ajeno.status_code in (403, 404), ajeno.text
    assert propio.status_code == 200, propio.text
    assert "raw" not in propio.json()
