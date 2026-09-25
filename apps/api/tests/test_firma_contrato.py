"""
Firma del contrato de arriendo: se firma EN LA ENTREGA, con las dos partes
juntas (identidad verificada en persona) y después de las fotos. Queda un
registro por parte con método, instante UTC y hash del documento firmado.
"""
from app.models.entities import Reserva, Usuario, Auto, FirmaContrato

FOTO = "https://ejemplo.com/f1.jpg"


def _partes(db_session):
    reserva = db_session.query(Reserva).first()
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    auto = db_session.query(Auto).filter(Auto.id == reserva.auto_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.id == auto.dueno_id).first()
    return reserva, cliente, dueno


def _checklist_antes(auth_as, dueno, reserva, **extra):
    body = {"tipo": "antes", "fotos": [FOTO], "kilometraje": 25000, "nivel_combustible": "lleno", **extra}
    return auth_as(dueno).post(f"/api/v1/entrega/{reserva.id}/checklist", json=body)


def test_no_se_puede_firmar_antes_de_la_entrega(db_session, auth_as):
    """Ni al pagar ni al confirmar: sin la verificación en persona no hay firma."""
    reserva, cliente, dueno = _partes(db_session)
    for quien in (cliente, dueno):
        resp = auth_as(quien).post(
            f"/api/v1/reservas/{reserva.id}/firmar-contrato",
            json={"metodo": "huella", "acepta_terminos": True},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["detail"]["categoria"] == "firma_fuera_de_la_entrega"
    assert db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id).count() == 0


def test_en_la_entrega_el_dueno_firma_con_huella(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["rol"] == "arrendador"
    assert data["metodo"] == "huella"
    assert data["hash_contrato_sha256"]
    assert data["firmado_en"]


def test_firma_escrita_requiere_trazo(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "escrita", "acepta_terminos": True},
    )
    assert resp.status_code == 400
    resp_ok = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "escrita", "firma_svg": "M1 1 L10 10 L20 5", "acepta_terminos": True},
    )
    assert resp_ok.status_code == 200
    firma = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendador").first()
    assert firma.firma_svg == "M1 1 L10 10 L20 5"


def test_firma_exige_aceptar_terminos(db_session, auth_as, preparar_entrega):
    reserva, cliente, _ = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    resp = auth_as(cliente).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "facial", "acepta_terminos": False},
    )
    assert resp.status_code == 400


def test_un_extrano_no_puede_firmar(db_session, auth_as, usuario_factory, preparar_entrega):
    reserva, _, _ = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    intruso = usuario_factory(roles_activos=["cliente"])
    resp = auth_as(intruso).post(
        f"/api/v1/reservas/{reserva.id}/firmar-contrato",
        json={"metodo": "huella", "acepta_terminos": True},
    )
    assert resp.status_code == 403


def test_re_firmar_reemplaza_sin_duplicar(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    for metodo in ("huella", "escrita"):
        body = {"metodo": metodo, "acepta_terminos": True}
        if metodo == "escrita":
            body["firma_svg"] = "M0 0 L5 5"
        auth_as(dueno).post(f"/api/v1/reservas/{reserva.id}/firmar-contrato", json=body)
    firmas = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendador").all()
    assert len(firmas) == 1
    assert firmas[0].metodo == "escrita"


def test_la_entrega_exige_la_firma_del_dueno(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva, con_firma_dueno=False)
    resp = _checklist_antes(auth_as, dueno, reserva, firma_svg="M1 1 L2 2")
    assert resp.status_code == 409, resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"


def test_la_entrega_exige_la_firma_del_arrendatario(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva)
    resp = _checklist_antes(auth_as, dueno, reserva)
    assert resp.status_code == 400, resp.text
    db_session.refresh(reserva)
    assert reserva.estado == "confirmada"


def test_con_ambas_firmas_en_la_entrega_el_contrato_queda_firmado(db_session, auth_as, preparar_entrega):
    reserva, cliente, dueno = _partes(db_session)
    preparar_entrega(reserva)
    db_session.refresh(reserva)
    assert reserva.fecha_firma_biometrica is None  # falta el arrendatario

    resp = _checklist_antes(auth_as, dueno, reserva, firma_svg="M 15 25 L 35 45")
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_reserva"] == "en_curso"
    db_session.refresh(reserva)
    assert reserva.fecha_firma_biometrica is not None
    assert reserva.hash_contrato_sha256

    detalle = auth_as(cliente).get(f"/api/v1/reservas/{reserva.id}").json()
    assert sorted(f["rol"] for f in detalle["firmas"]) == ["arrendador", "arrendatario"]
    firma_cliente = db_session.query(FirmaContrato).filter_by(reserva_id=reserva.id, rol="arrendatario").one()
    assert firma_cliente.metodo == "escrita" and firma_cliente.firma_svg == "M 15 25 L 35 45"


def test_contrato_pdf_integra_la_firma_de_la_entrega(db_session, auth_as, preparar_entrega):
    reserva, _, dueno = _partes(db_session)
    preparar_entrega(reserva)
    assert _checklist_antes(auth_as, dueno, reserva, firma_svg="M 15 25 L 35 45 L 55 15").status_code == 200

    resp_pdf = auth_as(dueno).get(f"/api/v1/reservas/{reserva.id}/contrato-pdf")
    assert resp_pdf.status_code == 200
    assert resp_pdf.headers["content-type"] == "application/pdf"
    assert resp_pdf.headers.get("X-Contract-SHA256")
    assert resp_pdf.content.startswith(b"%PDF-")
    assert len(resp_pdf.content) > 4000
