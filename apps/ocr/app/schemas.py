from typing import Optional, Any, Dict

from pydantic import BaseModel, Field


class DocumentosRequest(BaseModel):
    """Payload que manda el backend a POST /v1/procesar-documentos.

    Las URLs pueden ser http(s), data:image/... o rutas /uploads/... que el
    servicio resuelve contra STORAGE_LOCAL_DIR.
    """

    carnet_frontal_url: Optional[str] = Field(default=None, description="Foto del frente de la cédula")
    carnet_trasero_url: Optional[str] = Field(default=None, description="Foto del reverso de la cédula")
    licencia_url: Optional[str] = Field(default=None, description="Foto de la licencia de conducir")
    rut_usuario: Optional[str] = Field(default=None, description="RUT declarado por el usuario")
    selfie_url: Optional[str] = Field(default=None, description="Selfie para verificación facial")


class OCRResultado(BaseModel):
    """Respuesta del pipeline. Campos abiertos: el motor decide qué incluir
    según el camino que tome (rechazo temprano, revisión manual, verificado…).
    """

    documentos_legibles: bool = False
    confianza_ocr: float = 0.0
    estado_recomendado: str = "requiere_revision_manual"
    motivo: Optional[str] = None
    es_mock: bool = False

    rut_extraido: Optional[str] = None
    nombre_extraido: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    fecha_vencimiento_carnet: Optional[str] = None
    licencia_clase: Optional[str] = None
    fecha_vencimiento_licencia: Optional[str] = None
    confianza_facial: Optional[float] = None
    verificacion_facial: Optional[str] = None
    coincide_rut_declarado: Optional[bool] = None
    tipo_documento_detectado: Optional[str] = None
    licencia_valida: Optional[bool] = None
    licencia_a_soporte: Optional[bool] = None

    model_config = {"extra": "allow"}

    @classmethod
    def from_engine(cls, data: Dict[str, Any]) -> "OCRResultado":
        return cls(**data)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
    ocr_mock: bool
    vision_configurado: bool
