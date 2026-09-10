from app.models.entities import Reserva, Usuario, ChecklistAuto


def test_analisis_ia_danos_limpio(client, db_session, auth_as):
    """Prueba que el peritaje IA sin daños reporta bajas probabilidades y carrocería óptima."""
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    resp = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/analisis-ia",
        json={
            "fotos_despues": ["https://ejemplo.com/foto1.jpg", "https://ejemplo.com/foto2.jpg"],
            "notas": None,
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["anomalia_detectada"] is False
    assert data["probabilidades"]["rayon"] <= 10
    assert data["probabilidades"]["choque"] == 0
    assert data["confianza_general"] >= 90
    assert "óptimas condiciones" in data["sugerencia_dueno"]


def test_analisis_ia_danos_con_rayon(client, db_session, auth_as):
    """Prueba que el peritaje IA detecta rayón cuando se reporta y calibra la probabilidad a 90%."""
    reserva = db_session.query(Reserva).first()
    dueno = db_session.query(Usuario).filter(Usuario.email == "dueno@arriendatuauto.cl").first()

    resp = auth_as(dueno).post(
        f"/api/v1/entrega/{reserva.id}/analisis-ia",
        json={
            "fotos_despues": ["https://ejemplo.com/foto1.jpg", "https://ejemplo.com/foto2.jpg"],
            "notas": "[Rayón] Rayón visible en la puerta del copiloto",
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["anomalia_detectada"] is True
    assert data["probabilidades"]["rayon"] == 90
    assert len(data["danos_detectados"]) >= 1
    assert data["danos_detectados"][0]["probabilidad_pct"] == 90
    assert "Rayón" in data["danos_detectados"][0]["tipo"]


def test_analisis_ia_acceso_denegado_usuario_ajeno(client, db_session, auth_as, usuario_factory):
    """Un usuario ajeno no puede espiar el peritaje IA de una reserva."""
    reserva = db_session.query(Reserva).first()
    ajeno = usuario_factory(email="ajeno_peritaje@test.cl")

    resp = auth_as(ajeno).post(
        f"/api/v1/entrega/{reserva.id}/analisis-ia",
        json={"fotos_despues": ["https://ejemplo.com/f.jpg"]}
    )
    assert resp.status_code == 403
