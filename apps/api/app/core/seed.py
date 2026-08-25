from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.models.entities import Usuario, Auto, Reserva, Sucursal, Pago, TicketSoporte, Disputa, ConfiguracionPlataforma

def seed_demo_data(db: Session):
    # Verificar si ya existen datos
    if db.query(Usuario).count() > 0:
        return

    # 0. Configuración Dinámica de Plataforma (RF-33)
    config = ConfiguracionPlataforma(
        id="default",
        valor_uf_clp=38000.0,
        comision_plataforma_pct=20.0,
        hold_enrolamiento_clp=800000,
        cargo_limpieza_estandar_clp=15000,
        cargo_limpieza_profunda_clp=35000,
        cargo_combustible_cuarto_clp=15000,
        cargo_km_extra_clp=120,
        km_diarios_incluidos=250,
        periodo_gracia_minutos=30
    )
    db.add(config)

    # 1. Sucursal Los Ángeles, Chile
    sucursal_la = Sucursal(
        nombre="Sucursal Los Ángeles Centro",
        ubicacion="Los Ángeles, Región del Biobío, Chile",
        latitud=-37.4697,
        longitud=-72.3537,
        radio_cobertura_km=30.0,
        managers_asignados=[]
    )
    db.add(sucursal_la)
    db.flush()

    # 2. Usuarios con RUTs chilenos matemáticamente válidos (Módulo 11)
    dueno = Usuario(
        nombre="Carlos Mendoza",
        rut="15.892.341-6",
        email="dueno@arriendatuauto.cl",
        telefono="+56911223344",
        foto_perfil_verificada_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        estado_documentos="verificado",
        confianza_ocr=0.98,
        roles_activos=["dueno", "cliente"],
        sucursal_id=sucursal_la.id
    )
    cliente = Usuario(
        nombre="María José Silva",
        rut="19.234.567-7",
        email="cliente@arriendatuauto.cl",
        telefono="+56999887766",
        foto_perfil_verificada_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
        estado_documentos="verificado",
        confianza_ocr=0.96,
        roles_activos=["cliente"],
        sucursal_id=sucursal_la.id
    )
    cliente_pendiente = Usuario(
        nombre="Pedro Alarcón Gómez",
        rut="18.456.789-K",
        email="pedro.alarcon@gmail.com",
        telefono="+56977665544",
        foto_perfil_verificada_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        estado_documentos="requiere_revision_manual",
        confianza_ocr=0.74,
        notas_auditoria="Foto de carnet con leve reflejo de luz. Requiere confirmación visual de Admin.",
        roles_activos=["cliente"],
        sucursal_id=sucursal_la.id
    )
    manager = Usuario(
        nombre="Rodrigo Manager",
        rut="14.333.222-5",
        email="manager.la@arriendatuauto.cl",
        telefono="+56955443322",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["manager"],
        sucursal_id=sucursal_la.id
    )
    admin = Usuario(
        nombre="Administrador General",
        rut="11.222.333-9",
        email="admin@arriendatuauto.cl",
        telefono="+56912345678",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["admin"]
    )
    db.add_all([dueno, cliente, cliente_pendiente, manager, admin])
    db.flush()

    # 3. Autos demo en Los Ángeles
    auto1 = Auto(
        dueno_id=dueno.id,
        marca="Toyota",
        modelo="RAV4 Limited 4x4",
        anio=2023,
        patente="BBCL-10",
        tarifa_dia=42000,
        estado="activo",
        ubicacion_base="Plaza de Armas, Los Ángeles",
        latitud=-37.4695,
        longitud=-72.3540,
        fotos=[
            "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800",
            "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800"
        ]
    )
    auto2 = Auto(
        dueno_id=dueno.id,
        marca="Hyundai",
        modelo="Tucson GL",
        anio=2022,
        patente="CRTX-45",
        tarifa_dia=35000,
        estado="activo",
        ubicacion_base="Av. Alemania, Los Ángeles",
        latitud=-37.4620,
        longitud=-72.3600,
        fotos=[
            "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"
        ]
    )
    auto3 = Auto(
        dueno_id=dueno.id,
        marca="Suzuki",
        modelo="Jimny AllGrip 4x4",
        anio=2024,
        patente="JKLM-56",
        tarifa_dia=48000,
        estado="activo",
        ubicacion_base="Centro, Los Ángeles",
        latitud=-37.4680,
        longitud=-72.3520,
        fotos=[
            "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"
        ]
    )
    db.add_all([auto1, auto2, auto3])
    db.flush()

    # 4. Reserva confirmada de ejemplo (lista para escaneo QR)
    ahora = datetime.now(timezone.utc)
    reserva_demo = Reserva(
        auto_id=auto1.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora,
        fecha_fin=ahora + timedelta(days=3),
        estado="confirmada",
        monto_hold=126000, # 3 días * 42.000 CLP
        codigo_qr_hash="qr_demo_hash_12345",
        lugar_entrega_acordado="Plaza de Armas Los Ángeles"
    )
    db.add(reserva_demo)
    db.flush()

    # 5. Hold de enrolamiento y hold de reserva
    pago_enrolamiento = Pago(
        usuario_id=cliente.id,
        tipo="hold_enrolamiento",
        monto=800000,
        estado="capturado",
        referencia_transbank="TBK-DEMO-ENROL-800K"
    )
    pago_reserva = Pago(
        reserva_id=reserva_demo.id,
        usuario_id=cliente.id,
        tipo="hold_reserva",
        monto=126000,
        estado="capturado",
        referencia_transbank="TBK-DEMO-RES-126K"
    )
    db.add_all([pago_enrolamiento, pago_reserva])

    # 6. Ticket de Soporte demo
    ticket = TicketSoporte(
        usuario_id=cliente.id,
        sucursal_id=sucursal_la.id,
        asunto="Consulta sobre punto de encuentro en Plaza de Armas",
        descripcion="Hola, quisiera confirmar si el dueño puede entregar el auto frente a la Municipalidad."
    )
    db.add(ticket)
    db.commit()

def reset_and_seed():
    """Limpia todas las tablas y vuelve a insertar los datos demo."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
