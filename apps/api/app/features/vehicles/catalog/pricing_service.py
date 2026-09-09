import math
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings

NIVELES_COMBUSTIBLE = {
    "vacio": 0,
    "1/4": 1,
    "1/2": 2,
    "3/4": 3,
    "lleno": 4
}

class PricingService:
    @staticmethod
    def obtener_configuracion(db: Optional[Session] = None):
        """
        Obtiene la configuración activa de la plataforma desde la base de datos (RF-33).
        Si no existe en DB, retorna los valores por defecto del sistema.
        """
        if db:
            from app.models.entities import ConfiguracionPlataforma
            config = db.query(ConfiguracionPlataforma).first()
            if config:
                return config

        # Fallback con valores por defecto
        class DefaultConfig:
            valor_uf_clp = settings.VALOR_UF_CLP
            comision_plataforma_pct = settings.COMISION_PLATAFORMA_PORCENTAJE * 100 # 20.0
            hold_enrolamiento_clp = settings.HOLD_ENROLAMIENTO_CLP
            cargo_limpieza_estandar_clp = 15000
            cargo_limpieza_profunda_clp = 35000
            cargo_combustible_cuarto_clp = 15000
            cargo_km_extra_clp = 120
            km_diarios_incluidos = 250
            periodo_gracia_minutos = 30
            dias_cobro_posterior_peajes = 60
            edad_minima_arriendo = 21

        return DefaultConfig()

    @staticmethod
    def calcular_dias_reserva(fecha_inicio: datetime, fecha_fin: datetime) -> int:
        delta = fecha_fin - fecha_inicio
        dias = math.ceil(delta.total_seconds() / 86400)
        return max(dias, 1)

    @staticmethod
    def calcular_monto_hold_reserva(tarifa_dia: int, dias: int) -> int:
        """
        Hold de la reserva = (días * tarifa diaria).
        Nota: el hold de $800.000 CLP de enrolamiento es independiente y se maneja en el registro de tarjeta.
        """
        return tarifa_dia * dias

    @staticmethod
    def obtener_cargo_limpieza(estado_limpieza: str, db: Optional[Session] = None) -> int:
        """
        Calcula la multa/cargo por devolución sucia:
        - 'limpio': $0
        - 'sucio_estandar': $15.000 CLP (lavado exterior/suciedad normal)
        - 'sucio_profundo': $35.000 CLP (tapiz manchado/barro extremo/olores)
        """
        cfg = PricingService.obtener_configuracion(db)
        if estado_limpieza == "sucio_estandar":
            return int(cfg.cargo_limpieza_estandar_clp)
        elif estado_limpieza == "sucio_profundo":
            return int(cfg.cargo_limpieza_profunda_clp)
        return 0

    @staticmethod
    def calcular_cargo_combustible(
        nivel_inicial: str,
        nivel_final: str,
        db: Optional[Session] = None
    ) -> int:
        """
        Calcula el cobro por combustible faltante:
        Cada 1/4 de estanque faltante se cobra al valor configurado (default $15.000 CLP).
        """
        cfg = PricingService.obtener_configuracion(db)
        val_ini = NIVELES_COMBUSTIBLE.get(nivel_inicial.lower(), 4)
        val_fin = NIVELES_COMBUSTIBLE.get(nivel_final.lower(), 4)

        cuartos_faltantes = max(0, val_ini - val_fin)
        return cuartos_faltantes * int(cfg.cargo_combustible_cuarto_clp)

    @staticmethod
    def calcular_cargo_km_extra(
        km_inicial: int,
        km_final: int,
        dias: int,
        db: Optional[Session] = None
    ) -> int:
        """
        Calcula el cobro por exceso de kilometraje:
        Se incluyen 250 km/día (default). Cada km extra se cobra al valor configurado ($120 CLP/km).
        """
        cfg = PricingService.obtener_configuracion(db)
        km_recorridos = max(0, km_final - km_inicial)
        km_incluidos = dias * int(cfg.km_diarios_incluidos)

        km_excedentes = max(0, km_recorridos - km_incluidos)
        return km_excedentes * int(cfg.cargo_km_extra_clp)

    @staticmethod
    def calcular_cargo_atraso(
        fecha_fin_pactada: datetime,
        fecha_devolucion_real: datetime,
        tarifa_dia: int,
        db: Optional[Session] = None
    ) -> int:
        """
        Calcula el cobro por devolución tardía:
        Período de gracia: 30 minutos.
        Pasada la gracia, se cobra fracción horaria proporcional (tarifa_dia / 24) o día completo si excede 2 horas.
        """
        cfg = PricingService.obtener_configuracion(db)
        
        # Normalizar a datetimes naive para cálculo robusto
        dt_pactada = fecha_fin_pactada.replace(tzinfo=None) if hasattr(fecha_fin_pactada, "replace") else fecha_fin_pactada
        dt_real = fecha_devolucion_real.replace(tzinfo=None) if hasattr(fecha_devolucion_real, "replace") else fecha_devolucion_real

        delta = dt_real - dt_pactada
        minutos_retraso = delta.total_seconds() / 60

        if minutos_retraso <= int(cfg.periodo_gracia_minutos):
            return 0

        # Si el atraso es mayor a 2 horas (120 min), cobra el día completo adicional
        if minutos_retraso > 120:
            dias_extra = math.ceil(minutos_retraso / 1440)
            return dias_extra * tarifa_dia

        # Entre 30 min y 120 min: cobra tarifa horaria redondeada
        horas_extra = math.ceil(minutos_retraso / 60)
        valor_hora = max(1, tarifa_dia // 24)
        return horas_extra * valor_hora

    @staticmethod
    def calcular_cobro_final(
        tarifa_dia: int,
        dias: int,
        estado_limpieza: str = "limpio",
        cargo_combustible: int = 0,
        cargo_km_extra: int = 0,
        cargo_atraso: int = 0,
        cargos_adicionales: int = 0,
        db: Optional[Session] = None
    ) -> dict:
        """
        Calcula el cobro final integral:
        - Subtotal arriendo base: dias * tarifa_dia.
        - Comisión plataforma: 20% sobre arriendo base.
        - Base dueño: 80% del arriendo base.
        - Cargos adicionales (100% abonados al dueño): limpieza, combustible faltante, km extra, atraso.
        """
        cfg = PricingService.obtener_configuracion(db)
        comision_pct = float(cfg.comision_plataforma_pct) / 100.0

        subtotal_arriendo = tarifa_dia * dias
        comision_empresa = int(subtotal_arriendo * comision_pct)
        base_dueno = subtotal_arriendo - comision_empresa

        cargo_limpieza = PricingService.obtener_cargo_limpieza(estado_limpieza, db)
        total_adicionales = cargo_combustible + cargo_km_extra + cargo_atraso + cargos_adicionales

        monto_total_cobro = subtotal_arriendo + cargo_limpieza + total_adicionales
        liquidacion_dueno = base_dueno + cargo_limpieza + total_adicionales

        return {
            "dias": dias,
            "tarifa_dia": tarifa_dia,
            "subtotal": subtotal_arriendo,
            "subtotal_arriendo": subtotal_arriendo,
            "cargo_limpieza": cargo_limpieza,
            "cargo_combustible": cargo_combustible,
            "cargo_km_extra": cargo_km_extra,
            "cargo_atraso": cargo_atraso,
            "cargos_adicionales": total_adicionales,
            "comision_empresa": comision_empresa,
            "liquidacion_dueno": liquidacion_dueno,
            "monto_total_cobro": monto_total_cobro
        }

    @staticmethod
    def calcular_deducible_seguro(db: Optional[Session] = None) -> dict:
        """
        Regla de negocio:
        - Seguro full para todo evento.
        - Deducible de 15 UF por auto.
        - El deducible se divide 50/50 entre la empresa y el dueño (mismo criterio en pérdida total).
        """
        cfg = PricingService.obtener_configuracion(db)
        total_uf = settings.SEGURO_DEDUCIBLE_UF
        valor_uf_clp = float(cfg.valor_uf_clp)
        total_clp = int(total_uf * valor_uf_clp)

        aporte_empresa = total_clp // 2
        aporte_dueno = total_clp - aporte_empresa

        return {
            "deducible_uf": total_uf,
            "valor_uf_clp": valor_uf_clp,
            "deducible_total_clp": total_clp,
            "deducible_empresa_50_clp": aporte_empresa,
            "deducible_dueno_50_clp": aporte_dueno
        }
