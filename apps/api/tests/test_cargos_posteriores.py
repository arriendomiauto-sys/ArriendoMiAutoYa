"""
POST /reservas/{id}/aplicar-multa ya NO maneja peajes/TAG ni fotomultas
("cargo posterior") — esa rama solo simulaba el cobro (un Pago con
referencia inventada `MP-FINE-{uuid}`, sin mover dinero real). El cobro
real de peajes/TAG y multas de tránsito vive en
POST /reservas/{id}/cobro-posterior (test_pagos_duales.py), que sí carga
la tarjeta de crédito de garantía. Este archivo cubre lo que le queda a
aplicar-multa: faltas simples, y que "peajes_tag"/"fotomulta" ya no sean
valores aceptados.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, Reserva


def _crear_reserva_finalizada(db_session, cliente, dueno, dias_atras=10, patente="PEAJ-01"):
    auto = Auto(
        dueno_id=dueno.id,
        marca="Toyota",
        modelo="RAV4",
        anio=2022,
        patente=patente,
        tarifa_dia=40000,
        ubicacion_base="Plaza de Armas, Los Ángeles",
        doc_inscripcion_url="https://ejemplo.com/padron.jpg",
        doc_permiso_circulacion_url="https://ejemplo.com/permiso.jpg",
        doc_soap_url="https://ejemplo.com/soap.jpg",
        doc_revision_tecnica_url="https://ejemplo.com/prt.jpg",
        documentos_verificados=True,
        gps_consentimiento=True,
    )
    db_session.add(auto)
    db_session.commit()
    db_session.refresh(auto)

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva = Reserva(
        auto_id=auto.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora - timedelta(days=dias_atras + 3),
        fecha_fin=ahora - timedelta(days=dias_atras),
        estado="finalizada",
        monto_hold=120000,
        lugar_entrega_acordado="Plaza de Armas, Los Ángeles",
    )
    db_session.add(reserva)
    db_session.commit()
    db_session.refresh(reserva)
    return auto, reserva


def test_aplicar_multa_ya_no_acepta_peajes_tag_ni_fotomulta(usuario_factory, auth_as, db_session):
    """
    Antes esto pasaba con 200 y dejaba un Pago "capturado" con referencia
    MP-FINE-{uuid} sin haber cobrado nada de verdad. Ahora el schema
    rechaza el tipo directamente (422): el cobro real de peajes/TAG y
    fotomultas es POST /reservas/{id}/cobro-posterior.
    """
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno)

    for tipo in ("peajes_tag", "fotomulta"):
        resp = auth_as(dueno).post(
            f"/api/v1/reservas/{reserva.id}/aplicar-multa",
            json={"tipo": tipo, "monto_clp": 8450, "motivo": "Boleta de peajes durante el arriendo"},
        )
        assert resp.status_code == 422, resp.text


def test_multa_comun_no_exige_fecha_ni_boleta(usuario_factory, auth_as, db_session):
    """Las faltas que el dueño constata en la devolución siguen operando igual."""
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, patente="PEAJ-07")

    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "fumar",
            "motivo": "Olor a cigarro y ceniza en el habitáculo",
            "fotos": ["https://ejemplo.com/ceniza.jpg"],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["cargo_falta_grave_clp"] == 50000


def test_contrato_incluye_la_clausula_que_autoriza_el_cobro_posterior():
    """
    Sin esta cláusula el cobro posterior no tiene respaldo: el arrendatario
    nunca autorizó que se le cargue algo a la tarjeta una vez cerrado el
    arriendo. (Esta cláusula respalda POST /cobro-posterior, no
    aplicar-multa.)
    """
    from app.services.contract import clausula_peajes_tag

    texto = clausula_peajes_tag(45)
    assert "PEAJES, TAG Y MULTAS DE TRÁNSITO" in texto
    assert "autoriza expresamente" in texto
    assert "45 días" in texto
    assert "titular de la patente" in texto


def test_contrato_pdf_de_la_reserva_se_genera(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, patente="PEAJ-08")

    resp = auth_as(cliente).get(f"/api/v1/reservas/{reserva.id}/contrato-pdf")
    assert resp.status_code == 200, resp.text
    assert resp.content[:4] == b"%PDF"
