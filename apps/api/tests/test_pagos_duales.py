"""
Pago dual (cobro del arriendo a débito + hold de garantía a crédito) con la
bóveda multi-tarjeta.

Todo corre en modo simulado (PAGOS_SIMULADOS=True por config de dev): la app
manda tokens falsos `SIMULADO-DEBITO-<4>` / `SIMULADO-CREDITO-<4>` y la pasarela
no sale a la red. Convención: una tarjeta terminada en 0000 siempre rechaza.
"""
from datetime import datetime, timedelta

from app.models.entities import Auto, Reserva


# ===========================================================================
# Helpers
# ===========================================================================
def _auto(db_session, dueno, **kw):
    auto = Auto(
        dueno_id=dueno.id, marca="Kia", modelo="Rio", anio=2022,
        patente=kw.get("patente", "PGAA-11"), tarifa_dia=kw.get("tarifa_dia", 20000),
        estado="activo", ubicacion_base="Los Ángeles",
        categoria=kw.get("categoria", "economico"),
    )
    db_session.add(auto)
    db_session.commit()
    return auto


def _agregar_tarjeta(auth_as, usuario, token, payment_method_id="visa"):
    return auth_as(usuario).post(
        "/api/v1/usuarios/me/tarjetas",
        json={"card_token": token, "payment_method_id": payment_method_id},
    )


def _crear_reserva(auth_as, cliente, auto):
    return auth_as(cliente).post(
        "/api/v1/reservas",
        json={
            "auto_id": auto.id,
            "fecha_inicio": "2027-01-05T10:00:00",
            "fecha_fin": "2027-01-08T10:00:00",
            "lugar_entrega_acordado": "Plaza de Armas",
        },
    )


def _firmar(auth_as, cliente, reserva_id):
    return auth_as(cliente).post(
        f"/api/v1/reservas/{reserva_id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )


# ===========================================================================
# Bóveda de tarjetas
# ===========================================================================
def test_agregar_tarjetas_debito_y_credito(usuario_factory, auth_as, db_session):
    user = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado",
                           tarjeta_estado="pendiente")

    r1 = _agregar_tarjeta(auth_as, user, "SIMULADO-DEBITO-4242", "visadebito")
    assert r1.status_code == 201, r1.text
    assert r1.json()["tarjeta"]["tipo"] == "debito"
    assert r1.json()["tarjeta"]["predeterminada_cobro"] is True

    r2 = _agregar_tarjeta(auth_as, user, "SIMULADO-CREDITO-1111")
    assert r2.status_code == 201, r2.text
    assert r2.json()["tarjeta"]["tipo"] == "credito"
    assert r2.json()["tarjeta"]["predeterminada_garantia"] is True

    listado = auth_as(user).get("/api/v1/usuarios/me/tarjetas").json()["tarjetas"]
    assert len(listado) == 2

    # El gate de "puede operar" se satisface con ≥1 tarjeta validada.
    db_session.refresh(user)
    assert user.tarjeta_estado == "validada"

    me = auth_as(user).get("/api/v1/usuarios/me").json()
    assert me["tarjeta_estado"] == "validada"


def test_tarjeta_duplicada_se_rechaza(usuario_factory, auth_as):
    user = usuario_factory(estado_documentos="verificado")
    assert _agregar_tarjeta(auth_as, user, "SIMULADO-DEBITO-4242").status_code == 201
    dup = _agregar_tarjeta(auth_as, user, "SIMULADO-DEBITO-4242")
    assert dup.status_code == 409
    assert dup.json()["detail"]["codigo"] == "TARJETA_DUPLICADA"


def test_no_se_puede_agregar_tarjeta_sin_identidad(usuario_factory, auth_as):
    user = usuario_factory(estado_documentos="pendiente")
    assert _agregar_tarjeta(auth_as, user, "SIMULADO-DEBITO-4242").status_code == 403


def test_token_real_de_key_test_usa_las_pistas_de_la_app(usuario_factory, auth_as):
    """
    Con una llave `TEST-` la app tokeniza contra Mercado Pago de verdad (el token
    NO tiene prefijo SIMULADO-). Si el backend está en modo simulado no puede
    consultar la tarjeta en MP: usa `tipo` / `ultimos4` / `marca` que manda la app.
    """
    user = usuario_factory(estado_documentos="verificado", tarjeta_estado="pendiente")
    resp = auth_as(user).post(
        "/api/v1/usuarios/me/tarjetas",
        json={
            "card_token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",  # token estilo MP real
            "payment_method_id": "master",
            "tipo": "debito",
            "ultimos4": "9012",
            "marca": "mastercard",
        },
    )
    assert resp.status_code == 201, resp.text
    t = resp.json()["tarjeta"]
    assert t["tipo"] == "debito"
    assert t["ultimos4"] == "9012"
    assert t["marca"] == "mastercard"


def test_token_real_sin_pista_de_tipo_se_rechaza_claro(usuario_factory, auth_as):
    user = usuario_factory(estado_documentos="verificado")
    resp = auth_as(user).post(
        "/api/v1/usuarios/me/tarjetas",
        json={"card_token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4", "payment_method_id": "visa"},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["codigo"] == "TARJETA_TIPO_DESCONOCIDO"


# ===========================================================================
# Checkout
# ===========================================================================
def test_pago_dual_confirma_la_reserva(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado", patente=None)
    auto = _auto(db_session, dueno, patente="PGOK-12", tarifa_dia=20000, categoria="suv")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")

    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]

    reserva = _crear_reserva(auth_as, cliente, auto).json()
    assert reserva["estado"] == "pendiente_pago"
    assert reserva["monto_cobro"] == 60000              # 3 días × 20.000
    assert reserva["garantia"]["monto"] == 500000       # garantía default "suv"

    assert _firmar(auth_as, cliente, reserva["id"]).status_code == 200

    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    assert pago.status_code == 200, pago.text
    assert pago.json()["estado"] == "confirmada"

    r = db_session.query(Reserva).filter(Reserva.id == reserva["id"]).first()
    assert r.estado == "confirmada"
    assert r.tarjeta_cobro_id == deb["id"]
    tipos = {p.tipo: p for p in r.pagos}
    assert tipos["cobro_arriendo"].estado == "capturado"
    assert tipos["hold_reserva"].estado == "retenido"


def test_pagar_exige_firmar_el_contrato_antes(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGNF-13")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]
    reserva = _crear_reserva(auth_as, cliente, auto).json()

    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    assert pago.status_code == 409
    assert pago.json()["detail"]["codigo"] == "CONTRATO_NO_FIRMADO"


def test_pagar_con_tipo_de_tarjeta_equivocado(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGTT-14")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]
    reserva = _crear_reserva(auth_as, cliente, auto).json()
    _firmar(auth_as, cliente, reserva["id"])

    # Se invierten los roles: crédito para el cobro, débito para la garantía.
    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": cred["id"], "tarjeta_garantia_id": deb["id"]},
    )
    assert pago.status_code == 402
    assert pago.json()["detail"]["codigo"] == "TARJETA_TIPO_INVALIDO"
    assert pago.json()["detail"]["campo"] == "cobro"


def test_cobro_rechazado_no_deja_garantia_retenida(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGRJ-15")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-0000").json()["tarjeta"]   # rechaza
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]
    reserva = _crear_reserva(auth_as, cliente, auto).json()
    _firmar(auth_as, cliente, reserva["id"])

    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    assert pago.status_code == 402
    assert pago.json()["detail"]["codigo"] == "COBRO_RECHAZADO"

    r = db_session.query(Reserva).filter(Reserva.id == reserva["id"]).first()
    assert r.estado == "pendiente_pago"
    assert r.pagos == []          # atómico: no se persistió ningún movimiento


def test_garantia_sin_cupo(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGSC-16")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-0000").json()["tarjeta"]  # rechaza
    reserva = _crear_reserva(auth_as, cliente, auto).json()
    _firmar(auth_as, cliente, reserva["id"])

    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    assert pago.status_code == 402
    assert pago.json()["detail"] == {
        "codigo": "SIN_CUPO", "campo": "garantia",
        "mensaje": "Tu tarjeta de crédito no tiene cupo para la garantía.",
    }


def test_reserva_expirada(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGEX-17")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]
    reserva = _crear_reserva(auth_as, cliente, auto).json()
    _firmar(auth_as, cliente, reserva["id"])

    r = db_session.query(Reserva).filter(Reserva.id == reserva["id"]).first()
    r.expira_en = datetime.utcnow() - timedelta(minutes=1)
    db_session.commit()

    pago = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )
    assert pago.status_code == 409
    assert pago.json()["detail"]["codigo"] == "RESERVA_EXPIRADA"
    db_session.refresh(r)
    assert r.estado == "cancelada"


def test_no_se_puede_borrar_tarjeta_en_uso(usuario_factory, auth_as, db_session):
    dueno = usuario_factory(roles_activos=["dueno"], estado_documentos="verificado")
    auto = _auto(db_session, dueno, patente="PGEU-18")
    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-4242").json()["tarjeta"]
    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-1111").json()["tarjeta"]
    reserva = _crear_reserva(auth_as, cliente, auto).json()
    _firmar(auth_as, cliente, reserva["id"])
    auth_as(cliente).post(
        f"/api/v1/reservas/{reserva['id']}/pagar",
        json={"tarjeta_cobro_id": deb["id"], "tarjeta_garantia_id": cred["id"]},
    )

    borrar = auth_as(cliente).delete(f"/api/v1/usuarios/me/tarjetas/{deb['id']}")
    assert borrar.status_code == 409
    assert borrar.json()["detail"]["codigo"] == "TARJETA_EN_USO"


def test_completar_enrolamiento_ya_no_exige_tarjeta(usuario_factory, auth_as):
    """El KYC verifica identidad; la tarjeta se agrega después desde la bóveda."""
    nuevo = usuario_factory(roles_activos=["cliente"], rut=None, nombre=None,
                            estado_documentos="pendiente")
    resp = auth_as(nuevo).post(
        "/api/v1/enrolamiento/completar",
        json={
            "nombre": "Cliente Sin Tarjeta",
            "rut": "17.123.456-5",
            "email": "cliente.sintarjeta@test.cl",
            "telefono": "+56912345678",
            "carnet_frontal_url": "https://ejemplo.com/carnet_front.jpg",
            "foto_perfil_verificada_url": "https://ejemplo.com/selfie.jpg",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_documentos"] == "verificado"


def test_bloqueo_eliminacion_tarjeta_30_dias_post_arriendo(usuario_factory, auth_as, db_session):
    """Una tarjeta de crédito que garantizó un arriendo no se puede borrar durante 30 días tras el fin."""
    from datetime import datetime, timedelta, timezone
    from app.models.entities import Auto, Reserva

    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto(db_session, dueno, patente="SWFT-12")

    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-5555").json()["tarjeta"]
    deb = _agregar_tarjeta(auth_as, cliente, "SIMULADO-DEBITO-1111", "visadebito").json()["tarjeta"]

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=ahora - timedelta(days=10),
        fecha_fin=ahora - timedelta(days=5),
        estado="finalizada",
        tarjeta_cobro_id=deb["id"],
        tarjeta_garantia_id=cred["id"],
        lugar_entrega_acordado="Santiago Centro",
    )
    db_session.add(reserva)
    db_session.commit()

    # Intentar eliminar la tarjeta de crédito asociada a la garantía
    borrar = auth_as(cliente).delete(f"/api/v1/usuarios/me/tarjetas/{cred['id']}")
    assert borrar.status_code == 409
    assert borrar.json()["detail"]["codigo"] == "TARJETA_EN_PERIODO_POST_ARRIENDO"


def test_cobro_posterior_tag_con_tarjeta_credito_vault(usuario_factory, auth_as, db_session):
    """El dueño puede cobrar TAG o multas hasta 30 días después usando la tarjeta de crédito de la garantía."""
    from datetime import datetime, timedelta, timezone
    from app.models.entities import Auto, Reserva

    cliente = usuario_factory(roles_activos=["cliente"], estado_documentos="verificado")
    dueno = usuario_factory(roles_activos=["dueno"])
    auto = _auto(db_session, dueno, patente="TUCS-99")

    cred = _agregar_tarjeta(auth_as, cliente, "SIMULADO-CREDITO-4444").json()["tarjeta"]

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id, cliente_id=cliente.id,
        fecha_inicio=ahora - timedelta(days=12),
        fecha_fin=ahora - timedelta(days=7),
        estado="finalizada",
        tarjeta_garantia_id=cred["id"],
        lugar_entrega_acordado="Providencia",
    )
    db_session.add(reserva)
    db_session.commit()

    # Cobro posterior emitido por el dueño
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/cobro-posterior",
        json={
            "tipo": "tag",
            "monto": 14500,
            "descripcion": "Peaje Autopista Central 3 pasadas durante el fin de semana del arriendo",
            "comprobante_url": "https://supabase.co/storage/v1/object/authenticated/evidencias/boleta_tag.pdf",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["monto"] == 14500
    assert data["tipo"] == "tag"
    assert data["estado"] == "capturado"
