import pytest
from datetime import datetime, timezone, timedelta
from app.models.entities import Usuario, Auto, Reserva, Tarjeta, CuentaCobro
from app.features.payments import checkout_service
from app.features.auth.onboarding import referrals_service, contract_service


def _fecha(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).strftime("%Y-%m-%dT10:00:00")


def test_bloqueo_reserva_mismo_rut(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], rut="11.111.111-1", estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], rut="11111111-1", estado_documentos="verificado")

    auto = Auto(
        patente="TEST01", marca="Toyota", modelo="Yaris", anio=2023,
        categoria="economico", dueno_id=dueno.id, tarifa_dia=35000,
        ubicacion_base="Santiago", estado="activo",
    )
    db_session.add(auto)
    db_session.commit()

    payload = {
        "auto_id": auto.id,
        "fecha_inicio": _fecha(60),
        "fecha_fin": _fecha(63),
        "lugar_entrega_acordado": "Metro Los Leones",
    }
    resp = auth_as(cliente).post("/api/v1/reservas", json=payload)
    assert resp.status_code == 400, resp.text
    assert "mismo RUT" in resp.json()["detail"]


def test_bloqueo_reserva_cuenta_bancaria_compartida(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], rut="12.345.678-5", estado_documentos="verificado")
    cliente = usuario_factory(roles_activos=["cliente"], rut="98.765.432-1", estado_documentos="verificado")

    # Mismo número de cuenta bancaria registrado para ambos
    cuenta_dueno = CuentaCobro(
        usuario_id=dueno.id, banco="Banco de Chile", tipo_cuenta="corriente",
        numero="1234567890", titular="Dueno", rut="12.345.678-5", predeterminada=True,
    )
    cuenta_cliente = CuentaCobro(
        usuario_id=cliente.id, banco="Banco de Chile", tipo_cuenta="corriente",
        numero="123-456-789-0", titular="Cliente", rut="98.765.432-1", predeterminada=True,
    )
    db_session.add_all([cuenta_dueno, cuenta_cliente])

    auto = Auto(
        patente="TEST02", marca="Kia", modelo="Rio", anio=2022,
        categoria="economico", dueno_id=dueno.id, tarifa_dia=30000,
        ubicacion_base="Santiago", estado="activo",
    )
    db_session.add(auto)
    db_session.commit()

    payload = {
        "auto_id": auto.id,
        "fecha_inicio": _fecha(60),
        "fecha_fin": _fecha(63),
        "lugar_entrega_acordado": "Santiago Centro",
    }
    resp = auth_as(cliente).post("/api/v1/reservas", json=payload)
    assert resp.status_code == 400, resp.text
    assert "cuenta bancaria compartida" in resp.json()["detail"]


def test_bloqueo_pago_tarjeta_del_dueno(usuario_factory, db_session):
    dueno = usuario_factory(nombre="Pedro Dueno", roles_activos=["dueno"], rut="15.555.555-5", estado_documentos="verificado")
    cliente = usuario_factory(nombre="Maria Cliente", roles_activos=["cliente"], rut="22.222.222-2", estado_documentos="verificado")

    auto = Auto(
        patente="TEST03", marca="Chevrolet", modelo="Sail", anio=2021,
        categoria="economico", dueno_id=dueno.id, tarifa_dia=25000,
        ubicacion_base="Concepción", estado="activo",
    )
    db_session.add(auto)
    db_session.flush()

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=ahora + timedelta(days=1), fecha_fin=ahora + timedelta(days=3),
        lugar_entrega_acordado="Plaza Independencia",
        estado="pendiente_pago", monto_cobro=50000, monto_hold=250000,
    )
    db_session.add(reserva)
    db_session.flush()

    from app.models.entities import FirmaContrato
    firma = FirmaContrato(
        reserva_id=reserva.id, usuario_id=cliente.id, rol="arrendatario",
        metodo="biometrica", hash_contrato_sha256="abc123456789",
    )
    db_session.add(firma)

    # Tarjeta de cobro pertenece al cliente, pero con el titular del dueño (intento de cash advance)
    tc = Tarjeta(
        usuario_id=cliente.id, tipo="debito", mp_card_id="card_deb_1",
        ultimos4="1234", marca="visa", titular=dueno.nombre,
        estado="validada",
    )
    tg = Tarjeta(
        usuario_id=cliente.id, tipo="credito", mp_card_id="card_cred_1",
        ultimos4="5678", marca="mastercard", titular=cliente.nombre,
        estado="validada",
    )
    db_session.add_all([tc, tg])
    db_session.commit()

    with pytest.raises(checkout_service.CheckoutError) as exc_info:
        checkout_service.procesar_pago(db_session, reserva, cliente, tc.id, tg.id)

    assert exc_info.value.codigo == "COLUSION_AUTOFINANCIAMIENTO"
    assert "dueño del vehículo" in str(exc_info.value.mensaje)


def test_bloqueo_referidos_mismo_rut_y_circulares(usuario_factory, db_session):
    u1 = usuario_factory(rut="17.777.777-7")
    u2 = usuario_factory(rut="17777777-7") # Mismo RUT

    codigo1 = referrals_service.obtener_o_generar_codigo(u1, db_session)

    # Intento de referirse a sí mismo con otra cuenta con mismo RUT
    with pytest.raises(ValueError, match="mismo RUT"):
        referrals_service.aplicar_codigo_referido(u2, codigo1, db_session)

    # Intento de referencia circular: A invita a B, luego B intenta invitar a A
    u3 = usuario_factory(rut="18.888.888-8")
    u4 = usuario_factory(rut="19.999.999-9")
    cod3 = referrals_service.obtener_o_generar_codigo(u3, db_session)
    cod4 = referrals_service.obtener_o_generar_codigo(u4, db_session)

    referrals_service.aplicar_codigo_referido(u4, cod3, db_session)
    assert u4.referido_por_id == u3.id

    with pytest.raises(ValueError, match="circulares o recíprocas"):
        referrals_service.aplicar_codigo_referido(u3, cod4, db_session)


def test_clausulas_legales_contrato_pdf():
    # 1. Mandato Juzgado de Policía Local Ley 18.287
    clausula_5 = contract_service.clausula_peajes_tag(30)
    assert "18.287" in clausula_5
    assert "Juzgado de Policía Local" in clausula_5
    assert "mandato especial e irrevocable" in clausula_5
    assert "infractor directo" in clausula_5

    # 2. Generación del contrato PDF con cláusulas de Ley 20.000 y Art. 470 N° 1
    pdf_bytes = contract_service.ContractService.generar_contrato_pdf(
        reserva_id="res-legal-01",
        dueno_nombre="Carlos Dueño",
        dueno_rut="11.111.111-1",
        dueno_telefono="+56 9 1234 5678",
        cliente_nombre="Juan Cliente",
        cliente_rut="22.222.222-2",
        cliente_telefono="+56 9 8765 4321",
        auto_marca="Toyota",
        auto_modelo="RAV4",
        auto_anio=2024,
        auto_patente="CLAU-99",
        fecha_inicio=datetime(2026, 10, 1, 10, 0),
        fecha_fin=datetime(2026, 10, 5, 10, 0),
        lugar_entrega="Plaza de Armas",
        tarifa_dia_clp=45000,
        dias=4,
        monto_total_estimado_clp=180000,
        firmas=[{"rol": "arrendatario", "metodo": "facial", "hash_contrato_sha256": "abcdef1234567890"}],
    )
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 1000
