"""
Proveedor GPS de desarrollo: no habla con ningún vendor.

Devuelve posiciones deterministas dentro de Los Ángeles (Región del Biobío)
para poder ejercitar el flujo completo — consulta de posición, protocolo de
corte de motor y auditoría — antes de contratar un proveedor real.
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.features.rastreo_gps.base_provider import (
    BaseGPSProvider,
    PosicionGPS,
    ResultadoComando,
)

# Centro de Los Ángeles, Chile (Plaza de Armas).
_LAT_BASE = -37.4697
_LON_BASE = -72.3536


class MockGPSProvider(BaseGPSProvider):
    @property
    def nombre_proveedor(self) -> str:
        return "mock"

    def registrar_dispositivo(self, patente: str, device_id: str) -> ResultadoComando:
        return ResultadoComando(
            ejecutado=True,
            mensaje=f"Dispositivo {device_id} asociado a la patente {patente} (proveedor mock).",
            device_id=device_id,
        )

    def obtener_posicion(self, device_id: str) -> Optional[PosicionGPS]:
        if not device_id:
            return None

        # Desplazamiento estable por dispositivo: el mismo equipo siempre cae en
        # el mismo punto, así los tests no dependen del azar.
        semilla = int(hashlib.sha256(device_id.encode()).hexdigest()[:6], 16)
        delta_lat = ((semilla % 200) - 100) / 10000.0
        delta_lon = ((semilla // 200 % 200) - 100) / 10000.0

        return PosicionGPS(
            latitud=round(_LAT_BASE + delta_lat, 6),
            longitud=round(_LON_BASE + delta_lon, 6),
            timestamp=datetime.now(timezone.utc),
            velocidad_kmh=0.0,
            direccion="Los Ángeles, Región del Biobío",
            bateria_pct=100.0,
            raw_data={"proveedor": "mock", "device_id": device_id},
        )

    def cortar_motor(self, device_id: str, motivo: str) -> ResultadoComando:
        return ResultadoComando(
            ejecutado=True,
            mensaje=(
                f"Comando de corte de motor encolado para {device_id}. "
                "El proveedor lo ejecuta solo con el vehículo detenido."
            ),
            device_id=device_id,
            raw_data={"motivo": motivo},
        )
