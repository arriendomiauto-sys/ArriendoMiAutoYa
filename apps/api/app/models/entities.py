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
    foto_perfil_verificada_url = Column(String, nullable=True)
    estado_documentos = Column(String, default="pendiente") # pendiente, verificado, rechazado, requiere_revision_manual
    confianza_ocr = Column(Float, default=1.0)
    notas_auditoria = Column(Text, nullable=True)
    roles_activos = Column(JSON, default=lambda: ["cliente"]) # ["dueno", "cliente", "manager", "admin"]
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

    # Relaciones
    autos = relationship("Auto", back_populates="dueno", foreign_keys="Auto.dueno_id")
    reservas_cliente = relationship("Reserva", back_populates="cliente", foreign_keys="Reserva.cliente_id")
    tickets = relationship("TicketSoporte", back_populates="usuario")

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
    estado = Column(String, default="pendiente") # pendiente, confirmada, en_curso, finalizada, cancelada, disputada
    monto_hold = Column(Integer, default=0) # CLP
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
    periodo_gracia_minutos = Column(Integer, default=30) # Minutos de gracia en devolución
    dias_cobro_posterior_peajes = Column(Integer, default=60) # Plazo para imputar peajes/fotomultas tras la devolución
    edad_minima_arriendo = Column(Integer, default=21) # Edad mínima del arrendatario
    actualizado_en = Column(DateTime, default=utc_now, onupdate=utc_now)
    actualizado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)

