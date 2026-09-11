"""
Servicio de gestión de multas y penalizaciones por faltas simples en
arriendos (fumar, mascotas, limpieza, lugar no acordado). Define los montos
oficiales de penalización y registra los detalles estructurados de cada
cargo.

Peajes/TAG y fotomultas NO pasan por acá: antes tenían una rama "cargo
posterior" en este mismo servicio que solo simulaba el cobro (registraba un
Pago con referencia inventada `MP-FINE-{uuid}` sin mover dinero real). Esa
rama se retiró — el cobro real de peajes/TAG y multas de tránsito vive en
`POST /reservas/{id}/cobro-posterior` (`checkout_router.py`), que sí carga
la tarjeta de crédito de garantía vía `checkout_service._mover`.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

TARIFAS_MULTAS_OFICIALES: Dict[str, Dict[str, Any]] = {
    "fumar": {
        "nombre": "Fumar en el vehículo",
        "monto_sugerido_clp": 50000,
        "descripcion": "Prohibición estricta de fumar en el habitáculo. Cubre ionización y desodorización profunda.",
        "requiere_fotos": True,
    },
    "lugar_no_acordado": {
        "nombre": "Devolución en lugar no acordado",
        "monto_sugerido_clp": 60000,
        "descripcion": "Devolución fuera del punto público acordado sin previo aviso. Cubre traslado y grúa.",
        "requiere_fotos": True,
    },
    "mascotas": {
        "nombre": "Mascotas sin canil / Pelos en tapicería",
        "monto_sugerido_clp": 25000,
        "descripcion": "Transporte de mascotas sin caja transportadora dejando pelos o manchas en asientos.",
        "requiere_fotos": True,
    },
    "limpieza_estandar": {
        "nombre": "Devolución con suciedad excesiva",
        "monto_sugerido_clp": 15000,
        "descripcion": "Barro, arena o basura acumulada en el habitáculo.",
        "requiere_fotos": True,
    },
    "limpieza_profunda": {
        "nombre": "Limpieza profunda / Manchas en tapiz",
        "monto_sugerido_clp": 35000,
        "descripcion": "Líquidos derramados, manchas persistentes o barro profundo en asientos y piso.",
        "requiere_fotos": True,
    },
    "otro": {
        "nombre": "Otra infracción / daño menor",
        "monto_sugerido_clp": 0,
        "descripcion": "Infracción declarada con justificación y evidencia.",
        "requiere_fotos": True,
    },
    # La única multa que aplica el sistema solo (gps_monitor_service), no un
    # humano con fotos: por eso `requiere_fotos: False`. El motivo real (cuántos
    # minutos sin señal) lo arma ese servicio, este texto es el genérico.
    "gps_sin_senal": {
        "nombre": "Pérdida de señal GPS durante el arriendo",
        "monto_sugerido_clp": 20000,
        "descripcion": "El celular no reportó ubicación por más de 1 hora durante el arriendo, incumpliendo la cláusula de monitoreo del contrato.",
        "requiere_fotos": False,
    },
}


class FinesService:
    @staticmethod
    def obtener_tarifas_oficiales() -> Dict[str, Dict[str, Any]]:
        return TARIFAS_MULTAS_OFICIALES

    @staticmethod
    def validar_y_calcular_multa(
        tipo: str,
        monto_clp: Optional[int],
        motivo: str,
        fotos: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        info = TARIFAS_MULTAS_OFICIALES.get(tipo)
        if not info:
            tipo = "otro"
            info = TARIFAS_MULTAS_OFICIALES["otro"]

        # Si se especifica un monto explícito (>0), se usa ese; sino el monto sugerido oficial
        monto_final = monto_clp if (monto_clp is not None and monto_clp > 0) else info["monto_sugerido_clp"]

        return {
            "tipo": tipo,
            "nombre": info["nombre"],
            "monto_clp": monto_final,
            "motivo": motivo or info["descripcion"],
            "fotos": fotos or [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
