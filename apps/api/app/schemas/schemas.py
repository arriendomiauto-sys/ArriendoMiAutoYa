from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import List, Optional, Literal, Dict, Any, ClassVar, Union
from datetime import datetime
from app.core.validators import (
    validar_rut_chileno,
    validar_patente_chilena,
    formatear_rut,
    formatear_telefono_chileno,
)
from app.core.sanitizer import sanitize_text

# ==============================================================================
# AUTENTICACIÓN (login/refresh contra Supabase Auth, del lado del servidor)
# ==============================================================================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    # Opcional para compat con el panel admin: ese cliente ya no persiste el
    # refresh token y lo manda en la cookie httpOnly; la app móvil lo sigue
    # enviando aquí en el body y el endpoint lo usa igual.
    refresh_token: Optional[str] = None

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
    # Dirección particular declarada en el enrolamiento. La app la valida
    # contra el geocoder del dispositivo antes de mandarla (que exista de
    # verdad); acá solo se guarda como texto para el contrato y soporte.
    direccion: Optional[str] = Field(default=None, max_length=300)
    foto_perfil_url: Optional[str] = None

    @field_validator("rut", mode="before")
    @classmethod
    def check_and_format_rut(cls, v: Optional[str]) -> Optional[str]:
        # LENIENTE a propósito: `UserOut` usa este mismo modelo para SERIALIZAR,
        # y un RUT malo ya guardado en la fila (p. ej. el OCR de un proveedor
        # externo que leyó mal el dígito verificador) no debe tumbar GET
        # /usuarios/me con un 500. Si es válido se formatea; si no, se deja tal
        # cual para que el usuario lo corrija. La validación DURA de entrada la
        # hace `UserEnrolamiento` abajo + `validar_documento_identidad`.
        if v is None or not str(v).strip():
            return None
        return formatear_rut(str(v)) if validar_rut_chileno(str(v)) else str(v).strip()

    @field_validator("telefono", mode="before")
    @classmethod
    def check_and_format_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return formatear_telefono_chileno(str(v))

class UserCreate(UserBase):
    pass

class UserEnrolamiento(UserBase):
    nombre: str
    # El RUT deja de ser obligatorio: un extranjero se enrola con pasaporte o
    # DNI de su país. El router exige uno u otro vía validar_documento_identidad.
    rut: Optional[str] = None
    email: Optional[EmailStr] = None

    @field_validator("rut", mode="before")
    @classmethod
    def _rut_estricto_en_enrolamiento(cls, v: Optional[str]) -> Optional[str]:
        # Acá SÍ se rechaza un RUT con dígito verificador malo (a diferencia de
        # UserBase, que es leniente para no romper la serialización de UserOut).
        if v is None or not str(v).strip():
            return None
        if not validar_rut_chileno(str(v)):
            raise ValueError("RUT chileno inválido (falla verificación Módulo 11)")
        return formatear_rut(str(v))
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    foto_perfil_verificada_url: Optional[str] = None
    # Segunda selfie con la cabeza girada. El motor compara el ángulo de la
    # cabeza entre esta y la de frente: si rotó de verdad es una persona en
    # vivo; si son idénticas, sospechamos foto-de-foto -> revisión manual.
    selfie_liveness_url: Optional[str] = None
    # Payload crudo del QR del reverso de la cédula nueva, si la app lo pudo
    # leer. No se asume ningún formato — se guarda tal cual para auditoría,
    # nunca se usa solo para aprobar/rechazar (ver notas en enrolamiento.py).
    qr_carnet_payload: Optional[str] = None

    # Medio de pago. Se pide junto con los documentos, no en una pantalla
    # aparte: así, si algo no se puede verificar, el caso completo viaja a
    # soporte en un solo ticket. La app tokeniza contra la pasarela y manda el
    # token — el número de la tarjeta nunca llega al backend.
    tarjeta_token: Optional[str] = None
    tarjeta_ultimos4: Optional[str] = None
    tarjeta_marca: Optional[str] = None
    tarjeta_titular: Optional[str] = None

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

class CompletarLicencia(BaseModel):
    """
    Solo la licencia de conducir, para un usuario ya verificado que se
    enroló como dueño (sin licencia) y ahora quiere arrendar. Reusa la
    identidad que ya tiene en ficha — acá va únicamente lo de conducción.

    Camino de RESPALDO (captura manual + OCR casero): el camino primario es
    POST /enrolamiento/verificacion-licencia/sesion (Didit).
    """
    licencia_url: str
    pic_url: Optional[str] = None
    licencia_pais_emisor: Optional[str] = None
    es_residente_chile: Optional[bool] = None
    fecha_inicio_residencia: Optional[datetime] = None

class SesionVerificacionLicenciaCreate(BaseModel):
    """
    Datos que no vienen del documento y hace falta declarar ANTES de abrir la
    sesión de Didit para la licencia (workflow separado del de identidad):
    país emisor, PIC y residencia — todos opcionales, solo aplican al
    extranjero. Un chileno no manda nada.
    """
    licencia_pais_emisor: Optional[str] = None
    pic_url: Optional[str] = None
    es_residente_chile: Optional[bool] = None
    fecha_inicio_residencia: Optional[datetime] = None
    # "owner" | "renter": qué app inició el flujo, para que el callback de
    # Didit vuelva al deep link correcto (ver didit.callback_url_para).
    app: Optional[str] = None

class EnrolamientoARevision(BaseModel):
    """
    El usuario pide que un ejecutivo revise su caso a mano cuando la
    verificación automática lo rechazó por algo que no es calidad de foto
    (edad, documento vencido, control facial). No cobra el hold todavía.
    """
    motivo: Optional[str] = Field(default=None, max_length=200)
    descripcion: str = Field(min_length=1, max_length=4000)
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    foto_perfil_verificada_url: Optional[str] = None

class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    foto_perfil_verificada_url: Optional[str] = None
    foto_perfil_url: Optional[str] = None
    estado_documentos: str
    # Estado de la verificación con proveedor externo (Didit). Nulo cuando la
    # verificación externa está apagada — la app debe mirar estado_documentos.
    verificacion_externa_estado: Optional[str] = None
    # Estado de la licencia para arrendar (ver Usuario.licencia_estado). La
    # app lo usa para exigir la validación de licencia antes de reservar a
    # quien se verificó solo como dueño.
    licencia_estado: Optional[str] = None
    # Estado de la SESIÓN de Didit para la licencia (pendiente mientras la
    # app espera el webhook). Nulo si nunca se abrió una.
    licencia_verificacion_externa_estado: Optional[str] = None
    confianza_ocr: Optional[float] = 1.0
    notas_auditoria: Optional[str] = None
    # Estado de los antecedentes (certificados oficiales del Registro Civil): pendiente | revision |
    # bloqueado | limpio. La app lo usa para pedir los certificados antes de reservar.
    antecedentes_estado: Optional[str] = None
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

    tarjeta_estado: Optional[str] = "pendiente"
    tarjeta_ultimos4: Optional[str] = None
    tarjeta_marca: Optional[str] = None

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

    codigo_referido: Optional[str] = None
    referido_por_id: Optional[str] = None
    es_promotor: bool = False

class SesionVerificacionExternaOut(BaseModel):
    """Sesión hosted del proveedor de verificación (Didit). La app abre `url`."""
    url: str
    session_id: str
    estado: str  # pendiente | aprobada | ... (ver verificacion_externa.didit)

class CodigoReferidoUpdate(BaseModel):
    codigo: str

class InvitacionPromotorCreate(BaseModel):
    nota: Optional[str] = None

class InvitacionCodigoOut(BaseModel):
    id: str
    codigo: str
    tipo: str  # "promotor" | "referido"
    usado: bool
    usado_en: Optional[datetime] = None
    usado_por_nombre: Optional[str] = None
    link: str
    fecha_creacion: datetime

class NivelColaboradorOut(BaseModel):
    nivel: str  # bronce | plata | oro
    titulo: str
    comision_plataforma_pct: float
    bono_extra_pct: float
    referidos_activos: int
    proximo_nivel: Optional[str] = None
    faltantes_proximo_nivel: int = 0
    beneficios: List[str] = []

class ReferidoResumenOut(BaseModel):
    iniciales: str
    fecha_registro: str
    estado: str  # registrado | activo

class ValidacionCodigoReferidoOut(BaseModel):
    valido: bool
    codigo: str
    tipo: str = "referido"  # "promotor" | "referido"
    nombre_referente: Optional[str] = None
    mensaje: str
    beneficio_invitado: str
    usado: bool = False

class EstadisticasReferidosOut(BaseModel):
    """Resumen para el panel de "invita y gana" y colaboradores (ver referrals_service.obtener_estadisticas)."""
    codigo: Optional[str] = None
    link: str
    es_un_solo_uso: bool = True
    es_promotor: bool = False
    referidos_totales: int
    bono_activado_alguna_vez: bool
    bono_pct_vigente: float
    bono_origen: Optional[str] = None  # "invitado" | "referente" | None
    nivel_colaborador: Optional[NivelColaboradorOut] = None
    ultimos_referidos: Optional[List[ReferidoResumenOut]] = None

class CuentaBancariaUpdate(BaseModel):
    banco: str
    tipo_cuenta: str
    numero: str
    titular: Optional[str] = None
    rut: str

    @field_validator("rut", mode="before")
    @classmethod
    def check_rut_titular(cls, v: str) -> str:
        if not validar_rut_chileno(str(v)):
            raise ValueError("RUT chileno inválido (falla verificación Módulo 11)")
        return formatear_rut(str(v)) or str(v)

class CuentaCobroCreate(BaseModel):
    banco: str
    tipo_cuenta: str
    numero: str
    titular: Optional[str] = None
    rut: str

    @field_validator("rut", mode="before")
    @classmethod
    def _rut_valido(cls, v: str) -> str:
        if not validar_rut_chileno(str(v)):
            raise ValueError("RUT chileno inválido (falla verificación Módulo 11)")
        return formatear_rut(str(v)) or str(v)


class CuentaCobroOut(BaseModel):
    id: str
    banco: str
    tipo_cuenta: str
    numero: str
    titular: str
    rut: str
    predeterminada: bool


class TarjetaUpdate(BaseModel):
    """
    Registrar o reemplazar la tarjeta FUERA del enrolamiento inicial — para
    cuando quedó pendiente/rechazada, o directamente no se cargó, y hace
    falta antes de reservar o publicar un auto. El titular no es opcional:
    por protocolo de seguridad la tarjeta tiene que ser de quien tiene la
    cuenta, nunca de un tercero.
    """
    tarjeta_token: str
    tarjeta_ultimos4: str
    tarjeta_marca: Optional[str] = None
    tarjeta_titular: str

class TarjetaOut(BaseModel):
    tarjeta_estado: str
    tarjeta_ultimos4: Optional[str] = None
    tarjeta_marca: Optional[str] = None
    motivo: Optional[str] = None


class TarjetaVaultCreate(BaseModel):
    """
    Alta de una tarjeta en la bóveda. La app tokeniza contra Mercado Pago y
    manda solo el `card_token` (de un solo uso) más el `payment_method_id` que
    devolvió `/payment_methods`. El número de la tarjeta nunca llega al backend.

    `tipo` / `ultimos4` / `marca` son PISTAS que la app ya conoce (del toggle en
    modo prueba o de `/payment_methods`). El backend las usa cuando no puede
    consultar la tarjeta en Mercado Pago (modo simulado sin credenciales); si
    puede, manda MP.
    """
    card_token: str
    payment_method_id: Optional[str] = None
    device_id: Optional[str] = None
    tipo: Optional[Literal["credito", "debito"]] = None
    ultimos4: Optional[str] = None
    marca: Optional[str] = None


class PagarReservaRequest(BaseModel):
    """Elección de tarjetas en el checkout: débito para el cobro, crédito para la garantía."""
    tarjeta_cobro_id: str
    tarjeta_garantia_id: str
    device_id: Optional[str] = None
    # `card_token` de un uso que la app genera desde la tarjeta guardada + el CVV
    # que escribe el usuario. Si faltan, el backend lo genera sin CVV (solo sirve
    # si la cuenta de Mercado Pago tiene habilitado el cobro sin CVV).
    token_cobro: Optional[str] = None
    token_garantia: Optional[str] = None


class RenovarGarantiaRequest(BaseModel):
    """`card_token` de la tarjeta de la garantía, generado por la app con el CVV."""
    token_garantia: Optional[str] = None


class CobroPosteriorRequest(BaseModel):
    """Solicitud del dueño para cobrar TAG, peajes o multas dentro de los 30 días posteriores."""
    tipo: Literal["tag", "peaje", "multa", "otro"] = Field(..., description="'tag' | 'peaje' | 'multa' | 'otro'")
    monto: int = Field(..., gt=0, description="Monto en CLP a cobrar")
    descripcion: str = Field(..., min_length=3, max_length=500, description="Detalle del cobro")
    comprobante_url: str = Field(..., description="URL de la boleta o comprobante en almacenamiento seguro")


class CobroPosteriorOut(BaseModel):
    id: str
    reserva_id: str
    tipo: str
    monto: int
    estado: str
    referencia_pago: Optional[str] = None
    descripcion: str
    comprobante_url: str
    creado_en: datetime

class TelefonoDisponibleIn(BaseModel):
    telefono: str = Field(..., min_length=8, max_length=20)


class TelefonoDisponibleOut(BaseModel):
    disponible: bool


class PerfilBasicoUpdate(BaseModel):
    """
    Datos de perfil que NO son de identidad (no pasan por OCR/Módulo-11) —
    los puede actualizar una cuenta "simple" recién creada, sin haber hecho
    el enrolamiento KYC todavía.
    """
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = Field(default=None, max_length=300)
    foto_perfil_url: Optional[str] = None

    @field_validator("nombre", "direccion")
    @classmethod
    def sanitize_perfil(cls, v: Optional[str]) -> Optional[str]:
        return sanitize_text(v)

    @field_validator("telefono", mode="before")
    @classmethod
    def format_perfil_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return formatear_telefono_chileno(str(v))

class DocumentReviewRequest(BaseModel):
    accion: Literal["aprobar", "rechazar"]
    notas: str

class AutoDocumentosReviewRequest(BaseModel):
    accion: Literal["aprobar", "rechazar"]
    notas: Optional[str] = ""

class UsuarioRevisionOut(UserOut):
    """Lo que el panel necesita para revisar la identidad: `UserOut` no trae las fotos del carnet ni la licencia."""
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    licencia_numero: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    licencia_pais_emisor: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    es_residente_chile: Optional[bool] = None


class AutoPendienteKycOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    marca: str
    modelo: str
    anio: int
    patente: str
    tarifa_dia: int
    estado: str
    ubicacion_base: str
    fotos: List[str] = []
    
    doc_inscripcion_url: Optional[str] = None
    doc_permiso_circulacion_url: Optional[str] = None
    doc_soap_url: Optional[str] = None
    doc_revision_tecnica_url: Optional[str] = None
    doc_certificado_gases_url: Optional[str] = None
    doc_historial_vehicular_url: Optional[str] = None
    doc_seguro_url: Optional[str] = None
    doc_anotaciones_vigentes_url: Optional[str] = None
    documentos_verificados: bool = False
    # Verificación con documentos oficiales gratuitos (ver certificados_service)
    encargo_robo_estado: Optional[str] = None
    encargo_robo_consultado_en: Optional[datetime] = None
    anotaciones_aprobadas_en: Optional[datetime] = None

    dueno_id: str
    dueno_nombre: Optional[str] = None
    dueno_rut: Optional[str] = None
    dueno_email: Optional[str] = None
    dueno_telefono: Optional[str] = None

# ==============================================================================
# AUTOS
# ==============================================================================
# Tope defensivo: el enrolamiento pide 9 fotos guiadas; se deja holgura para
# retomas sin abrir la puerta a payloads gigantes.
MAX_FOTOS_AUTO = 40


def _validar_secuencia_fotos(fotos: list) -> list:
    """
    Deja la lista de URLs de fotos del auto EXACTAMENTE como la mandó el
    cliente: mismo orden, mismos elementos (la posición 0 es la foto frontal,
    la 1 la trasera, etc. — ver FOTOS_AUTO en el móvil). No reordena ni
    deduplica.

    Solo rechaza lo que rompería esa indexación: un elemento vacío, en blanco
    o que no sea texto correría todas las fotos siguientes una posición.
    """
    if fotos is None:
        return []
    if not isinstance(fotos, list):
        raise ValueError("El campo 'fotos' debe ser una lista de URLs.")
    if len(fotos) > MAX_FOTOS_AUTO:
        raise ValueError(f"Demasiadas fotos (máximo {MAX_FOTOS_AUTO}).")
    limpias = []
    for i, url in enumerate(fotos):
        if not isinstance(url, str) or not url.strip():
            raise ValueError(
                f"La foto en la posición {i} está vacía o no es una URL válida. "
                "Vuelve a subir esa toma antes de publicar."
            )
        limpias.append(url.strip())
    return limpias  # orden intacto


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
    equipamiento: Dict[str, Union[bool, int, str]] = {}

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

    @field_validator("fotos", mode="after")
    @classmethod
    def _fotos_en_orden(cls, v):
        return _validar_secuencia_fotos(v)

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
    doc_certificado_gases_url: Optional[str] = None
    doc_historial_vehicular_url: Optional[str] = None
    # Póliza de seguro comercial: OPCIONAL. Si viene, el router la pasa por OCR
    # y solo la guarda si se lee como un documento contractual de seguro; una
    # imagen genérica se descarta (el auto se publica igual).
    doc_seguro_url: Optional[str] = None

    # Instalar un GPS en el auto de otra persona exige su consentimiento
    # expreso: sin él el router no acepta la publicación.
    gps_consentimiento: bool = False

    @field_validator("patente")
    @classmethod
    def check_patente(cls, v: str) -> str:
        if not validar_patente_chilena(v):
            raise ValueError("Patente chilena inválida (ej. ABCD-12 o AB-12-34)")
        return v.upper()

    # Chile continental e insular, con holgura. Sirve para dos cosas que sí
    # pasan: coordenadas invertidas (longitud en el campo de latitud, un
    # clásico) y el (0, 0) que deja un formulario a medio llenar. Cualquiera
    # de las dos deja el pin del auto en medio del océano y al arrendatario
    # buscando un punto de entrega que no existe.
    LIMITES_CHILE: ClassVar[dict] = {"lat": (-56.0, -17.0), "lon": (-110.0, -66.0)}

    @field_validator("latitud")
    @classmethod
    def check_latitud(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        minimo, maximo = AutoBase.LIMITES_CHILE["lat"]
        if not (minimo <= v <= maximo):
            raise ValueError("La latitud está fuera de Chile. Vuelve a fijar el punto en el mapa.")
        return v

    @field_validator("longitud")
    @classmethod
    def check_longitud(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        minimo, maximo = AutoBase.LIMITES_CHILE["lon"]
        if not (minimo <= v <= maximo):
            raise ValueError("La longitud está fuera de Chile. Vuelve a fijar el punto en el mapa.")
        return v

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
    equipamiento: Optional[Dict[str, Union[bool, int, str]]] = None
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
    doc_certificado_gases_url: Optional[str] = None
    doc_historial_vehicular_url: Optional[str] = None
    doc_seguro_url: Optional[str] = None
    gps_consentimiento: Optional[bool] = None

    @field_validator("fotos", mode="after")
    @classmethod
    def _fotos_en_orden(cls, v):
        # Reemplazar el set completo de fotos también respeta el orden enviado.
        return None if v is None else _validar_secuencia_fotos(v)


class ValidarDocumentosAutoRequest(BaseModel):
    """
    Se manda apenas se sube CADA documento (no los 4 juntos): la app llama a
    esto una vez por casilla, así que en la práctica solo uno de los cuatro
    campos viene con URL por request.
    """
    patente: str
    doc_inscripcion_url: Optional[str] = None
    doc_permiso_circulacion_url: Optional[str] = None
    doc_soap_url: Optional[str] = None
    doc_revision_tecnica_url: Optional[str] = None
    doc_certificado_gases_url: Optional[str] = None
    doc_historial_vehicular_url: Optional[str] = None
    doc_seguro_url: Optional[str] = None


class VeredictoDocumentoAuto(BaseModel):
    tipo: str
    estado: str
    motivo: Optional[str] = None
    # Para los 4 documentos obligatorios es siempre False: la lectura es
    # informativa y POST /autos deriva a soporte ante duda en vez de rechazar.
    # La EXCEPCIÓN es el seguro comercial opcional (`tipo == "seguro"`): si el
    # dueño sube una imagen que no es una póliza, `bloquea=True` para que la
    # app no lo deje publicar con ese archivo (o lo quita, o sube el contrato).
    bloquea: bool = False


class ValidarDocumentosAutoResponse(BaseModel):
    verificado: bool
    documentos: List[VeredictoDocumentoAuto]


class AutoOut(AutoBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dueno_id: str
    estado: str
    documentos_verificados: bool = False
    # Folio / vencimiento que leyó el OCR de cada documento, por campo doc_*_url.
    # Solo lo ve el dueño o un admin (lo limpia _sanear_auto_out).
    documentos_ocr: Optional[Dict[str, Dict[str, Any]]] = None
    gps_instalado: Optional[bool] = False
    gps_consentimiento_fecha: Optional[datetime] = None
    fecha_publicacion: Optional[datetime] = None
    dueno_nombre: Optional[str] = None
    dueno_foto_url: Optional[str] = None

    # No son columnas del modelo: GET /autos las calcula por request y las
    # deja como atributos transitorios en cada Auto antes de serializar (ver
    # cars.py). Es la calificación del DUEÑO, no del auto — acá no hay
    # reseñas por vehículo, solo por persona (ver Calificacion.destinatario_id).
    rating_promedio: Optional[float] = None
    rating_cantidad: int = 0

    # Garantía (hold) que se retendrá al reservar, en CLP. Estimada por
    # categoría — el monto final lo fija el checkout con la config de la
    # plataforma. Lo llena el router, no es columna.
    monto_garantia: Optional[int] = None

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
# CONDUCTOR ADICIONAL / SEGUNDO CONDUCTOR
# ==============================================================================
class ConductorAdicionalBase(BaseModel):
    nombre: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    tipo_documento: Literal["rut", "pasaporte", "dni_extranjero"] = "rut"
    rut: Optional[str] = None
    numero_documento: Optional[str] = None
    pais_documento: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None

    licencia_pais_emisor: Optional[str] = None
    licencia_numero: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    es_residente_chile: bool = False
    fecha_inicio_residencia: Optional[datetime] = None

    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    selfie_url: Optional[str] = None

    @field_validator("rut", mode="before")
    @classmethod
    def check_rut_conductor(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        if not validar_rut_chileno(str(v)):
            raise ValueError("RUT chileno inválido para el segundo conductor (falla Módulo 11)")
        return formatear_rut(str(v))

    @field_validator("telefono", mode="before")
    @classmethod
    def format_conductor_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return formatear_telefono_chileno(str(v))

class ConductorAdicionalCreate(ConductorAdicionalBase):
    pass

class ConductorAdicionalUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    tipo_documento: Optional[Literal["rut", "pasaporte", "dni_extranjero"]] = None
    rut: Optional[str] = None
    numero_documento: Optional[str] = None
    pais_documento: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    licencia_pais_emisor: Optional[str] = None
    licencia_numero: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    es_residente_chile: Optional[bool] = None
    fecha_inicio_residencia: Optional[datetime] = None
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    selfie_url: Optional[str] = None

    @field_validator("rut", mode="before")
    @classmethod
    def check_rut_conductor_update(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        if not validar_rut_chileno(str(v)):
            raise ValueError("RUT chileno inválido (falla Módulo 11)")
        return formatear_rut(str(v))

    @field_validator("telefono", mode="before")
    @classmethod
    def format_conductor_update_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return formatear_telefono_chileno(str(v))

class ConductorAdicionalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reserva_id: str
    nombre: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    tipo_documento: Optional[str] = "rut"
    rut: Optional[str] = None
    numero_documento: Optional[str] = None
    pais_documento: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    licencia_pais_emisor: Optional[str] = None
    licencia_numero: Optional[str] = None
    licencia_clase: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None
    pic_url: Optional[str] = None
    pic_vencimiento: Optional[datetime] = None
    es_residente_chile: Optional[bool] = False
    fecha_inicio_residencia: Optional[datetime] = None
    carnet_frontal_url: Optional[str] = None
    carnet_trasero_url: Optional[str] = None
    licencia_url: Optional[str] = None
    selfie_url: Optional[str] = None
    estado_kyc: str = "pendiente"
    confianza_ocr: Optional[float] = 1.0
    notas_auditoria: Optional[str] = None
    verificacion_externa_estado: Optional[str] = None
    licencia_verificacion_externa_estado: Optional[str] = None
    antecedentes_estado: Optional[str] = None
    creado_en: datetime
    actualizado_en: Optional[datetime] = None

# ==============================================================================
# RESERVAS
# ==============================================================================
class BookingCreate(BaseModel):
    auto_id: str
    cliente_id: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    lugar_entrega_acordado: str
    segundo_conductor: Optional[ConductorAdicionalCreate] = None

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

class FirmaContratoRequest(BaseModel):
    metodo: Literal["huella", "facial", "escrita"]
    firma_svg: Optional[str] = Field(
        default=None, description="Trazo SVG de la firma manuscrita (obligatorio si metodo == 'escrita')"
    )
    nombre_firmante: Optional[str] = Field(
        default=None, description="Nombre con el que firma; si se omite se usa el del perfil verificado"
    )
    acepta_terminos: bool = Field(
        ..., description="Confirmación explícita de que el firmante leyó y acepta el contrato"
    )


class FirmaContratoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rol: str
    metodo: str
    nombre_firmante: Optional[str] = None
    hash_contrato_sha256: Optional[str] = None
    firmado_en: datetime


class LlegadaRequest(BaseModel):
    """
    Ubicación con la que una parte confirma su llegada. El servidor solo calcula la distancia al punto de
    encuentro: las coordenadas no se guardan. Son opcionales porque un auto sin coordenadas no se puede
    verificar; con coordenadas del auto, sin ellas la llegada se rechaza.
    """
    latitud: Optional[float] = Field(None, ge=-90, le=90)
    longitud: Optional[float] = Field(None, ge=-180, le=180)
    precision_m: Optional[float] = Field(None, ge=0)


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auto_id: str
    cliente_id: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    monto_hold: int
    monto_cobro: int = 0
    expira_en: Optional[datetime] = None
    # Plazo del dueño para confirmar una reserva pagada (estado "pendiente") y, si se canceló sola,
    # por qué ("dueno_no_confirmo" | "no_presentacion"). Ver confirmacion_service.
    confirmar_dueno_antes_de: Optional[datetime] = None
    motivo_cancelacion: Optional[str] = None
    # Cada parte avisa "ya llegué" al punto de encuentro; con eso se decide quién no se presentó.
    llegada_cliente_en: Optional[datetime] = None
    llegada_dueno_en: Optional[datetime] = None
    # Desglose del pago dual. Los llena el router al serializar (no son
    # columnas): `cobro` = lo que se cobra hoy a la tarjeta de débito
    # (`{monto, neto, iva}`), `garantia` = el hold sobre la de crédito
    # (`{monto}`).
    cobro: Optional[Dict[str, int]] = None
    garantia: Optional[Dict[str, int]] = None
    # La retención de la garantía vence antes de que termine el arriendo y el
    # arrendatario tiene que renovarla con su CVV (POST /reservas/{id}/garantia/renovar).
    garantia_por_renovar: bool = False
    tarjeta_garantia_id: Optional[str] = None
    tarjeta_cobro_id: Optional[str] = None
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
    hash_contrato_sha256: Optional[str] = None
    fecha_firma_biometrica: Optional[datetime] = None
    firmas: List[FirmaContratoOut] = []
    segundo_conductor: Optional[ConductorAdicionalOut] = None

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
    """
    Solo faltas simples constatables en la devolución (fumar, mascotas,
    limpieza, lugar no acordado). Peajes/TAG y fotomultas van por
    CobroPosteriorRequest (POST /reservas/{id}/cobro-posterior), que sí
    mueve dinero real contra la tarjeta de crédito de garantía.
    """
    tipo: Literal[
        "fumar",
        "lugar_no_acordado",
        "mascotas",
        "limpieza_estandar",
        "limpieza_profunda",
        "otro",
    ]
    monto_clp: Optional[int] = None
    motivo: str = Field(..., min_length=4, description="Justificación detallada de la falta/penalización")
    fotos: List[str] = Field(default=[], description="Fotografías de evidencia de la falta")

# ==============================================================================
# CONTRATOS API DE ENTREGA (FLUJO CRÍTICO)
# ==============================================================================
class GenerateQRResponse(BaseModel):
    reserva_id: str
    codigo_qr_hash: str
    expira_en: Optional[datetime] = None
    validez_segundos: int = 120
    foto_perfil_verificada_url: Optional[str] = None
    segundo_conductor: Optional[Dict[str, Any]] = None
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
    segundo_conductor: Optional[Dict[str, Any]] = None
    estado_reserva: str
    lugar_entrega_acordado: str
    arrendatario_ya_firmo: bool = False

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
    fotos: List[str] = Field(..., min_length=1, description="URLs de fotos del auto (8 ángulos en el checklist completo)")
    kilometraje: int = Field(..., gt=0)
    nivel_combustible: Literal["lleno", "3/4", "1/2", "1/4", "vacio"]
    estado_limpieza: Literal["limpio", "sucio_estandar", "sucio_profundo"] = "limpio"
    cargo_limpieza_clp: Optional[int] = None
    notas: Optional[str] = None
    firma_svg: Optional[str] = None
    selfie_entrega_url: Optional[str] = None

class ChecklistResponse(BaseModel):
    mensaje: str
    estado_reserva: str
    monto_cobro_final: Optional[int] = None
    cargo_limpieza: Optional[int] = None
    cargo_combustible: Optional[int] = None
    cargo_km_extra: Optional[int] = None
    cargo_atraso: Optional[int] = None
    liquidacion_dueno: Optional[int] = None

class AIDamageDetail(BaseModel):
    tipo: str
    probabilidad_pct: int
    zona: str
    descripcion: str

class AIDamageAnalysisRequest(BaseModel):
    fotos_despues: List[str] = Field(default_factory=list)
    fotos_antes: Optional[List[str]] = None
    notas: Optional[str] = None

class AIDamageAnalysisResponse(BaseModel):
    anomalia_detectada: bool
    confianza_general: int
    probabilidades: Dict[str, int]
    danos_detectados: List[AIDamageDetail] = Field(default_factory=list)
    sugerencia_dueno: str
    inspeccionado_en: str

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
    periodo_gracia_minutos: int = 30
    dias_cobro_posterior_peajes: int = 30
    edad_minima_arriendo: int = 21
    # { "<categoria>": {"base": int, "min": int} } — tarifas por categoría.
    tarifas_categoria: Optional[Dict[str, Dict[str, int]]] = {}
    # { "<categoria>": CLP } — garantía (hold) fija por categoría de vehículo.
    garantia_categoria_clp: Optional[Dict[str, int]] = {}
    # Programa de invitación (tramos decrecientes).
    bono_invitado_pct_t1: Optional[float] = None
    bono_invitado_pct_t2: Optional[float] = None
    bono_invitado_pct_t3: Optional[float] = None
    bono_invitado_dias_t1: Optional[int] = None
    bono_invitado_dias_t2: Optional[int] = None
    bono_invitado_dias_t3: Optional[int] = None
    bono_referente_pct_t1: Optional[float] = None
    bono_referente_pct_t2: Optional[float] = None
    bono_referente_dias_t1: Optional[int] = None
    bono_referente_dias_t2: Optional[int] = None
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
    tarifas_categoria: Optional[Dict[str, Dict[str, int]]] = None
    garantia_categoria_clp: Optional[Dict[str, int]] = None
    bono_invitado_pct_t1: Optional[float] = None
    bono_invitado_pct_t2: Optional[float] = None
    bono_invitado_pct_t3: Optional[float] = None
    bono_invitado_dias_t1: Optional[int] = None
    bono_invitado_dias_t2: Optional[int] = None
    bono_invitado_dias_t3: Optional[int] = None
    bono_referente_pct_t1: Optional[float] = None
    bono_referente_pct_t2: Optional[float] = None
    bono_referente_dias_t1: Optional[int] = None
    bono_referente_dias_t2: Optional[int] = None

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
    # Todas las fotos de evidencia (el panel las muestra); antes el esquema solo exponía una.
    evidencia_fotos: List[str] = []
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

class SiniestroCreate(BaseModel):
    descripcion: str = Field(..., min_length=10, max_length=3000)
    hubo_lesionados: bool = False
    hay_terceros: bool = False
    auto_puede_circular: bool = True
    parte_policial: Optional[str] = Field(None, max_length=100)
    datos_tercero: Optional[str] = Field(None, max_length=1000)
    ubicacion: Optional[str] = Field(None, max_length=300)
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    fotos: List[str] = Field(default_factory=list, max_length=20)

    @field_validator("descripcion", "parte_policial", "datos_tercero", "ubicacion")
    @classmethod
    def limpiar_texto(cls, v):
        return sanitize_text(v) if v else v


class SiniestroActualizacion(BaseModel):
    fecha: datetime
    autor: str
    mensaje: str


class SiniestroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    codigo: str
    reserva_id: str
    estado: str
    descripcion: str
    hubo_lesionados: bool
    hay_terceros: bool
    auto_puede_circular: bool
    parte_policial: Optional[str] = None
    datos_tercero: Optional[str] = None
    ubicacion: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    fotos: List[str] = []
    disputa_id: Optional[str] = None
    agente_id: Optional[str] = None
    atendido_en: Optional[datetime] = None
    dueno_contactado_en: Optional[datetime] = None
    actualizaciones: List[SiniestroActualizacion] = []
    resumen_cierre: Optional[str] = None
    cerrado_en: Optional[datetime] = None
    creado_en: datetime
    # Para la bandeja de soporte.
    auto_descripcion: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    dueno_nombre: Optional[str] = None
    dueno_telefono: Optional[str] = None


class SiniestroMensaje(BaseModel):
    mensaje: str = Field(..., min_length=5, max_length=2000)

    @field_validator("mensaje")
    @classmethod
    def limpiar(cls, v):
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
    # No es columna de Calificacion: GET /calificaciones la arma con un join
    # a Usuario. Sin esto, la reseña en la ficha del auto no tenía nombre que
    # mostrar — solo un autor_id que no le dice nada a nadie.
    autor_nombre: Optional[str] = None

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
    # card_token de la tarjeta del arriendo generado por la app con el CVV (ver PagarReservaRequest).
    token_cobro: Optional[str] = None

# ==============================================================================
# MENSAJERÍA (CHAT POR RESERVA)
# ==============================================================================
class MessageCreate(BaseModel):
    texto: str = Field(..., min_length=1, max_length=2000)
    client_id: Optional[str] = None

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
    leido: bool = False


class ConversacionResumen(BaseModel):
    """Fila de la lista de conversaciones: lo justo para pintarla sin abrirla."""
    reserva_id: str
    ultimo_mensaje: Optional[str] = None
    ultimo_timestamp: Optional[datetime] = None
    ultimo_autor_id: Optional[str] = None
    no_leidos: int = 0


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
