from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import List, Optional, Literal
from datetime import datetime
from app.core.validators import validar_rut_chileno, validar_patente_chilena

# ==============================================================================
# USUARIOS & ENROLAMIENTO
# ==============================================================================
class UserBase(BaseModel):
    nombre: Optional[str] = None
    rut: Optional[str] = None
    email: EmailStr
    telefono: Optional[str] = None

    @field_validator("rut")
    @classmethod
    def check_rut(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not validar_rut_chileno(v):
            raise ValueError("RUT chileno inválido (falla verificación Módulo 11)")
        return v

class UserCreate(UserBase):
    pass

class UserEnrolamiento(UserBase):
    nombre: str
    rut: str
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    tarjeta_token: Optional[str] = None

class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    foto_perfil_verificada_url: Optional[str] = None
    estado_documentos: str
    confianza_ocr: Optional[float] = 1.0
    notas_auditoria: Optional[str] = None
    roles_activos: List[str]
    sucursal_id: Optional[str] = None
    fecha_registro: datetime

class DocumentReviewRequest(BaseModel):
    accion: Literal["aprobar", "rechazar"]
    notas: str

# ==============================================================================
# AUTOS
# ==============================================================================
class AutoBase(BaseModel):
    marca: str
    modelo: str
    anio: int = Field(..., ge=2000, description="Año del vehículo (>= 2000)")
    patente: str
    tarifa_dia: int = Field(..., gt=0, description="Tarifa diaria en CLP")
    ubicacion_base: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    fotos: List[str] = []

    @field_validator("patente")
    @classmethod
    def check_patente(cls, v: str) -> str:
        if not validar_patente_chilena(v):
            raise ValueError("Patente chilena inválida (ej. ABCD-12 o AB-12-34)")
        return v.upper()

class AutoCreate(AutoBase):
    dueno_id: Optional[str] = None

class AutoUpdate(BaseModel):
    tarifa_dia: Optional[int] = None
    estado: Optional[str] = None
    fotos: Optional[List[str]] = None
    ubicacion_base: Optional[str] = None

class AutoOut(AutoBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dueno_id: str
    estado: str

# ==============================================================================
# RESERVAS
# ==============================================================================
class BookingCreate(BaseModel):
    auto_id: str
    cliente_id: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    lugar_entrega_acordado: str

    @field_validator("fecha_fin")
    @classmethod
    def check_dates(cls, v: datetime, values) -> datetime:
        # Pydantic v2 validation
        data = values.data
        inicio = data.get("fecha_inicio")
        if inicio and v <= inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        return v

class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auto_id: str
    cliente_id: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    monto_hold: int
    cargo_limpieza_clp: int = 0
    cargo_combustible_clp: int = 0
    cargo_km_extra_clp: int = 0
    cargo_atraso_clp: int = 0
    cargos_adicionales_clp: int = 0
    monto_cobro_final: int = 0
    liquidacion_dueno_clp: int = 0
    codigo_qr_hash: Optional[str] = None
    lugar_entrega_acordado: str
    contrato_pdf_url: Optional[str] = None
    creado_en: datetime
    auto: Optional[AutoOut] = None

# ==============================================================================
# CONTRATOS API DE ENTREGA (FLUJO CRÍTICO)
# ==============================================================================
class GenerateQRResponse(BaseModel):
    reserva_id: str
    codigo_qr_hash: str
    foto_perfil_verificada_url: Optional[str] = None
    instrucciones: str

class ValidateQRRequest(BaseModel):
    codigo_qr_hash: str

class ValidateQRResponse(BaseModel):
    reserva_id: str
    auto_marca: str
    auto_modelo: str
    auto_patente: str
    cliente_nombre: str
    foto_perfil_verificada_url: Optional[str] = None
    estado_reserva: str
    lugar_entrega_acordado: str

class ConfirmVerificationRequest(BaseModel):
    resultado: Literal["confirmada", "rechazada"]
    tipo: Literal["entrega", "devolucion"]
    foto_evidencia_url: Optional[str] = None
    motivo_rechazo: Optional[str] = None

class ConfirmVerificationResponse(BaseModel):
    mensaje: str
    estado_reserva: str
    siguiente_paso: str
    disputa_id: Optional[str] = None

class ChecklistRequest(BaseModel):
    tipo: Literal["antes", "despues"]
    fotos: List[str] = Field(..., min_length=1, description="URLs de fotos del auto (mínimo 9 para checklist completo)")
    kilometraje: int = Field(..., gt=0)
    nivel_combustible: Literal["lleno", "3/4", "1/2", "1/4", "vacio"]
    estado_limpieza: Literal["limpio", "sucio_estandar", "sucio_profundo"] = "limpio"
    cargo_limpieza_clp: Optional[int] = None
    notas: Optional[str] = None

class ChecklistResponse(BaseModel):
    mensaje: str
    estado_reserva: str
    monto_cobro_final: Optional[int] = None
    cargo_limpieza: Optional[int] = None
    cargo_combustible: Optional[int] = None
    cargo_km_extra: Optional[int] = None
    cargo_atraso: Optional[int] = None
    liquidacion_dueno: Optional[int] = None

# ==============================================================================
# CONFIGURACIÓN DE PLATAFORMA (RF-33)
# ==============================================================================
class PlatformConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    valor_uf_clp: float
    comision_plataforma_pct: float
    hold_enrolamiento_clp: int
    cargo_limpieza_estandar_clp: int
    cargo_limpieza_profunda_clp: int
    cargo_combustible_cuarto_clp: int
    cargo_km_extra_clp: int
    km_diarios_incluidos: int
    periodo_gracia_minutos: int
    actualizado_en: Optional[datetime] = None

class PlatformConfigUpdate(BaseModel):
    valor_uf_clp: Optional[float] = None
    comision_plataforma_pct: Optional[float] = None
    hold_enrolamiento_clp: Optional[int] = None
    cargo_limpieza_estandar_clp: Optional[int] = None
    cargo_limpieza_profunda_clp: Optional[int] = None
    cargo_combustible_cuarto_clp: Optional[int] = None
    cargo_km_extra_clp: Optional[int] = None
    km_diarios_incluidos: Optional[int] = None
    periodo_gracia_minutos: Optional[int] = None

# ==============================================================================
# DISPUTAS Y SOPORTE
# ==============================================================================
class DisputeCreate(BaseModel):
    reserva_id: str
    tipo: Literal["no_coincidencia_identidad", "dano", "incumplimiento", "limpieza", "otro"]
    motivo: str
    foto_evidencia_url: Optional[str] = None
    evidencia_fotos: List[str] = []

class DisputeResolveRequest(BaseModel):
    resolucion: str
    accion_pago: Literal["reembolso_total", "cobro_cliente", "division_deducible_50_50", "cargo_limpieza_dueno", "sin_cobro"]

class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reserva_id: str
    tipo: str
    estado: str
    admin_asignado_id: Optional[str] = None
    motivo: Optional[str] = None
    foto_evidencia_url: Optional[str] = None
    resolucion: Optional[str] = None
    timestamp: datetime

class TicketCreate(BaseModel):
    usuario_id: Optional[str] = None
    sucursal_id: Optional[str] = None
    asunto: str
    descripcion: str

class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    usuario_id: str
    sucursal_id: Optional[str] = None
    asunto: str
    descripcion: str
    estado: str
    escalado_a_disputa: bool
    disputa_id: Optional[str] = None
    timestamp: datetime

# ==============================================================================
# SUCURSAL
# ==============================================================================
class BranchBase(BaseModel):
    nombre: str
    ubicacion: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    radio_cobertura_km: float = 25.0

class BranchCreate(BranchBase):
    pass

class BranchOut(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    managers_asignados: List[str] = []

# ==============================================================================
# CALIFICACIÓN
# ==============================================================================
class RatingCreate(BaseModel):
    reserva_id: str
    autor_id: Optional[str] = None
    autor_rol: Literal["dueno", "cliente"]
    destinatario_id: str
    puntaje: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = None

class RatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reserva_id: str
    autor_id: str
    autor_rol: str
    destinatario_id: str
    puntaje: int
    comentario: Optional[str] = None
    timestamp: datetime
