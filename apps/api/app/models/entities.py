

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String, primary_key=True, default=generate_uuid)
    nombre = Column(String, nullable=True)
    rut = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    telefono = Column(String, nullable=True)
    direccion = Column(String, nullable=True)  # dirección particular declarada en el enrolamiento
    foto_perfil_verificada_url = Column(String, nullable=True)
    foto_perfil_url = Column(String, nullable=True)
    estado_documentos = Column(String, default="pendiente") # pendiente, verificado, rechazado, requiere_revision_manual
    confianza_ocr = Column(Float, default=1.0)
    notas_auditoria = Column(Text, nullable=True)

    # Verificación de identidad con proveedor externo (Didit). Solo se usa
    # cuando settings.VERIFICACION_EXTERNA_HABILITADA está encendido; si no,
    # estas columnas quedan nulas y manda el OCR in-process.
    #   no_iniciada | pendiente | aprobada | rechazada | revision | expirada
    verificacion_externa_estado = Column(String, nullable=True)
    verificacion_externa_ref = Column(String, index=True, nullable=True)  # session_id del proveedor
    verificacion_externa_actualizada = Column(DateTime, nullable=True)
    metodo_verificacion = Column(String, nullable=True)  # "didit" | "casero" | "manual_admin"
    antecedentes_estado = Column(String, nullable=True)  # "limpio" | "revision" | "bloqueado"
    roles_activos = Column(JSON, default=lambda: ["cliente"]) # ["dueno", "cliente", "manager", "admin"]
    # Cuenta suspendida por un admin desde el panel: no puede iniciar sesión de
    # negocio (reservar, publicar). Se levanta desde el mismo panel.
    suspendido = Column(Boolean, default=False)
    sucursal_id = Column(String, ForeignKey("sucursales.id"), nullable=True)
    fecha_registro = Column(DateTime, default=utc_now)
    cuenta_bancaria = Column(JSON, nullable=True) # {"banco","tipo_cuenta","numero","titular","rut"} — solo dueños
    expo_push_token = Column(String, nullable=True) # token de expo-notifications del dispositivo

    # Documento de identidad. El chileno sigue viviendo en `rut` (único); un
    # extranjero se identifica con `numero_documento` + `pais_documento`.
    # ClaveÚnica no es una alternativa: solo la pueden integrar organismos del
    # Estado, así que la identidad se resuelve 100% vía proveedor KYC.
    tipo_documento = Column(String, default="rut")   # rut | pasaporte | dni_extranjero
    numero_documento = Column(String, index=True, nullable=True)
    pais_documento = Column(String, nullable=True)   # ISO-3166 alpha-2 ("CL", "AR", "VE"...)
    fecha_nacimiento = Column(DateTime, nullable=True)  # requerido para la edad mínima de arriendo

    # Licencia de conducir. Para chilenos basta la Clase B; para extranjeros
    # manda el árbol de decisión de `app/services/licencias.py`.
    licencia_pais_emisor = Column(String, nullable=True)  # ISO-3166 alpha-2
    licencia_numero = Column(String, nullable=True)
    licencia_clase = Column(String, nullable=True)
    licencia_vencimiento = Column(DateTime, nullable=True)
    # Estado de la licencia para ARRENDAR: None/"pendiente" (nunca se validó
    # — típico de una cuenta verificada solo como dueño), "verificada",
    # "revision" (un ejecutivo la está mirando). El renter no puede reservar
    # sin esto en "verificada".
    licencia_estado = Column(String, nullable=True)

    # Fotos permanentes de los documentos de identidad. Las llena el
    # enrolamiento (flujo casero) o el webhook de Didit tras rebajar los
    # assets temporales del proveedor a Supabase Storage (bucket privado
    # "documentos-kyc"). El avatar verificado vive en `foto_perfil_verificada_url`.
    carnet_frontal_url = Column(String, nullable=True)
    carnet_trasero_url = Column(String, nullable=True)
    licencia_url = Column(String, nullable=True)

    pic_url = Column(String, nullable=True)               # Permiso Internacional de Conducir
    pic_vencimiento = Column(DateTime, nullable=True)
    es_residente_chile = Column(Boolean, default=False)
    fecha_inicio_residencia = Column(DateTime, nullable=True)

    # Medio de pago. Una tarjeta validada es requisito para arrendar y para
    # publicar un auto: es la garantía de que hay de dónde cobrar el hold, los
    # cargos de la devolución y los peajes que llegan después.
    # NUNCA se guarda el número: solo el token de la pasarela y los datos
    # mínimos para que el usuario reconozca su tarjeta.
    tarjeta_token = Column(String, nullable=True)
    tarjeta_ultimos4 = Column(String, nullable=True)
    tarjeta_marca = Column(String, nullable=True)   # visa | mastercard | amex | otra
    tarjeta_estado = Column(String, default="pendiente")  # pendiente | validada | rechazada | requiere_revision_manual
    # Nombre tal como se declaró en el formulario de tarjeta. Por protocolo de
    # seguridad debe coincidir con el titular de la cuenta (`nombre`, viene de
    # la cédula) — se guarda para que soporte pueda auditar qué se declaró.
    tarjeta_titular = Column(String, nullable=True)
    # Id del `customer` en el vault de Mercado Pago. Se crea la primera vez que
    # el usuario guarda una tarjeta y agrupa todas sus tarjetas guardadas allá.
    mp_customer_id = Column(String, nullable=True)

    # Programa de invitación. `codigo_referido` es el código propio para
    # compartir (se genera perezosamente si viene NULL — ver
    # app/services/referidos.py); `referido_por_id` queda fijo la primera vez
    # que se aplica un código ajeno y nunca se puede reemplazar.
    # `bono_referido_activado_en` es el reloj de decaimiento de ESTE usuario
    # como quien invita: se refresca cada vez que alguien a quien invitó
    # completa su primera actividad real en la plataforma.
    codigo_referido = Column(String, nullable=True)
    referido_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    bono_referido_activado_en = Column(DateTime, nullable=True)

    # Relaciones
    autos = relationship("Auto", back_populates="dueno", foreign_keys="Auto.dueno_id")
    reservas_cliente = relationship("Reserva", back_populates="cliente", foreign_keys="Reserva.cliente_id")
    tickets = relationship("TicketSoporte", back_populates="usuario")
    tarjetas = relationship("Tarjeta", back_populates="usuario", cascade="all, delete-orphan")


class Tarjeta(Base):
    """
    Tarjeta guardada del usuario (bóveda multi-tarjeta en Mercado Pago).

    El usuario puede tener varias: el cobro del arriendo va a una de **débito**
    y la garantía (hold) a una de **crédito**. El `tipo` y el `titular` los
    define Mercado Pago al tokenizar — no se confía en lo que declare la app.
    Nunca se guarda el número: solo el `mp_card_id` del vault y los últimos
    cuatro dígitos.
    """
    __tablename__ = "tarjetas"

    id = Column(String, primary_key=True, default=generate_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)

    # Referencias en el vault de Mercado Pago.
    mp_customer_id = Column(String, nullable=True)
    mp_card_id = Column(String, nullable=True)

    marca = Column(String, nullable=True)        # visa | mastercard | amex | diners | otra
    ultimos4 = Column(String, nullable=True)
    vencimiento = Column(String, nullable=True)  # "MM/AA"
    tipo = Column(String, nullable=False)        # "credito" | "debito"
    titular = Column(String, nullable=True)
    # validada | requiere_revision_manual | rechazada
    estado = Column(String, default="validada", nullable=False)

    # Una por columna: la tarjeta preferida para el cobro y la preferida para
    # la garantía pueden ser distintas.
    predeterminada_cobro = Column(Boolean, default=False)
    predeterminada_garantia = Column(Boolean, default=False)

    creada_en = Column(DateTime, default=utc_now, nullable=False)

    usuario = relationship("Usuario", back_populates="tarjetas")


class CuentaCobro(Base):
    """
    Cuenta bancaria / de débito donde el dueño recibe sus liquidaciones.
    Varias por usuario, exactamente una `predeterminada`. `usuario.cuenta_bancaria`
    (JSON) se mantiene como espejo de la predeterminada para compat.
    """
    __tablename__ = "cuentas_cobro"

    id = Column(String, primary_key=True, default=generate_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    banco = Column(String, nullable=False)
    tipo_cuenta = Column(String, nullable=False)
    numero = Column(String, nullable=False)
    titular = Column(String, nullable=False)
    rut = Column(String, nullable=False)
    predeterminada = Column(Boolean, default=False)
    creada_en = Column(DateTime, default=utc_now)


class Auto(Base):
    __tablename__ = "autos"

    id = Column(String, primary_key=True, default=generate_uuid)
    dueno_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    marca = Column(String, nullable=False)
    modelo = Column(String, nullable=False)
    anio = Column(Integer, nullable=False)
    patente = Column(String, unique=True, index=True, nullable=False)
    tarifa_dia = Column(Integer, nullable=False) # CLP
    estado = Column(String, default="activo") # activo, pausado, mantenimiento
    ubicacion_base = Column(String, nullable=False)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    fotos = Column(JSON, default=list)
    equipamiento = Column(JSON, default=dict) # ej. {"ac": true, "bluetooth": true, "isofix": false, ...}

    # Ficha técnica del vehículo (se muestra en el detalle público del auto).
    transmision = Column(String, nullable=True)   # "automatica" | "mecanica"
    combustible = Column(String, nullable=True)   # "bencina" | "diesel" | "hibrido" | "electrico"
    asientos = Column(Integer, nullable=True)
    puertas = Column(Integer, nullable=True)
    categoria = Column(String, nullable=True)     # "economico" | "sedan" | "suv" | "camioneta" | "premium"
    descripcion = Column(Text, nullable=True)

    # Documentos legales del vehículo — obligatorios para publicar. Se
    # guardan como URLs de Supabase Storage (bucket privado documentos-autos).
    doc_inscripcion_url = Column(String, nullable=True)          # Certificado de inscripción / Padrón
    doc_permiso_circulacion_url = Column(String, nullable=True)  # Permiso de circulación vigente
    doc_soap_url = Column(String, nullable=True)                 # Seguro Obligatorio (SOAP) vigente
    doc_revision_tecnica_url = Column(String, nullable=True)     # Revisión técnica al día
    doc_seguro_url = Column(String, nullable=True)               # Póliza de seguro comercial (opcional; validada por OCR)
    documentos_verificados = Column(Boolean, default=False)     # Los revisó un ejecutivo

    # Rastreo GPS. Instalar un equipo en el auto de un tercero exige
    # consentimiento escrito del dueño: sin él no se publica el vehículo.
    gps_consentimiento = Column(Boolean, default=False)
    gps_consentimiento_fecha = Column(DateTime, nullable=True)
    gps_proveedor = Column(String, nullable=True)
    gps_device_id = Column(String, nullable=True)
    gps_instalado = Column(Boolean, default=False)
    gps_ultima_posicion = Column(JSON, nullable=True)  # {"lat","lon","timestamp","velocidad"}

    # Para el orden "Más recientes" del marketplace. Nullable porque los autos
    # publicados antes de este campo no tienen cómo rellenarlo retroactivo —
    # quedan al final de ese orden en vez de reventar la consulta.
    fecha_publicacion = Column(DateTime, default=utc_now, nullable=True)

    # Relaciones
    dueno = relationship("Usuario", back_populates="autos", foreign_keys=[dueno_id])
    reservas = relationship("Reserva", back_populates="auto")
    mantenciones = relationship("MantencionAuto", back_populates="auto")
    bloqueos_calendario = relationship("BloqueoCalendarioAuto", back_populates="auto")

class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(String, primary_key=True, default=generate_uuid)
    auto_id = Column(String, ForeignKey("autos.id"), nullable=False)
    cliente_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime, nullable=False)
    estado = Column(String, default="pendiente") # pendiente, pendiente_pago, confirmada, en_curso, finalizada, cancelada, disputada
    # `monto_cobro` = días × tarifa_dia (IVA incl.), se COBRA a la tarjeta de
    # débito. `monto_hold` = garantía fija por categoría, se RETIENE (hold) en
    # la tarjeta de crédito. Son dos movimientos distintos (ver el pago dual).
    monto_cobro = Column(Integer, default=0) # CLP
    monto_hold = Column(Integer, default=0) # CLP
    # TTL de la reserva mientras está en "pendiente_pago": si no se paga antes
    # de esta fecha, se libera el auto y la reserva pasa a "cancelada".
    expira_en = Column(DateTime, nullable=True)
    # Tarjetas elegidas en el checkout (bóveda). Se guardan para poder
    # reintentar el pago de una reserva pendiente y para bloquear el borrado
    # de una tarjeta que está respaldando un arriendo vivo.
    tarjeta_cobro_id = Column(String, ForeignKey("tarjetas.id"), nullable=True)
    tarjeta_garantia_id = Column(String, ForeignKey("tarjetas.id"), nullable=True)
    cargo_limpieza_clp = Column(Integer, default=0) # CLP (multa por devolución sucia)
    cargo_combustible_clp = Column(Integer, default=0) # CLP (estanque devuelto incompleto)
    cargo_km_extra_clp = Column(Integer, default=0) # CLP (exceso de kilometraje)
    cargo_atraso_clp = Column(Integer, default=0) # CLP (retraso en devolución)
    cargos_adicionales_clp = Column(Integer, default=0) # CLP
    cargo_falta_grave_clp = Column(Integer, default=0) # CLP (fumar, lugar no acordado, etc.)
    monto_cobro_final = Column(Integer, default=0) # CLP
    liquidacion_dueno_clp = Column(Integer, default=0) # CLP
    codigo_qr_hash = Column(String, index=True, nullable=True)
    lugar_entrega_acordado = Column(String, nullable=False)
    contrato_pdf_url = Column(String, nullable=True)
    hash_contrato_sha256 = Column(String(64), nullable=True)
    fecha_firma_biometrica = Column(DateTime, nullable=True)

    # Verificación / Pre-checkin 24 horas antes
    precheck_cliente_confirmado = Column(Boolean, default=False)
    precheck_cliente_timestamp = Column(DateTime, nullable=True)
    precheck_dueno_confirmado = Column(Boolean, default=False)
    precheck_dueno_timestamp = Column(DateTime, nullable=True)

    # Recordatorios push de entrega/devolución (ver app/services/recordatorios.py).
    # Un flag por aviso, no un solo "ya se avisó": el de 24h y el de 2h son
    # dos push distintos y cada uno se manda una sola vez.
    recordatorio_entrega_24h_enviado = Column(Boolean, default=False)
    recordatorio_entrega_2h_enviado = Column(Boolean, default=False)
    recordatorio_devolucion_24h_enviado = Column(Boolean, default=False)
    recordatorio_devolucion_2h_enviado = Column(Boolean, default=False)

    # Desglose y detalle de multas y penalizaciones
    motivo_multas = Column(Text, nullable=True)
    multas_detalle = Column(JSON, default=list) # [{tipo, monto, motivo, fecha, fotos}]

    creado_en = Column(DateTime, default=utc_now)

    # Relaciones
    auto = relationship("Auto", back_populates="reservas")
    cliente = relationship("Usuario", back_populates="reservas_cliente", foreign_keys=[cliente_id])
    verificaciones = relationship("VerificacionEntrega", back_populates="reserva")
    checklists = relationship("ChecklistAuto", back_populates="reserva")
    pagos = relationship("Pago", back_populates="reserva")
    disputas = relationship("Disputa", back_populates="reserva")
    calificaciones = relationship("Calificacion", back_populates="reserva")
    mensajes = relationship("Mensaje", back_populates="reserva")
    segundo_conductor = relationship("ConductorAdicional", back_populates="reserva", uselist=False, cascade="all, delete-orphan")
    firmas = relationship("FirmaContrato", back_populates="reserva", cascade="all, delete-orphan")


class FirmaContrato(Base):
    """
    Registro legal de la firma del contrato de arriendo, por parte (arrendatario
    y arrendador). Cada firma guarda el método usado, el instante exacto (UTC),
    el hash del PDF vigente al firmar (prueba de qué se firmó) y el contexto de
    red (IP / user-agent) para respaldo probatorio.
    """
    __tablename__ = "firmas_contrato"
    __table_args__ = (
        UniqueConstraint("reserva_id", "rol", name="uq_firma_contrato_reserva_rol"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    rol = Column(String, nullable=False)          # "arrendatario" | "arrendador"
    metodo = Column(String, nullable=False)       # "huella" | "facial" | "escrita"
    firma_svg = Column(Text, nullable=True)       # trazo SVG solo cuando metodo == "escrita"
    nombre_firmante = Column(String, nullable=True)
    hash_contrato_sha256 = Column(String(64), nullable=True)
    ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    firmado_en = Column(DateTime, default=utc_now, nullable=False)

    reserva = relationship("Reserva", back_populates="firmas")


class VerificacionEntrega(Base):
    __tablename__ = "verificaciones_entrega"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False)
    tipo = Column(String, nullable=False) # entrega, devolucion
    resultado = Column(String, nullable=False) # confirmada, rechazada
    foto_evidencia_url = Column(String, nullable=True)
    motivo_rechazo = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utc_now)
    dueno_id_que_verifica = Column(String, ForeignKey("usuarios.id"), nullable=False)

    # Relaciones
    reserva = relationship("Reserva", back_populates="verificaciones")

class ChecklistAuto(Base):
    __tablename__ = "checklists_auto"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False)
    tipo = Column(String, nullable=False) # antes, despues
    fotos = Column(JSON, default=list) # URLs de fotos (mínimo 9 obligatorias: 4 exterior, 3 interior, 1 tablero/odómetro/combustible, 1 limpieza)
    kilometraje = Column(Integer, nullable=False)
    nivel_combustible = Column(String, nullable=False) # lleno, 3/4, 1/2, 1/4, vacio
    estado_limpieza = Column(String, default="limpio") # limpio, sucio_estandar, sucio_profundo
    cargo_limpieza_clp = Column(Integer, default=0) # 0, 15000, 35000
    notas = Column(Text, nullable=True)
    # Trazo de la firma capturada en el checklist "antes" (entrega), como
    # path SVG — no una imagen: no hay librería de captura de pantalla
    # instalada (ni hace falta un rebuild nativo para agregarla). nullable
    # porque el checklist "despues" (devolución) no pide firma.
    firma_svg = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    # Relaciones
    reserva = relationship("Reserva", back_populates="checklists")


class Favorito(Base):
    __tablename__ = "favoritos"

    id = Column(String, primary_key=True, default=generate_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    auto_id = Column(String, ForeignKey("autos.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=utc_now)

    __table_args__ = (UniqueConstraint("usuario_id", "auto_id", name="uq_favorito_usuario_auto"),)

class Calificacion(Base):
    __tablename__ = "calificaciones"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False)
    autor_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    autor_rol = Column(String, nullable=False) # dueno, cliente
    destinatario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    puntaje = Column(Integer, nullable=False) # 1 a 5
    comentario = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    # Relaciones
    reserva = relationship("Reserva", back_populates="calificaciones")

class Pago(Base):
    __tablename__ = "pagos"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    tipo = Column(String, nullable=False) # hold_reserva, hold_enrolamiento, cobro_final, liquidacion_dueno, deducible_seguro, cargo_limpieza, cargo_combustible
    monto = Column(Integer, nullable=False)
    estado = Column(String, default="pendiente") # pendiente, capturado, liberado, fallido, reembolsado, pagado
    # Id del pago en la pasarela (Mercado Pago). Antes se llamaba
    # `referencia_transbank`; al cambiar de pasarela el nombre quedó mintiendo.
    referencia_pago = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    # Liquidación automática a la cuenta de cobro del dueño (ver liquidaciones_service).
    liquidado_en = Column(DateTime, nullable=True)
    intentos_liquidacion = Column(Integer, default=0)

    # Relaciones
    reserva = relationship("Reserva", back_populates="pagos")

class Disputa(Base):
    __tablename__ = "disputas"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False)
    tipo = Column(String, nullable=False) # no_coincidencia_identidad, dano, incumplimiento, limpieza, combustible, atraso, otro
    estado = Column(String, default="abierta") # abierta, en_revision, resuelta
    admin_asignado_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    motivo = Column(Text, nullable=True)
    foto_evidencia_url = Column(String, nullable=True)
    evidencia_fotos = Column(JSON, default=list)
    resolucion = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    # Relaciones
    reserva = relationship("Reserva", back_populates="disputas")

class TicketSoporte(Base):
    __tablename__ = "tickets_soporte"

    id = Column(String, primary_key=True, default=generate_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    sucursal_id = Column(String, ForeignKey("sucursales.id"), nullable=True)
    asunto = Column(String, nullable=False)
    descripcion = Column(Text, nullable=False)
    estado = Column(String, default="abierto") # abierto, en_revision, cerrado
    escalado_a_disputa = Column(Boolean, default=False)
    disputa_id = Column(String, ForeignKey("disputas.id"), nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    # Relaciones
    usuario = relationship("Usuario", back_populates="tickets")
    sucursal = relationship("Sucursal", back_populates="tickets")

class Sucursal(Base):
    __tablename__ = "sucursales"

    id = Column(String, primary_key=True, default=generate_uuid)
    nombre = Column(String, nullable=False)
    ubicacion = Column(String, nullable=False) # ej. "Los Ángeles, Chile"
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    radio_cobertura_km = Column(Float, default=25.0)
    managers_asignados = Column(JSON, default=list)

    # Relaciones
    tickets = relationship("TicketSoporte", back_populates="sucursal")

class MantencionAuto(Base):
    __tablename__ = "mantenciones_auto"

    id = Column(String, primary_key=True, default=generate_uuid)
    auto_id = Column(String, ForeignKey("autos.id"), nullable=False)
    tipo = Column(String, nullable=False) # documento_legal, servicio_mecanico
    nombre = Column(String, nullable=False) # ej. "Revisión Técnica", "Cambio de aceite"
    fecha_vencimiento = Column(DateTime, nullable=True) # solo aplica a documento_legal
    kilometraje = Column(Integer, nullable=True) # solo aplica a servicio_mecanico
    notas = Column(Text, nullable=True)
    documento_url = Column(String, nullable=True)
    creado_en = Column(DateTime, default=utc_now)

    # Relaciones
    auto = relationship("Auto", back_populates="mantenciones")

class BloqueoCalendarioAuto(Base):
    __tablename__ = "bloqueos_calendario_auto"

    id = Column(String, primary_key=True, default=generate_uuid)
    auto_id = Column(String, ForeignKey("autos.id"), nullable=False)
    fecha = Column(DateTime, nullable=False) # día bloqueado (00:00 del día)
    motivo = Column(String, nullable=True)
    creado_en = Column(DateTime, default=utc_now)

    # Relaciones
    auto = relationship("Auto", back_populates="bloqueos_calendario")

class Mensaje(Base):
    __tablename__ = "mensajes"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False)
    autor_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    texto = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now)
    # Lo marca el destinatario al abrir la conversación. Sirve para el punto
    # rojo de la pestaña Mensajes, que hasta ahora estaba pintado a mano en la
    # app y se veía encendido siempre, hubiera mensajes o no.
    leido = Column(Boolean, default=False)

    # Relaciones
    reserva = relationship("Reserva", back_populates="mensajes")

class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(String, primary_key=True, default=generate_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String, nullable=False)   # reserva | pago | entrega | mensaje | kyc | soporte | sistema
    titulo = Column(String, nullable=False)
    mensaje = Column(Text, nullable=False)
    leido = Column(Boolean, default=False)
    entidad_tipo = Column(String, nullable=True)  # "reserva" | "auto" | "ticket" ...
    entidad_id = Column(String, nullable=True)
    creado_en = Column(DateTime, default=utc_now, index=True)


class ConfiguracionPlataforma(Base):
    __tablename__ = "configuracion_plataforma"

    id = Column(String, primary_key=True, default="default")
    valor_uf_clp = Column(Float, default=38000.0) # Valor UF en pesos chilenos
    comision_plataforma_pct = Column(Float, default=20.0) # % comisión sobre arriendo base
    hold_enrolamiento_clp = Column(Integer, default=800000) # Garantía por usuario
    cargo_limpieza_estandar_clp = Column(Integer, default=15000) # Limpieza estándar
    cargo_limpieza_profunda_clp = Column(Integer, default=35000) # Limpieza profunda / tapiz
    cargo_combustible_cuarto_clp = Column(Integer, default=15000) # Cargo por 1/4 de estanque faltante
    cargo_km_extra_clp = Column(Integer, default=120) # CLP por km excedente
    km_diarios_incluidos = Column(Integer, default=250) # Km incluidos por día de arriendo
    periodo_gracia_minutos = Column(Integer, default=30) # Gracia antes de aplicar cargo de atraso
    dias_cobro_posterior_peajes = Column(Integer, default=30) # Plazo de 1 mes (30 días) para imputar peajes/fotomultas tras la devolución
    edad_minima_arriendo = Column(Integer, default=21) # Edad mínima del arrendatario

    # Bono/descuento de invitación, por tramos decrecientes. El invitado
    # ancla en su propia fecha_registro; quien invita ancla en
    # Usuario.bono_referido_activado_en (se refresca cuando UN invitado suyo
    # completa su primera actividad). Editable acá para no requerir deploy.
    bono_invitado_pct_t1 = Column(Float, default=15.0)   # % días 0-30 desde el registro del invitado
    bono_invitado_pct_t2 = Column(Float, default=8.0)    # % días 31-60
    bono_invitado_pct_t3 = Column(Float, default=3.0)    # % días 61-90
    bono_invitado_dias_t1 = Column(Integer, default=30)
    bono_invitado_dias_t2 = Column(Integer, default=60)
    bono_invitado_dias_t3 = Column(Integer, default=90)
    bono_referente_pct_t1 = Column(Float, default=8.0)   # % días 0-30 desde la activación de quien invitó
    bono_referente_pct_t2 = Column(Float, default=4.0)   # % días 31-60
    bono_referente_dias_t1 = Column(Integer, default=30)
    bono_referente_dias_t2 = Column(Integer, default=60)

    # Tarifas de referencia por categoría de vehículo, editables desde el
    # panel (Configuración → "Tarifas por categoría"). Por categoría:
    # `base` = precio que fija la plataforma y tope para el dueño;
    # `min` = piso hasta donde puede descontar (de $5.000 en $5.000). La app
    # móvil lo lee en el asistente de publicación; si viene vacío usa sus
    # propios defaults (packages/mobile-shared/vehiculo/catalogoPrecios.js).
    tarifas_categoria = Column(JSON, default=lambda: {
        "economico": {"base": 40000, "min": 25000},
        "sedan": {"base": 55000, "min": 35000},
        "suv": {"base": 80000, "min": 45000},
        "camioneta": {"base": 95000, "min": 55000},
        "premium": {"base": 180000, "min": 80000},
    })

    # Garantía (hold sobre la tarjeta de crédito) fija por categoría de
    # vehículo, en CLP. Editable desde el panel (Configuración → "Garantía por
    # categoría"). Si una categoría no está acá, el checkout usa el default de
    # `catalogo_garantias.GARANTIA_CATEGORIA_DEFECTO`.
    garantia_categoria_clp = Column(JSON, default=lambda: {
        "economico": 250000,
        "sedan": 350000,
        "suv": 500000,
        "camioneta": 600000,
        "premium": 1000000,
    })

    actualizado_en = Column(DateTime, default=utc_now, onupdate=utc_now)
    actualizado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)


class ConductorAdicional(Base):
    __tablename__ = "conductores_adicionales"

    id = Column(String, primary_key=True, default=generate_uuid)
    reserva_id = Column(String, ForeignKey("reservas.id"), nullable=False, unique=True, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, nullable=True)
    telefono = Column(String, nullable=True)

    # Identidad
    tipo_documento = Column(String, default="rut") # rut | pasaporte | dni_extranjero
    rut = Column(String, nullable=True, index=True)
    numero_documento = Column(String, nullable=True, index=True)
    pais_documento = Column(String, nullable=True) # ISO-3166 alpha-2
    fecha_nacimiento = Column(DateTime, nullable=True)

    # Licencia de conducir
    licencia_pais_emisor = Column(String, nullable=True)
    licencia_numero = Column(String, nullable=True)
    licencia_clase = Column(String, nullable=True)
    licencia_vencimiento = Column(DateTime, nullable=True)
    pic_url = Column(String, nullable=True)
    pic_vencimiento = Column(DateTime, nullable=True)
    es_residente_chile = Column(Boolean, default=False)
    fecha_inicio_residencia = Column(DateTime, nullable=True)

    # Documentos y fotos
    carnet_frontal_url = Column(String, nullable=True)
    carnet_trasero_url = Column(String, nullable=True)
    licencia_url = Column(String, nullable=True)
    selfie_url = Column(String, nullable=True)

    # Estado KYC y Verificación
    estado_kyc = Column(String, default="pendiente") # pendiente | verificado | requiere_revision_manual | rechazado
    confianza_ocr = Column(Float, default=1.0)
    notas_auditoria = Column(Text, nullable=True)

    creado_en = Column(DateTime, default=utc_now)
    actualizado_en = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relaciones
    reserva = relationship("Reserva", back_populates="segundo_conductor")


