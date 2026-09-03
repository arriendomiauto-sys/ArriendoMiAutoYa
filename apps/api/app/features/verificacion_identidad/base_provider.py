"""
Interfaz base y modelos de datos para proveedores modulares de KYC,
autenticación de documentos y verificación biométrica facial (Veridas, Google Vision, etc.).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List


@dataclass
class DocumentValidationResult:
    es_valido: bool
    tipo_documento: str # "cedula_frontal", "cedula_trasera", "pasaporte", "dni_extranjero", "licencia", "padron", "permiso", "soap", "revision"
    rut: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    numero_documento: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    autentico: bool = True
    score_autenticidad: float = 1.0
    folio: Optional[str] = None
    patente: Optional[str] = None
    pais_emisor: Optional[str] = None  # ISO-3166 alpha-2 del documento extranjero
    errores: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BiometricValidationResult:
    es_persona_viva: bool = True
    liveness_score: float = 0.95
    coincide_foto: bool = True
    face_match_score: float = 0.95
    errores: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KYCResult:
    estado_recomendado: str # "verificado", "rechazado", "revision_manual"
    confianza_ocr: float
    rut_detectado: Optional[str] = None
    nombre_detectado: Optional[str] = None
    vencimiento_carnet: Optional[str] = None
    carnet_valido: bool = True
    licencia_valida: bool = True
    licencia_a_soporte: bool = False
    biometria: Optional[BiometricValidationResult] = None
    motivo: Optional[str] = None
    detalles: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "estado_recomendado": self.estado_recomendado,
            "confianza_ocr": self.confianza_ocr,
            "rut_detectado": self.rut_detectado,
            "nombre_detectado": self.nombre_detectado,
            "vencimiento_carnet": self.vencimiento_carnet,
            "carnet_valido": self.carnet_valido,
            "licencia_valida": self.licencia_valida,
            "licencia_a_soporte": self.licencia_a_soporte,
            "motivo": self.motivo,
            "biometria": {
                "es_persona_viva": self.biometria.es_persona_viva,
                "liveness_score": self.biometria.liveness_score,
                "coincide_foto": self.biometria.coincide_foto,
                "face_match_score": self.biometria.face_match_score,
            } if self.biometria else None,
            "detalles": self.detalles,
        }


class BaseKYCProvider(ABC):
    """
    Contrato base abstracto para cualquier proveedor de verificación de identidad y documentos.
    """

    @property
    @abstractmethod
    def nombre_proveedor(self) -> str:
        """Nombre identificador del proveedor (ej. 'veridas', 'google_vision', 'mock')."""
        pass

    @abstractmethod
    def validar_documento(
        self,
        imagen_bytes: bytes,
        tipo_documento: str,
        nombre_archivo: Optional[str] = None,
    ) -> DocumentValidationResult:
        """
        Valida y extrae información estructurada de un documento (cédula, licencia, padrón, etc.).
        """
        pass

    @abstractmethod
    def validar_biometria(
        self,
        selfie_bytes: bytes,
        foto_documento_bytes: Optional[bytes] = None,
    ) -> BiometricValidationResult:
        """
        Realiza la prueba de vida (liveness) pasiva y opcionalmente el face match 1:1.
        """
        pass

    @abstractmethod
    def procesar_kyc(
        self,
        carnet_frontal_bytes: Optional[bytes] = None,
        carnet_trasero_bytes: Optional[bytes] = None,
        licencia_bytes: Optional[bytes] = None,
        selfie_bytes: Optional[bytes] = None,
        rut_esperado: Optional[str] = None,
        tipo_documento: str = "rut",
        pais_documento: Optional[str] = None,
    ) -> KYCResult:
        """
        Orquesta el flujo integral de validación de identidad (carnet frontal, trasero, licencia y biometría).
        """
        pass
