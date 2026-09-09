"""
Interfaz base para proveedores de rastreo GPS de la flota.

En Chile no existe un convenio único de GPS: es un mercado de proveedores
(Movistar Empresas, CentralGPS, Trackchile, GPS Global, MAFE Seg, etc.) con dos
modelos comerciales — pago único por equipo, o equipo en comodato con
suscripción mensual por vehículo. Para una flota de autos de terceros conviene
el segundo, porque no obliga a cada dueño a invertir al sumarse.

Como el vendor todavía no está contratado, el contrato queda definido acá y la
única implementación es el mock. Enchufar un proveedor real es escribir otra
clase y cambiar `GPS_PROVIDER`, exactamente como se hizo con el KYC.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class PosicionGPS:
    latitud: float
    longitud: float
    timestamp: datetime
    velocidad_kmh: Optional[float] = None
    direccion: Optional[str] = None
    bateria_pct: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latitud": self.latitud,
            "longitud": self.longitud,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "velocidad_kmh": self.velocidad_kmh,
            "direccion": self.direccion,
            "bateria_pct": self.bateria_pct,
        }


@dataclass
class ResultadoComando:
    ejecutado: bool
    mensaje: str
    device_id: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


class BaseGPSProvider(ABC):
    """Contrato base abstracto para cualquier proveedor de rastreo vehicular."""

    @property
    @abstractmethod
    def nombre_proveedor(self) -> str:
        """Nombre identificador del proveedor (ej. 'mock', 'centralgps')."""

    @abstractmethod
    def registrar_dispositivo(self, patente: str, device_id: str) -> ResultadoComando:
        """Asocia un equipo instalado a la patente del vehículo."""

    @abstractmethod
    def obtener_posicion(self, device_id: str) -> Optional[PosicionGPS]:
        """Última posición conocida del equipo, o `None` si no reporta."""

    @abstractmethod
    def cortar_motor(self, device_id: str, motivo: str) -> ResultadoComando:
        """
        Corte remoto del motor. Es un comando de último recurso para recuperar
        un vehículo no devuelto: el proveedor solo debe ejecutarlo con el auto
        detenido, nunca en movimiento.
        """
