from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime
from app.core.validators import validar_rut_chileno, validar_patente_chilena
from app.core.sanitizer import sanitize_text

# ==============================================================================
# AUTENTICACIÓN (login/refresh contra Supabase Auth, del lado del servidor)
# ==============================================================================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class TokenOut(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "bearer"

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
    # El RUT deja de ser obligatorio: un extranjero se enrola con pasaporte o
    # DNI de su país. El router exige uno u otro vía validar_documento_identidad.
    rut: Optional[str] = None
    email: Optional[EmailStr] = None
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    foto_perfil_verificada_url: Optional[str] = None
    tarjeta_token: Optional[str] = None

    # Identidad
    tipo_documento: Literal["rut", "pasaporte", "dni_extranjero"] = "rut"
    numero_documento: Optional[str] = None
    pais_documento: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None

    # Licencia de conducir (país emisor y PIC para extranjeros)
    licencia_pais_emisor: Optional[str] = None
    licencia_numero: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    es_residente_chile: bool = False
    fecha_inicio_residencia: Optional[datetime] = None

class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    foto_perfil_verificada_url: Optional[str] = None
    estado_documentos: str
    confianza_ocr: Optional[float] = 1.0
    notas_auditoria: Optional[str] = None
    roles_activos: List[str]

    # Mismo caso que AutoOut.documentos_verificados: estas dos columnas
    # también declaran default en el modelo y son obligatorias acá, así que
    # un NULL heredado tumbaría GET /usuarios/me con un 500.
    @field_validator("estado_documentos", mode="before")
    @classmethod
    def _estado_por_defecto(cls, v):
        return "pendiente" if v is None else v

    @field_validator("roles_activos", mode="before")
    @classmethod
    def _roles_por_defecto(cls, v):
        return ["cliente"] if v is None else v
    sucursal_id: Optional[str] = None
    fecha_registro: datetime
    cuenta_bancaria: Optional[Dict[str, str]] = None

    tipo_documento: Optional[str] = "rut"
    numero_documento: Optional[str] = None
    pais_documento: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    licencia_pais_emisor: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    es_residente_chile: Optional[bool] = False

class CuentaBancariaUpdate(BaseModel):
    banco: str
    tipo_cuenta: str
    numero: str
    titular: str
    rut: str

    @field_validator("rut")
    @classmethod
    def check_rut_titular(cls, v: str) -> str:
        if not validar_rut_chileno(v):
            raise ValueError("RUT chileno inválido (falla verificación Módulo 11)")
        return v

class PerfilBasicoUpdate(BaseModel):
    """
    Datos de perfil que NO son de identidad (no pasan por OCR/Módulo-11) —
    los puede actualizar una cuenta "simple" recién creada, sin haber hecho
    el enrolamiento KYC todavía.
    """
    nombre: str
    telefono: Optional[str] = None

    @field_validator("nombre", "telefono")
    @classmethod
    def sanitize_perfil(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v)

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
    equipamiento: Dict[str, bool] = {}

    @field_validator("marca", "modelo", "ubicacion_base", "descripcion")
    @classmethod
    def sanitize_auto_text(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v)

    # Las columnas JSON declaran `default=list`/`default=dict` en el modelo,
    # que es un default de Python: las filas anteriores a que la columna
    # existiera traen NULL y, al ser campos obligatorios acá, tumbaban
    # GET /autos con un 500 (mismo caso que documentos_verificados).
    @field_validator("fotos", "equipamiento", mode="before")
    @classmethod
    def _json_nulo_es_vacio(cls, v, info):
        if v is None:
            return [] if info.field_name == "fotos" else {}
        return v

    # Ficha técnica (opcional; se muestra en el detalle del auto).
    transmision: Optional[Literal["automatica", "mecanica"]] = None
    combustible: Optional[Literal["bencina", "diesel", "hibrido", "electrico"]] = None
    asientos: Optional[int] = Field(None, ge=1, le=9)
    puertas: Optional[int] = Field(None, ge=2, le=6)
    categoria: Optional[Literal["economico", "sedan", "suv", "camioneta", "premium"]] = None
    descripcion: Optional[str] = Field(None, max_length=1000)

    # Documentos del vehículo (URLs de Storage). Opcionales en la base para
    # que AutoOut/AutoUpdate no los exijan; AutoCreate los vuelve obligatorios.
    doc_inscripcion_url: Optional[str] = None
    doc_permiso_circulacion_url: Optional[str] = None
    doc_soap_url: Optional[str] = None
    doc_revision_tecnica_url: Optional[str] = None

    # Instalar un GPS en el auto de otra persona exige su consentimiento
    # expreso: sin él el router no acepta la publicación.
    gps_consentimiento: bool = False

    @field_validator("patente")
    @classmethod
    def check_patente(cls, v: str) -> str:
        if not validar_patente_chilena(v):
            raise ValueError("Patente chilena inválida (ej. ABCD-12 o AB-12-34)")
        return v.upper()

class AutoCreate(AutoBase):
    dueno_id: Optional[str] = None
    # Para publicar hay que subir los 4 documentos legales del auto. Se
    # dejan opcionales en el schema y el router devuelve un 400 legible
    # nombrando exactamente cuáles faltan (mejor que el 422 de pydantic).

class AutoUpdate(BaseModel):
    tarifa_dia: Optional[int] = None
    estado: Optional[str] = None
    fotos: Optional[List[str]] = None
    ubicacion_base: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    equipamiento: Optional[Dict[str, bool]] = None
    transmision: Optional[Literal["automatica", "mecanica"]] = None
    combustible: Optional[Literal["bencina", "diesel", "hibrido", "electrico"]] = None
    asientos: Optional[int] = Field(None, ge=1, le=9)
    puertas: Optional[int] = Field(None, ge=2, le=6)
    categoria: Optional[Literal["economico", "sedan", "suv", "camioneta", "premium"]] = None
    descripcion: Optional[str] = Field(None, max_length=1000)
    doc_inscripcion_url: Optional[str] = None
    doc_permiso_circulacion_url: Optional[str] = None
    doc_soap_url: Optional[str] = None
    doc_revision_tecnica_url: Optional[str] = None
    gps_consentimiento: Optional[bool] = None

class AutoOut(AutoBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dueno_id: str
    estado: str
    documentos_verificados: bool = False
    gps_instalado: Optional[bool] = False
    gps_consentimiento_fecha: Optional[datetime] = None

    # Filas anteriores a que la columna existiera pueden traer NULL (ver
    # app/core/schema_sync.py). Con el campo tipado `bool` a secas eso
    # tumbaba GET /autos entero con un 500 de validación de respuesta.
    # schema_sync ya rellena esos NULL al arrancar; esto es el cinturón de
    # seguridad para que un registro suelto no vuelva a botar el catálogo,
    # sin que la API tenga que ofrecer `null` en el contrato.
    @field_validator("documentos_verificados", mode="before")
    @classmethod
    def _null_es_false(cls, v):
        return False if v is None else v

# ==============================================================================
# RESERVAS
# ==============================================================================
class BookingCreate(BaseModel):
    auto_id: str
    cliente_id: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    lugar_entrega_acordado: str

    @field_validator("lugar_entrega_acordado")
    @classmethod
    def sanitize_lugar(cls, v: str) -> str:
        return sanitize_text(v) or v

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
    cargo_falta_grave_clp: int = 0
    monto_cobro_final: int = 0
    liquidacion_dueno_clp: int = 0
    codigo_qr_hash: Optional[str] = None
    lugar_entrega_acordado: str
    contrato_pdf_url: Optional[str] = None

    # Pre-checkin 24h antes
    precheck_cliente_confirmado: bool = False
    precheck_cliente_timestamp: Optional[datetime] = None
    precheck_dueno_confirmado: bool = False
    precheck_dueno_timestamp: Optional[datetime] = None

    # Desglose de multas
    motivo_multas: Optional[str] = None
    multas_detalle: List[Dict[str, Any]] = []

    creado_en: datetime
    auto: Optional[AutoOut] = None

# ==============================================================================
# CONTRATOS API DE PRE-CHECKIN Y MULTAS (RESERVAS)
# ==============================================================================
class PreCheckinRequest(BaseModel):
    rol: Literal["cliente", "dueno"]
    confirma_asistencia: bool = True
    confirma_lugar_hora: bool = True
    confirma_licencia_vigente: Optional[bool] = None
    confirma_auto_limpio_combustible: Optional[bool] = None
    notas: Optional[str] = None

class PreCheckinResponse(BaseModel):
    reserva_id: str
    precheck_cliente_confirmado: bool
    precheck_cliente_timestamp: Optional[datetime] = None
    precheck_dueno_confirmado: bool
    precheck_dueno_timestamp: Optional[datetime] = None
    ambos_confirmados: bool
    mensaje: str

class AplicarMultaRequest(BaseModel):
    tipo: Literal[
        "fumar",
        "lugar_no_acordado",
        "mascotas",
        "limpieza_estandar",
        "limpieza_profunda",
        "peajes_tag",
        "fotomulta",
        "otro",
    ]
    monto_clp: Optional[int] = None
    motivo: str = Field(..., min_length=4, description="Justificación detallada de la falta/penalización")
    fotos: List[str] = Field(default=[], description="Fotografías de evidencia de la falta")
    fecha_evento: Optional[datetime] = Field(
        default=None,
        description="Fecha del pórtico o de la infracción. Obligatoria en peajes y fotomultas.",
    )
    documento_url: Optional[str] = Field(
        default=None,
        description="Boleta de la concesionaria o parte cursado que respalda el cargo posterior.",
    )

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
    dias_cobro_posterior_peajes: int = 60
    edad_minima_arriendo: int = 21
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
    dias_cobro_posterior_peajes: Optional[int] = None
    edad_minima_arriendo: Optional[int] = None

# ==============================================================================
# DISPUTAS Y SOPORTE
# ==============================================================================
class DisputeCreate(BaseModel):
    reserva_id: str
    tipo: Literal["no_coincidencia_identidad", "dano", "incumplimiento", "limpieza", "otro"]
    motivo: str
    foto_evidencia_url: Optional[str] = None
    evidencia_fotos: List[str] = []

    @field_validator("motivo")
    @classmethod
    def sanitize_motivo(cls, v: str) -> str:
        return sanitize_text(v) or v

class DisputeResolveRequest(BaseModel):
    resolucion: str
    accion_pago: Literal["reembolso_total", "cobro_cliente", "division_deducible_50_50", "cargo_limpieza_dueno", "sin_cobro"]

    @field_validator("resolucion")
    @classmethod
    def sanitize_resolucion(cls, v: str) -> str:
        return sanitize_text(v) or v

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

    @field_validator("asunto", "descripcion")
    @classmethod
    def sanitize_ticket_fields(cls, v: str) -> str:
        return sanitize_text(v) or v

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

    @field_validator("comentario")
    @classmethod
    def sanitize_comentario(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v)

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

# ==============================================================================
# MANTENCIONES Y DOCUMENTACIÓN DEL AUTO
# ==============================================================================
class MaintenanceCreate(BaseModel):
    tipo: Literal["documento_legal", "servicio_mecanico"]
    nombre: str
    fecha_vencimiento: Optional[datetime] = None
    kilometraje: Optional[int] = None
    notas: Optional[str] = None
    documento_url: Optional[str] = None

    @field_validator("nombre", "notas")
    @classmethod
    def sanitize_maintenance(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v)

class MaintenanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auto_id: str
    tipo: str
    nombre: str
    fecha_vencimiento: Optional[datetime] = None
    kilometraje: Optional[int] = None
    notas: Optional[str] = None
    documento_url: Optional[str] = None
    creado_en: datetime

# ==============================================================================
# CALENDARIO DE DISPONIBILIDAD DEL AUTO
# ==============================================================================
class CalendarBlockCreate(BaseModel):
    fecha: datetime
    motivo: Optional[str] = None

class CalendarBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auto_id: str
    fecha: datetime
    motivo: Optional[str] = None
    creado_en: datetime

# ==============================================================================
# EXTENSIÓN DE RESERVA
# ==============================================================================
class ExtendBookingRequest(BaseModel):
    dias_adicionales: int = Field(..., gt=0, le=30)

# ==============================================================================
# MENSAJERÍA (CHAT POR RESERVA)
# ==============================================================================
class MessageCreate(BaseModel):
    texto: str = Field(..., min_length=1, max_length=2000)

    @field_validator("texto")
    @classmethod
    def sanitize_msg(cls, v: str) -> str:
        return sanitize_text(v) or v

class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reserva_id: str
    autor_id: str
    texto: str
    timestamp: datetime

# ==============================================================================
# NOTIFICACIONES
# ==============================================================================
class NotificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tipo: str
    titulo: str
    mensaje: str
    leido: bool
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[str] = None
    creado_en: datetime
