import pytest
from app.features.auth.onboarding import referrals_service
from app.features.vehicles.catalog.pricing_service import PricingService
from app.models.entities import Usuario, Reserva, Auto


def test_validar_codigo_referido_inexistente(client):
    resp = client.get("/api/v1/usuarios/codigo-referido/NOEXISTE/validar")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valido"] is False
    assert "no existe" in data["mensaje"].lower()


def test_validar_codigo_referido_existente(client, usuario_factory, db_session):
    colaborador = usuario_factory(nombre="Carlos Gomez", roles_activos=["dueno"])
    codigo = referrals_service.obtener_o_generar_codigo(colaborador, db_session)

    resp = client.get(f"/api/v1/usuarios/codigo-referido/{codigo}/validar")
    assert resp.status_code == 200
    data = resp.json()
    assert data["valido"] is True
    assert data["codigo"] == codigo
    assert "Carlos" in data["nombre_referente"]
    assert "15%" in data["mensaje"]


def test_niveles_colaborador_bronce_plata_oro(usuario_factory, db_session):
    colaborador = usuario_factory(nombre="Emilio Promotor", roles_activos=["dueno"])
    codigo = referrals_service.obtener_o_generar_codigo(colaborador, db_session)

    # 1. Sin referidos -> Bronce (15% comisión plataforma, 8% bono)
    stats_bronce = referrals_service.calcular_nivel_colaborador(colaborador, db_session)
    assert stats_bronce["nivel"] == "bronce"
    assert stats_bronce["comision_plataforma_pct"] == 15.0
    assert stats_bronce["bono_extra_pct"] == 8.0
    assert stats_bronce["proximo_nivel"] == "plata"
    assert stats_bronce["faltantes_proximo_nivel"] >= 1

    # 2. Creamos 5 referidos con arriendos activos -> Plata (12% comisión plataforma, 10% bono)
    from datetime import datetime, timezone, timedelta
    ahora = datetime.now(timezone.utc)
    for i in range(5):
        invitado = usuario_factory(nombre=f"Invitado {i}", email=f"invitado{i}@test.com")
        referrals_service.aplicar_codigo_referido(invitado, codigo, db_session)
        # Crear reserva confirmada para cada uno
        auto = Auto(
            dueno_id=colaborador.id, marca="Ford", modelo="Ka", anio=2020,
            patente=f"PLAT{i:02d}", tarifa_dia=30000, estado="activo",
            ubicacion_base="Santiago"
        )
        db_session.add(auto)
        db_session.commit()
        reserva = Reserva(
            cliente_id=invitado.id,
            auto_id=auto.id,
            estado="finalizada",
            fecha_inicio=ahora - timedelta(days=2),
            fecha_fin=ahora - timedelta(days=1),
            monto_cobro=60000,
            monto_hold=100000,
            lugar_entrega_acordado="Terminal Santiago",
        )
        db_session.add(reserva)
        db_session.commit()

    stats_plata = referrals_service.calcular_nivel_colaborador(colaborador, db_session)
    assert stats_plata["nivel"] == "plata"
    assert stats_plata["comision_plataforma_pct"] == 12.0
    assert stats_plata["bono_extra_pct"] == 10.0
    assert stats_plata["proximo_nivel"] == "oro"
    assert stats_plata["faltantes_proximo_nivel"] == 10

    # 3. Comisión reducida aplicada en PricingService para colaborador Plata
    calc_dueno_normal = PricingService.calcular_cobro_final(dias=2, tarifa_dia=50000, db=db_session)
    assert calc_dueno_normal["comision_empresa"] == 15000 # 15% de 100.000
    assert calc_dueno_normal["liquidacion_dueno"] == 85000 # 85%

    calc_dueno_plata = PricingService.calcular_cobro_final(
        dias=2, tarifa_dia=50000, db=db_session, dueno_id=colaborador.id
    )
    assert calc_dueno_plata["comision_empresa"] == 12000 # 12% de 100.000 (¡Ahorra $3.000!)
    assert calc_dueno_plata["liquidacion_dueno"] == 88000 # 88% para el dueño


def test_endpoint_programa_referidos_enriquecido(usuario_factory, auth_as, db_session):
    colab = usuario_factory(nombre="Sofia Referente", roles_activos=["dueno", "promotor"], es_promotor=True)
    cod = referrals_service.obtener_o_generar_codigo(colab, db_session)

    resp = auth_as(colab).get("/api/v1/usuarios/me/programa-referidos")
    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"]
    assert "nivel_colaborador" in data
    assert data["nivel_colaborador"]["nivel"] == "bronce"
    assert "ultimos_referidos" in data
    assert isinstance(data["ultimos_referidos"], list)
