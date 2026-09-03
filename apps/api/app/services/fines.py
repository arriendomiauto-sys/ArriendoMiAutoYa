"""
Servicio de gestión de multas, penalizaciones y cargos por faltas en arriendos.
Define los montos oficiales de penalización, calcula deducciones contra el hold
de garantía y registra los detalles estructurados de cada cargo.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone

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
    "peajes_tag": {
        "nombre": "Peajes / TAG no informado",
        "monto_sugerido_clp": 0,
        "descripcion": "Consumo de autopistas concesionadas o pórticos durante el período de arriendo.",
        "requiere_fotos": False,
        "es_cargo_posterior": True,
        "requiere_documento": True,
    },
    "fotomulta": {
        "nombre": "Fotomulta / Infracción de tránsito",
        "monto_sugerido_clp": 0,
        "descripcion": "Parte cursado por fotorradar o control de tránsito, notificado a la patente semanas después.",
        "requiere_fotos": False,
        "es_cargo_posterior": True,
        "requiere_documento": True,
    },
    "otro": {
        "nombre": "Otra infracción / daño menor",
        "monto_sugerido_clp": 0,
        "descripcion": "Infracción declarada con justificación y evidencia.",
        "requiere_fotos": True,
    },
}


class FinesService:
    @staticmethod
    def obtener_tarifas_oficiales() -> Dict[str, Dict[str, Any]]:
        return TARIFAS_MULTAS_OFICIALES

    @staticmethod
    def es_cargo_posterior(tipo: str) -> bool:
        """
        Un cargo posterior es el que no se puede conocer al cerrar el arriendo:
        peajes de autopistas free-flow y fotomultas llegan a nombre del dueño de
        la patente semanas después de que el auto ya fue devuelto.
        """
        return bool(TARIFAS_MULTAS_OFICIALES.get(tipo, {}).get("es_cargo_posterior"))

    @staticmethod
    def validar_ventana_cargo_posterior(
        fecha_inicio: datetime,
        fecha_fin: datetime,
        fecha_evento: Optional[datetime],
        dias_limite: int,
        ahora: Optional[datetime] = None,
    ) -> Optional[str]:
        """
        Devuelve el motivo del rechazo, o `None` si el cargo posterior es imputable
        a esta reserva. Dos condiciones: el evento ocurrió mientras el arrendatario
        tenía el auto, y todavía corre el plazo de imputación.
        """
        ahora = ahora or datetime.now(timezone.utc)

        if fecha_evento is None:
            return "Debes indicar la fecha del pórtico o de la infracción para imputar el cargo."

        # La BD guarda datetimes naive (SQLite) — se comparan en el mismo plano.
        def _naive(dt: datetime) -> datetime:
            return dt.replace(tzinfo=None) if dt.tzinfo else dt

        evento, inicio, fin, hoy = _naive(fecha_evento), _naive(fecha_inicio), _naive(fecha_fin), _naive(ahora)

        if evento < inicio or evento > fin:
            return (
                "La fecha del evento está fuera del período de arriendo "
                f"({inicio:%d-%m-%Y} a {fin:%d-%m-%Y}): no es imputable a este arrendatario."
            )

        limite = fin + timedelta(days=dias_limite)
        if hoy > limite:
            return (
                f"Venció el plazo de {dias_limite} días para imputar peajes y multas "
                f"de esta reserva (venció el {limite:%d-%m-%Y})."
            )

        return None

    @staticmethod
    def validar_y_calcular_multa(
        tipo: str,
        monto_clp: Optional[int],
        motivo: str,
        fotos: Optional[List[str]] = None,
        fecha_evento: Optional[datetime] = None,
        documento_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        info = TARIFAS_MULTAS_OFICIALES.get(tipo)
        if not info:
            tipo = "otro"
            info = TARIFAS_MULTAS_OFICIALES["otro"]

        # Si se especifica un monto explícito (>0), se usa ese; sino el monto sugerido oficial
        monto_final = monto_clp if (monto_clp is not None and monto_clp > 0) else info["monto_sugerido_clp"]

        item_detalle = {
            "tipo": tipo,
            "nombre": info["nombre"],
            "monto_clp": monto_final,
            "motivo": motivo or info["descripcion"],
            "fotos": fotos or [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if info.get("es_cargo_posterior"):
            item_detalle["es_cargo_posterior"] = True
            item_detalle["fecha_evento"] = fecha_evento.isoformat() if fecha_evento else None
            item_detalle["documento_url"] = documento_url

        return item_detalle
