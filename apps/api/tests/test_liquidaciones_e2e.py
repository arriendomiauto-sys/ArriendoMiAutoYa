"""
End-to-end del pago automático de la liquidación al dueño, con el flag
`BCI_PAYOUTS_HABILITADO` ENCENDIDO y BCI en mock.

Verifica lo que pidió la ronda de QA:
- al cerrar la devolución por HTTP se dispara `intentar_liquidar` desde
  `delivery/service.py` y la liquidación queda `pagado` con referencia de mock;
- el hold / garantía de la reserva NO se toca;
- el `monto` de la liquidación (split 85/15 + compensaciones) es el mismo que
  calcula el checkout — liquidaciones_service solo cambia estado/referencia;
- una cuenta terminada en `0000` (rechazo simulado) reintenta hasta
  `MAX_INTENTOS_LIQUIDACION` y ahí se detiene: sin loop infinito.
"""
import pytest

from app.core.config import settings
from app.features.payments import cuentas_cobro_service as cc
from app.features.payments import liquidaciones_service as liq
from app.models.entities import Notificacion, Pago, Reserva, Usuario


@pytest.fixture
def bci_on(monkeypatch):
    monkeypatch.setattr(settings, "BCI_PAYOUTS_HABILITADO", True)
    monkeypatch.setattr(settings, "BCI_PAYOUTS_MOCK", True)


def _dueno(db):
    return db.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()


def _cerrar_devolucion(client, db_session, auth_as, notas_despues="Devuelto limpio y a tiempo."):
    """Corre entrega + devolución limpia por HTTP. Devuelve el JSON del checklist final."""
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = _dueno(db_session)

    qr = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/generar-codigo").json()["codigo_qr_hash"]
    auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr})
    auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"},
    )
    # Juntos y con las fotos: el dueño firma con su huella; el arrendatario, con el trazo del checklist.
    auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato", json={"metodo": "huella", "acepta_terminos": True}
    )
    r_antes = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ej.com/1.jpg", "https://ej.com/2.jpg"],
            "kilometraje": 25000, "nivel_combustible": "lleno",
            "notas": "Auto impecable.", "firma_svg": "M1 1L2 2",
        },
    )
    assert r_antes.json()["estado_reserva"] == "en_curso"

    r_despues = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "despues",
            "fotos": ["https://ej.com/final.jpg"],
            "kilometraje": 25200, "nivel_combustible": "lleno",
            "estado_limpieza": "limpio", "notas": notas_despues,
        },
    )
    assert r_despues.status_code == 200, r_despues.text
    return reserva.id, r_despues.json()


def _liquidacion(db, reserva_id):
    return (
        db.query(Pago)
        .filter(Pago.reserva_id == reserva_id, Pago.tipo == "liquidacion_dueno")
        .order_by(Pago.timestamp.desc())
        .first()
    )


def _dar_cuenta_cobro(db, usuario, numero="22224444"):
    usuario.cuenta_bancaria = None
    db.commit()
    cc.agregar(
        db, usuario, banco="BancoEstado", tipo_cuenta="Cuenta Corriente",
        numero=numero, titular=usuario.nombre or "Dueño", rut="11.111.111-1",
    )


def test_devolucion_limpia_paga_la_liquidacion_por_mock(client, db_session, auth_as, bci_on):
    _dar_cuenta_cobro(db_session, _dueno(db_session))
    reserva_id, data = _cerrar_devolucion(client, db_session, auth_as)
    assert data["estado_reserva"] == "finalizada"
    assert data["liquidacion_dueno"] > 0

    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)
    assert pago is not None

    # 1) la liquidación quedó pagada automáticamente vía el mock de BCI
    assert pago.estado == "pagado"
    assert (pago.referencia_pago or "").startswith("BCI-MOCK-")
    assert pago.liquidado_en is not None

    # 2) el split no se tocó: liquidaciones_service solo cambia estado/referencia,
    #    el monto es exactamente el que devolvió el checkout
    assert pago.monto == data["liquidacion_dueno"]

    # 3) el hold de la reserva (garantía) quedó intacto
    hold = (
        db_session.query(Pago)
        .filter(Pago.reserva_id == reserva_id, Pago.tipo == "hold_reserva")
        .first()
    )
    assert hold is not None
    assert hold.estado == "capturado"
    assert hold.monto == 126000
    assert hold.referencia_pago == "MP-DEMO-RES-126K"

    # 4) al dueño le llegó el aviso de depósito
    aviso = (
        db_session.query(Notificacion)
        .filter(
            Notificacion.usuario_id == pago.usuario_id,
            Notificacion.entidad_id == pago.id,
            Notificacion.titulo == "Depósito enviado",
        )
        .first()
    )
    assert aviso is not None


def test_devolucion_con_dano_NO_paga_la_liquidacion(client, db_session, auth_as, bci_on):
    """Con daño reportado la reserva queda 'disputada': la liquidación NO se
    auto-paga (ni por el enganche de delivery ni por el barrido de fondo)."""
    reserva_id, data = _cerrar_devolucion(
        client, db_session, auth_as,
        notas_despues="[Rayón] Rayón en la puerta trasera al devolver.",
    )
    assert data["estado_reserva"] == "disputada"

    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)
    assert pago is not None
    assert pago.estado == "pendiente"

    # el barrido de fondo tampoco la toca mientras esté disputada
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)
    assert pago.estado == "pendiente"
    assert resumen["intentadas"] == 0


def test_liquidacion_sin_bci_no_cambia_el_monto(client, db_session, auth_as):
    """Con BCI apagado la liquidación queda 'pendiente' pero con el MISMO monto:
    prueba de que encender el flag no altera el split."""
    reserva_id, data = _cerrar_devolucion(client, db_session, auth_as)
    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)
    assert pago.estado == "pendiente"
    assert pago.referencia_pago is None
    assert pago.monto == data["liquidacion_dueno"]


def test_cuenta_0000_reintenta_hasta_el_maximo_y_se_detiene(client, db_session, auth_as, bci_on):
    dueno = _dueno(db_session)
    dueno.cuenta_bancaria = None
    db_session.commit()
    # cuenta cuyo número termina en 0000 -> el mock de BCI la rechaza siempre
    cc.agregar(
        db_session, dueno,
        banco="BancoEstado", tipo_cuenta="Cuenta Corriente",
        numero="11110000", titular=dueno.nombre or "Dueño", rut="11.111.111-1",
    )

    reserva_id, data = _cerrar_devolucion(client, db_session, auth_as)
    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)

    # el intento inmediato desde delivery ya dejó 1 fallo
    assert pago.estado == "fallido"
    assert pago.intentos_liquidacion == 1

    # barridos sucesivos: sube a MAX y ahí se queda (el filtro intentos < MAX
    # lo saca del candidato -> no hay loop infinito)
    for _ in range(6):
        resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    db_session.expire_all()
    pago = _liquidacion(db_session, reserva_id)
    assert pago.estado == "fallido"
    assert pago.intentos_liquidacion == liq.MAX_INTENTOS_LIQUIDACION

    # una pasada más no lo vuelve a intentar
    resumen = liq.ejecutar_liquidaciones_pendientes(db_session)
    assert resumen["intentadas"] == 0

    # se avisó al dueño y a los admins del fallo definitivo
    assert (
        db_session.query(Notificacion)
        .filter(
            Notificacion.usuario_id == dueno.id,
            Notificacion.titulo == "No pudimos depositar tu liquidación",
        )
        .first()
        is not None
    )
    assert (
        db_session.query(Notificacion)
        .filter(Notificacion.titulo == "Liquidación a dueño falló definitivamente")
        .first()
        is not None
    )
