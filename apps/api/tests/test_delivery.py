from app.models.entities import Reserva, Disputa

def test_flujo_completo_entrega_y_checklist(client, db_session):
    # 1. Obtener la reserva demo
    reserva = db_session.query(Reserva).first()
    assert reserva is not None

    # 2. Cliente genera código QR
    resp_qr = client.post(f"/api/v1/reservas/{reserva.id}/generar-codigo")
    assert resp_qr.status_code == 200
    qr_data = resp_qr.json()
    assert "codigo_qr_hash" in qr_data
    qr_hash = qr_data["codigo_qr_hash"]

    # 3. Dueño valida código QR
    resp_val = client.post("/api/v1/entrega/validar-codigo", json={"codigo_qr_hash": qr_hash})
    assert resp_val.status_code == 200
    val_data = resp_val.json()
    assert val_data["reserva_id"] == reserva.id
    assert val_data["auto_patente"] == "BBCL-10"

    # 4. Dueño confirma verificación de identidad exitosa
    resp_conf = client.post(
        f"/api/v1/entrega/{reserva.id}/confirmar-verificacion",
        json={"resultado": "confirmada", "tipo": "entrega"}
    )
    assert resp_conf.status_code == 200
    assert resp_conf.json()["siguiente_paso"] == "checklist_fotos"

    # 5. Dueño completa checklist 'antes' (inicia el arriendo)
    resp_check_antes = client.post(
        f"/api/v1/entrega/{reserva.id}/checklist",
        json={
            "tipo": "antes",
            "fotos": ["https://ejemplo.com/foto1.jpg", "https://ejemplo.com/foto2.jpg"],
            "kilometraje": 25000,
            "nivel_combustible": "lleno",
            "notas": "Auto en perfecto estado sin rayones."
        }
    )
    assert resp_check_antes.status_code == 200
    assert resp_check_antes.json()["estado_reserva"] == "en_curso"

    # 6. Al devolver el auto: Dueño completa checklist 'despues' con suciedad estándar
    resp_check_despues = client.post(
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

def test_rechazo_identidad_crea_disputa_y_bloquea(client, db_session):
    reserva = db_session.query(Reserva).first()
    assert reserva is not None

    # Dueño rechaza la identidad con foto y motivo
    resp_rechazo = client.post(
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
