import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
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

    # Relaciones
    dueno = relationship("Usuario", back_populates="autos", foreign_keys=[dueno_id])
    reservas = relationship("Reserva", back_populates="auto")

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
    monto_cobro_final = Column(Integer, default=0) # CLP
    liquidacion_dueno_clp = Column(Integer, default=0) # CLP
    codigo_qr_hash = Column(String, index=True, nullable=True)
    lugar_entrega_acordado = Column(String, nullable=False)
    contrato_pdf_url = Column(String, nullable=True)
    creado_en = Column(DateTime, default=utc_now)

    # Relaciones
    auto = relationship("Auto", back_populates="reservas")
    cliente = relationship("Usuario", back_populates="reservas_cliente", foreign_keys=[cliente_id])
    verificaciones = relationship("VerificacionEntrega", back_populates="reserva")
    checklists = relationship("ChecklistAuto", back_populates="reserva")
    pagos = relationship("Pago", back_populates="reserva")
    disputas = relationship("Disputa", back_populates="reserva")
    calificaciones = relationship("Calificacion", back_populates="reserva")

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
    timestamp = Column(DateTime, default=utc_now)

    # Relaciones
    reserva = relationship("Reserva", back_populates="checklists")

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
    referencia_transbank = Column(String, nullable=True)
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
    actualizado_en = Column(DateTime, default=utc_now, onupdate=utc_now)
    actualizado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)

