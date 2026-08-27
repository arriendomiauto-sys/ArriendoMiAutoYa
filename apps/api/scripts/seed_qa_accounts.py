"""
Reconstruye la fila local (rentacar_dev.db) de las 4 cuentas QA documentadas
en QA_TEST_DATA.txt. Las cuentas de Supabase Auth ya existen (son reales,
viven en Supabase, no en este archivo) — este script solo re-crea sus filas
locales de Usuario/Auto/Reserva/TicketSoporte con los MISMOS ids de
Supabase Auth, para que get_current_user() las encuentre en el primer login
en vez de auto-provisionarlas como "cliente" nuevo sin roles.

Idempotente: si las cuentas QA ya existen (por email), no hace nada. Correr
de nuevo después de borrar rentacar_dev.db para recuperar este set de datos.

Uso:
    cd apps/api && PYTHONPATH=. python scripts/seed_qa_accounts.py
"""
from datetime import datetime, timedelta, timezone
from app.core.database import Base, engine, SessionLocal
from app.core.seed import seed_demo_data
from app.models.entities import Usuario, Auto, Reserva, Sucursal, TicketSoporte

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    # 1. Seed original (Carlos Mendoza, María José, admin@, manager.la@, etc.)
    #    — idempotente, solo inserta si la tabla usuarios está vacía.
    seed_demo_data(db)

    if db.query(Usuario).filter(Usuario.email == "qa.dueno@arriendatuauto.cl").first():
        print("Las cuentas QA ya existen — no se hace nada.")
        raise SystemExit(0)

    sucursal = db.query(Sucursal).filter(Sucursal.nombre == "Sucursal Los Ángeles Centro").first()
    if not sucursal:
        raise RuntimeError("No se encontró la sucursal del seed original — algo falló arriba.")

    # 2. Las 4 cuentas QA, keyed por el mismo id que ya tienen en Supabase Auth.
    dueno = Usuario(
        id="a3cc3273-74e7-4997-87af-224d250f594f",
        nombre="QA Dueño",
        rut="20.222.333-8",
        email="qa.dueno@arriendatuauto.cl",
        telefono="+56922222222",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["dueno", "cliente"],
        sucursal_id=sucursal.id,
    )
    cliente = Usuario(
        id="ebdf34ee-2956-48e1-b252-a8570ca058d8",
        nombre="QA Arrendatario",
        rut="20.111.222-2",
        email="qa.arrendatario@arriendatuauto.cl",
        telefono="+56911111111",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["cliente"],
    )
    admin = Usuario(
        id="ed03e387-193b-4c3e-9bc2-9127df973823",
        nombre="QA Admin",
        rut="20.333.444-3",
        email="qa.admin@arriendatuauto.cl",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["admin"],
    )
    manager = Usuario(
        id="a0954029-3d4f-49b5-a798-0a52587c674b",
        nombre="QA Manager",
        rut="20.444.555-9",
        email="qa.manager@arriendatuauto.cl",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["manager"],
        sucursal_id=sucursal.id,
    )
    db.add_all([dueno, cliente, admin, manager])
    db.flush()

    # 3. Los 2 autos QATS-01 / QATS-02 del dueño QA.
    auto_qats01 = Auto(
        dueno_id=dueno.id,
        marca="Chevrolet",
        modelo="Sail LT",
        anio=2023,
        patente="QATS-01",
        tarifa_dia=30000,
        estado="activo",
        ubicacion_base="Plaza de Armas, Los Ángeles",
        latitud=-37.4695,
        longitud=-72.3540,
        fotos=["https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800"],
    )
    auto_qats02 = Auto(
        dueno_id=dueno.id,
        marca="Nissan",
        modelo="Versa Sense",
        anio=2022,
        patente="QATS-02",
        tarifa_dia=27000,
        estado="activo",
        ubicacion_base="Av. Alemania, Los Ángeles",
        latitud=-37.4620,
        longitud=-72.3600,
        fotos=["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800"],
    )
    db.add_all([auto_qats01, auto_qats02])
    db.flush()

    # 4. La reserva confirmada lista para el flujo de entrega QR.
    ahora = datetime.now(timezone.utc)
    reserva = Reserva(
        id="b13f6aea-53ff-4d1b-bd50-4e7d1eec83cf",
        auto_id=auto_qats01.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora,
        fecha_fin=ahora + timedelta(days=3),
        estado="confirmada",
        monto_hold=90000,
        lugar_entrega_acordado="Plaza de Armas, Los Ángeles",
    )
    db.add(reserva)

    # 5. Un ticket de soporte abierto en la sucursal del manager QA.
    ticket = TicketSoporte(
        usuario_id=cliente.id,
        sucursal_id=sucursal.id,
        asunto="Consulta sobre punto de encuentro para la entrega",
        descripcion="Hola, ¿el auto se entrega justo en la plaza o hay un punto de encuentro más específico?",
    )
    db.add(ticket)

    db.commit()
    print("OK — cuentas QA, autos, reserva y ticket recreados.")
    print("sucursal_id real:", sucursal.id)
finally:
    db.close()
