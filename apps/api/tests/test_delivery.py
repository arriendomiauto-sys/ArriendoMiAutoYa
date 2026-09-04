from app.models.entities import Reserva, Disputa, Usuario, ChecklistAuto

def test_flujo_completo_entrega_y_checklist(client, db_session, auth_as):
    # 1. Obtener la reserva demo
    reserva = db_session.query(Reserva).first()
    assert reserva is not None
    cliente = db_session.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    # 2. Cliente genera código QR
    resp_qr = auth_as(cliente).post(f"/api/v1/reservas/{reserva.id}/generar-codigo")
    assert resp_qr.status_code == 200
    qr_data = resp_qr.json()
    assert "codigo_qr_hash" in qr_data
    qr_hash = qr_data["codigo_qr_hash"]

    # 3. Dueño valida código QR
    resp_val = auth_as(dueno).post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr_hash})
    assert resp_val.status_code == 200
    val_data = resp_val.json()
    assert val_data["reserva_id"] == reserva.id
    assert val_data["auto_patente"] == "BBCL-10"

    # 4. Dueño confirma verificación de identidad exitosa
    resp_conf = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"}
    )
    assert resp_conf.status_code == 200
    assert resp_conf.json()["siguiente_paso"] == "checklist_fotos"

    # 5. Dueño completa checklist 'antes' (inicia el arriendo)
    resp_check_antes = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/foto1.jpg", "https://ejemplo.com/foto2.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
            "notas": "Auto en perfecto estado sin rayones.",
            "firma_svg": "M1 1L2 2",
        }
    )
    assert resp_check_antes.status_code == 200
    assert resp_check_antes.json()["estado_reserva"] == "en_curso"

    # 6. Al devolver el auto: Dueño completa checklist 'despues' con suciedad estándar
    resp_check_despues = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "despues",
            "fotos": ["https://ejemplo.com/foto_final.jpg"],
            "kilometraje": 25300,
            "nivel_combustible": "lleno",
            "estado_limpieza": "sucio_estandar",
            "notas": "Devuelto con barro en carrocería; se aplica cargo de lavado estándar."
        }
    )
    assert resp_check_despues.status_code == 200
    data_final = resp_check_despues.json()
    assert data_final["estado_reserva"] == "finalizada"
    assert data_final["monto_cobro_final"] > 0
    assert data_final["cargo_limpieza"] == 15000
    assert data_final["liquidacion_dueno"] > 0

def test_checklist_antes_guarda_la_firma_svg(client, db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    trazo = "M10 10 L20 20 L30 10"
    resp = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/foto1.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
            "firma_svg": trazo,
        }
    )
    assert resp.status_code == 200, resp.text

    checklist = (
        db_session.query(ChecklistAuto)
        .filter(ChecklistAuto.reserva_id == reserva.id, ChecklistAuto.tipo == "antes")
        .first()
    )
    assert checklist.firma_svg == trazo


def test_checklist_antes_sin_firma_es_rechazado(client, db_session, auth_as):
    """La app deshabilita el botón de firmar sin trazo — esto es la misma
    exigencia del lado servidor, para no depender solo del cliente."""
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    resp = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/foto1.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
        }
    )
    assert resp.status_code == 400
    assert (
        db_session.query(ChecklistAuto)
        .filter(ChecklistAuto.reserva_id == reserva.id, ChecklistAuto.tipo == "antes")
        .first()
        is None
    )


def test_checklist_despues_no_necesita_firma(client, db_session, auth_as):
    """El checklist 'despues' (devolución) no pide firma: solo se firma al
    entregar, no al devolver."""
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()
    c = auth_as(dueno)

    c.post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/foto1.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
            "firma_svg": "M1 1L2 2",
        }
    )

    resp = c.post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "despues",
            "fotos": ["https://ejemplo.com/foto_final.jpg"],
            "kilometraje": 25100,
            "nivel_combustible": "lleno",
        }
    )
    assert resp.status_code == 200, resp.text
    checklist = (
        db_session.query(ChecklistAuto)
        .filter(ChecklistAuto.reserva_id == reserva.id, ChecklistAuto.tipo == "despues")
        .first()
    )
    assert checklist.firma_svg is None


def test_rechazo_identidad_crea_disputa_y_bloquea(client, db_session, auth_as):
    reserva = db_session.query(Reserva).first()
    assert reserva is not None
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    # Dueño rechaza la identidad con foto y motivo
    resp_rechazo = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={
            "resultado": "rechazada",
            "tipo": "entrega",
            "foto_evidencia_url": "https://ejemplo.com/foto_persona_no_coincide.jpg",
            "motivo_rechazo": "La persona que se presentó no coincide con la foto de perfil del carnet."
        }
    )
    assert resp_rechazo.status_code == 200
    data = resp_rechazo.json()
    assert data["estado_reserva"] == "disputada"
    assert data["siguiente_paso"] == "bloqueado_esperando_resolucion"
    assert data["disputa_id"] is not None

    # Verificar que se creó el registro de disputa formal en la BD
    disputa = db_session.query(Disputa).filter(Disputa.id == data["disputa_id"]).first()
    assert disputa is not None
    assert disputa.tipo == "no_coincidencia_identidad"
    assert disputa.estado == "abierta"
