"""
Cobro posterior de peajes/TAG y fotomultas.

Las autopistas urbanas son de flujo libre y no existe una API nacional de TAG:
la boleta llega semanas después del arriendo y siempre a nombre del titular de
la patente. Por eso el cargo se imputa al arrendatario después de cerrada la
reserva, pero solo si el evento ocurrió durante su arriendo, viene respaldado
por la boleta y todavía corre el plazo configurado.
"""
from datetime import datetime, timedelta, timezone

from app.models.entities import Auto, ConfiguracionPlataforma, Pago, Reserva


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


def test_peaje_dentro_de_la_ventana_se_cobra_y_se_abona_al_dueno(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno)

    fecha_portico = reserva.fecha_inicio + timedelta(days=1)
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "monto_clp": 8450,
            "motivo": "Boleta Autopista Central, 3 pórticos durante el arriendo",
            "fecha_evento": fecha_portico.isoformat(),
            "documento_url": "https://ejemplo.com/boleta-autopista.pdf",
        },
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["cargo_falta_grave_clp"] == 8450
    # Es el dueño quien le paga a la concesionaria: el 100% se le abona a él.
    assert data["liquidacion_dueno_clp"] == 8450

    detalle = data["multas_detalle"][0]
    assert detalle["tipo"] == "peajes_tag"
    assert detalle["es_cargo_posterior"] is True
    assert detalle["documento_url"] == "https://ejemplo.com/boleta-autopista.pdf"

    pago = db_session.query(Pago).filter(Pago.reserva_id == reserva.id).first()
    assert pago is not None and pago.monto == 8450


def test_fotomulta_fuera_del_periodo_de_arriendo_se_rechaza(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, patente="PEAJ-02")

    # El parte es de dos días después de la devolución: el auto ya no lo tenía.
    fecha_infraccion = reserva.fecha_fin + timedelta(days=2)
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "fotomulta",
            "monto_clp": 65000,
            "motivo": "Parte por exceso de velocidad notificado a la patente",
            "fecha_evento": fecha_infraccion.isoformat(),
            "documento_url": "https://ejemplo.com/parte.pdf",
        },
    )

    assert resp.status_code == 400
    assert "fuera del período de arriendo" in resp.json()["detail"]


def test_peaje_pasado_el_plazo_de_imputacion_se_rechaza(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    # Devuelto hace 90 días, con un plazo configurado de 60.
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, dias_atras=90, patente="PEAJ-03")

    fecha_portico = reserva.fecha_inicio + timedelta(days=1)
    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "monto_clp": 5000,
            "motivo": "Boleta de peajes que llegó muy tarde",
            "fecha_evento": fecha_portico.isoformat(),
            "documento_url": "https://ejemplo.com/boleta-tardia.pdf",
        },
    )

    assert resp.status_code == 400
    assert "plazo" in resp.json()["detail"].lower()


def test_peaje_sin_boleta_ni_monto_se_rechaza(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, patente="PEAJ-04")
    fecha_portico = (reserva.fecha_inicio + timedelta(days=1)).isoformat()

    client = auth_as(dueno)

    sin_boleta = client.post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "monto_clp": 4000,
            "motivo": "Peajes del arriendo",
            "fecha_evento": fecha_portico,
        },
    )
    assert sin_boleta.status_code == 400
    assert "boleta" in sin_boleta.json()["detail"].lower()

    sin_monto = client.post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "motivo": "Peajes del arriendo",
            "fecha_evento": fecha_portico,
            "documento_url": "https://ejemplo.com/boleta.pdf",
        },
    )
    assert sin_monto.status_code == 400
    assert "monto" in sin_monto.json()["detail"].lower()


def test_peaje_sin_fecha_de_evento_se_rechaza(usuario_factory, auth_as, db_session):
    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, patente="PEAJ-05")

    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "monto_clp": 4000,
            "motivo": "Peajes del arriendo",
            "documento_url": "https://ejemplo.com/boleta.pdf",
        },
    )
    assert resp.status_code == 400
    assert "fecha" in resp.json()["detail"].lower()


def test_plazo_de_imputacion_es_configurable(usuario_factory, auth_as, db_session):
    """El plazo vive en la configuración de plataforma (RF-33), no hardcodeado."""
    config = db_session.query(ConfiguracionPlataforma).first()
    config.dias_cobro_posterior_peajes = 5
    db_session.commit()

    cliente = usuario_factory(roles_activos=["cliente"])
    dueno = usuario_factory(roles_activos=["dueno"])
    auto, reserva = _crear_reserva_finalizada(db_session, cliente, dueno, dias_atras=10, patente="PEAJ-06")

    resp = auth_as(dueno).post(
        f"/api/v1/reservas/{reserva.id}/aplicar-multa",
        json={
            "tipo": "peajes_tag",
            "monto_clp": 3000,
            "motivo": "Peajes del arriendo",
            "fecha_evento": (reserva.fecha_inicio + timedelta(days=1)).isoformat(),
            "documento_url": "https://ejemplo.com/boleta.pdf",
        },
    )
    assert resp.status_code == 400
    assert "5 días" in resp.json()["detail"]


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
    arriendo.
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
