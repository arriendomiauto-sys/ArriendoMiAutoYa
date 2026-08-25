from datetime import datetime, timedelta
from app.services.pricing import PricingService
from app.services.contract import ContractService
from app.core.config import settings

def test_calcular_dias_reserva():
    inicio = datetime(2026, 8, 1, 10, 0)
    fin = datetime(2026, 8, 4, 10, 0)
    dias = PricingService.calcular_dias_reserva(inicio, fin)
    assert dias == 3

def test_calcular_monto_hold_reserva():
    tarifa_dia = 40000
    dias = 4
    hold = PricingService.calcular_monto_hold_reserva(tarifa_dia, dias)
    assert hold == 160000

def test_calcular_cobro_final():
    tarifa_dia = 35000
    dias = 2
    resultado = PricingService.calcular_cobro_final(tarifa_dia, dias)
    
    assert resultado["subtotal"] == 70000
    assert resultado["comision_empresa"] == 14000 # 20%
    assert resultado["liquidacion_dueno"] == 56000 # 80%

def test_deducible_seguro_50_50():
    deducible = PricingService.calcular_deducible_seguro()
    
    assert deducible["deducible_uf"] == 15
    assert deducible["deducible_total_clp"] == 15 * settings.VALOR_UF_CLP
    assert deducible["deducible_empresa_50_clp"] == deducible["deducible_dueno_50_clp"]

def test_calculo_cargo_combustible():
    # Lleno a Lleno -> $0
    assert PricingService.calcular_cargo_combustible("lleno", "lleno") == 0
    # Lleno a 3/4 -> 1 cuarto faltante = $15.000 CLP
    assert PricingService.calcular_cargo_combustible("lleno", "3/4") == 15000
    # Lleno a 1/2 -> 2 cuartos faltantes = $30.000 CLP
    assert PricingService.calcular_cargo_combustible("lleno", "1/2") == 30000
    # Lleno a Vacio -> 4 cuartos faltantes = $60.000 CLP
    assert PricingService.calcular_cargo_combustible("lleno", "vacio") == 60000

def test_calculo_cargo_km_extra():
    # 2 días * 250 km = 500 km permitidos.
    # 450 km recorridos -> $0 extra
    assert PricingService.calcular_cargo_km_extra(10000, 10450, dias=2) == 0
    # 600 km recorridos -> 100 km extra * $120 = $12.000 CLP
    assert PricingService.calcular_cargo_km_extra(10000, 10600, dias=2) == 12000

def test_calculo_cargo_atraso():
    pactada = datetime(2026, 8, 10, 18, 0)
    # Atraso de 20 min (dentro de gracia de 30 min) -> $0
    real_20m = pactada + timedelta(minutes=20)
    assert PricingService.calcular_cargo_atraso(pactada, real_20m, tarifa_dia=48000) == 0

    # Atraso de 60 min -> 1 hora adicional (48000 / 24 = 2000 CLP)
    real_60m = pactada + timedelta(minutes=60)
    assert PricingService.calcular_cargo_atraso(pactada, real_60m, tarifa_dia=48000) == 2000

    # Atraso mayor a 2 horas (180 min) -> día completo adicional ($48.000 CLP)
    real_180m = pactada + timedelta(minutes=180)
    assert PricingService.calcular_cargo_atraso(pactada, real_180m, tarifa_dia=48000) == 48000

def test_generacion_contrato_pdf_bytes():
    pdf_bytes = ContractService.generar_contrato_pdf(
        reserva_id="res-demo-123456",
        dueno_nombre="Carlos Mendoza",
        dueno_rut="15.892.341-6",
        dueno_telefono="+56911223344",
        cliente_nombre="María José Silva",
        cliente_rut="19.234.567-7",
        cliente_telefono="+56999887766",
        auto_marca="Toyota",
        auto_modelo="RAV4",
        auto_anio=2023,
        auto_patente="BBCL-10",
        fecha_inicio=datetime(2026, 8, 1, 10, 0),
        fecha_fin=datetime(2026, 8, 4, 10, 0),
        lugar_entrega="Plaza de Armas Los Ángeles",
        tarifa_dia_clp=42000,
        dias=3,
        monto_total_estimado_clp=126000
    )
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF-")
