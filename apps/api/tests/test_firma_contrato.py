"""
Firma del contrato de arriendo: ambas partes (arrendatario y arrendador)
firman con huella, reconocimiento facial o firma manuscrita, y queda un
registro con método, instante UTC y hash del documento firmado.
"""
from app.models.entities import Reserva, Usuario, Auto, FirmaContrato


def _partes(db_session):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    return reserva, cliente, dueno


def test_arrendatario_firma_con_huella(db_session, auth_as):
    reserva, cliente, _ = _partes(db_session)
    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["rol"] == "arrendatario"
    assert data["metodo"] == "huella"
    assert data["hash_contrato_sha256"]
    assert data["firmado_en"]

    firma = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendatario").first()
    assert firma is not None and firma.usuario_id == cliente.id


def test_firma_escrita_requiere_trazo(db_session, auth_as):
    reserva, cliente, _ = _partes(db_session)
    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "escrita", "acepta_terminos": True},
    )
    assert resp.status_code == 400
    resp_ok = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "escrita", "firma_svg": "M1 1 L10 10 L20 5", "acepta_terminos": True},
    )
    assert resp_ok.status_code == 200
    firma = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendatario").first()
    assert firma.firma_svg == "M1 1 L10 10 L20 5"


def test_firma_exige_aceptar_terminos(db_session, auth_as):
    reserva, cliente, _ = _partes(db_session)
    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "facial", "acepta_terminos": False},
    )
    assert resp.status_code == 400


def test_un_extrano_no_puede_firmar(db_session, auth_as, usuario_factory):
    reserva, _, _ = _partes(db_session)
    intruso = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(intruso).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    assert resp.status_code == 403


def test_ambas_partes_firman_marca_fecha_firma(db_session, auth_as):
    reserva, cliente, dueno = _partes(db_session)
    assert reserva.fecha_firma_biometrica is None

    auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    db_session.refresh(reserva)
    assert reserva.fecha_firma_biometrica is None  # falta el arrendador

    r = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "facial", "acepta_terminos": True},
    )
    assert r.status_code == 200
    assert r.json()["rol"] == "arrendador"
    db_session.refresh(reserva)
    assert reserva.fecha_firma_biometrica is not None

    # El detalle de la reserva expone las dos firmas.
    detalle = auth_as(cliente).get(f"/api/v1/reservas/{reserva.id}").json()
    roles = sorted(f["rol"] for f in detalle["firmas"])
    assert roles == ["arrendador", "arrendatario"]


def test_re_firmar_reemplaza_sin_duplicar(db_session, auth_as):
    reserva, cliente, _ = _partes(db_session)
    for metodo in ("huella", "escrita"):
        body = {"metodo": metodo, "acepta_terminos": True}
        if metodo == "escrita":
            body["firma_svg"] = "M0 0 L5 5"
        auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/firmar-contrato", json=body)

    firmas = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendatario").all()
    assert len(firmas) == 1
    assert firmas[0].metodo == "escrita"


def test_checklist_antes_pasa_si_arrendatario_ya_firmo_sin_trazo(db_session, auth_as):
    """Con la firma registrada por la API, la entrega ya no exige el trazo."""
    reserva, cliente, dueno = _partes(db_session)
    auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    # QR + verificación de identidad
    qr = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/generar-codigo").json()["codigo_qr_hash"]
    auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr})
    auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"},
    )
    resp = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/f1.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_reserva"] == "en_curso"
