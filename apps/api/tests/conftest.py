import os

# La suite NUNCA debe tocar la base real. El `.env` local puede apuntar a
# Supabase; se fuerza sqlite en memoria antes de importar `app.main` (que crea
# el engine al importarse). El engine de los tests se define más abajo aparte.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.main import app
from app.models.entities import (
    Usuario,
    Auto,
    Reserva,
    Sucursal,
    Pago,
    TicketSoporte,
    ConfiguracionPlataforma,
)
from app.services.auth import get_current_user, get_optional_current_user
from app.core.limiter import limiter
from datetime import datetime, timedelta, timezone

def seed_demo_data(db):
    if db.query(Usuario).count() > 0:
        return
    if not db.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.id == "default").first():
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
            periodo_gracia_minutos=30,
            dias_cobro_posterior_peajes=60,
            edad_minima_arriendo=21,
        )
        db.add(config)
    sucursal_la = Sucursal(
        nombre="Sucursal Los Ángeles Centro",
        ubicacion="Los Ángeles, Región del Biobío, Chile",
        latitud=-37.4697,
        longitud=-72.3537,
        radio_cobertura_km=30.0,
        managers_asignados=[],
    )
    db.add(sucursal_la)
    db.flush()
    dueno = Usuario(
        nombre="Carlos Mendoza",
        rut="15.892.341-6",
        email="dueno@arriendatuauto.cl",
        telefono="+56911223344",
        foto_perfil_verificada_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        estado_documentos="verificado",
        confianza_ocr=0.98,
        roles_activos=["dueno", "cliente"],
        sucursal_id=sucursal_la.id,
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
        sucursal_id=sucursal_la.id,
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
        sucursal_id=sucursal_la.id,
    )
    manager = Usuario(
        nombre="Rodrigo Manager",
        rut="14.333.222-5",
        email="manager.la@arriendatuauto.cl",
        telefono="+56955443322",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["manager"],
        sucursal_id=sucursal_la.id,
    )
    admin = Usuario(
        nombre="Administrador General",
        rut="11.222.333-9",
        email="admin@arriendatuauto.cl",
        telefono="+56912345678",
        estado_documentos="verificado",
        confianza_ocr=1.0,
        roles_activos=["admin"],
    )
    db.add_all([dueno, cliente, cliente_pendiente, manager, admin])
    db.flush()
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
        fotos=["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800"],
        gps_consentimiento=True,
        gps_consentimiento_fecha=datetime.now(timezone.utc),
        gps_proveedor="mock",
        gps_device_id="GPS-BBCL10",
        gps_instalado=True,
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
        fotos=["https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"],
        gps_consentimiento=True,
        gps_consentimiento_fecha=datetime.now(timezone.utc),
        gps_proveedor="mock",
        gps_device_id="GPS-CRTX45",
        gps_instalado=True,
    )
    db.add_all([auto1, auto2])
    db.flush()
    ahora = datetime.now(timezone.utc)
    reserva_demo = Reserva(
        auto_id=auto1.id,
        cliente_id=cliente.id,
        fecha_inicio=ahora,
        fecha_fin=ahora + timedelta(days=3),
        estado="confirmada",
        monto_hold=126000,
        codigo_qr_hash="qr_demo_hash_12345",
        lugar_entrega_acordado="Plaza de Armas Los Ángeles",
    )
    db.add(reserva_demo)
    db.flush()
    pago_enrolamiento = Pago(
        usuario_id=cliente.id,
        tipo="hold_enrolamiento",
        monto=800000,
        estado="capturado",
        referencia_pago="MP-DEMO-ENROL-800K",
    )
    pago_reserva = Pago(
        reserva_id=reserva_demo.id,
        usuario_id=cliente.id,
        tipo="hold_reserva",
        monto=126000,
        estado="capturado",
        referencia_pago="MP-DEMO-RES-126K",
    )
    db.add_all([pago_enrolamiento, pago_reserva])
    db.commit()

# En memoria: create_all()/drop_all() corren ~80 veces en la suite y un
# archivo real en disco no aporta nada (no se inspecciona entre corridas) —
# solo agrega I/O innecesario. Bajó el tiempo de la suite de ~170s a ~6s.
# StaticPool es obligatorio para :memory: porque cada conexión nueva a
# :memory: ve una DB vacía distinta; con StaticPool todas las conexiones
# comparten la misma DB en memoria.
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_demo_data(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def _ocr_en_mock():
    """
    La suite no debe llamar a Google Cloud Vision ni salir a la red: el
    pipeline de OCR corre en modo simulación determinista. Los casos reales
    de Vision (RUT ilegible, control facial) se prueban aparte con imágenes
    sintéticas, no acá.

    También se apaga la verificación externa (Didit): el `.env` local puede
    tenerla encendida con llaves reales, y sin esto cada test de /completar
    intentaría salir a la API de Didit. Los tests que la ejercitan la
    encienden con su propio fixture (ver test_verificacion_externa.py).
    """
    from app.core.config import settings
    previos = {
        "USE_OCR_MOCK": settings.USE_OCR_MOCK,
        "VERIFICACION_EXTERNA_HABILITADA": settings.VERIFICACION_EXTERNA_HABILITADA,
    }
    settings.USE_OCR_MOCK = True
    settings.VERIFICACION_EXTERNA_HABILITADA = False
    yield
    for k, v in previos.items():
        setattr(settings, k, v)


@pytest.fixture(autouse=True)
def _push_inline(monkeypatch):
    """
    El push a Expo se despacha a un ThreadPoolExecutor en producción. En los
    tests se corre inline para que los `patch("httpx.Client")` de cada test
    sigan valiendo y ningún hilo escape a la red real de Expo.
    """
    from app.features.communications.notifications import service as notif_service

    class _EjecutorInline:
        def submit(self, fn, *args, **kwargs):
            try:
                fn(*args, **kwargs)
            except Exception:
                pass
            return None

    monkeypatch.setattr(notif_service, "_push_executor", _EjecutorInline())


@pytest.fixture(autouse=True)
def _reset_token_cache():
    """
    El cache de validación de sesión (app.services.auth) vive a nivel de
    proceso: sin esto, un `user_id` cacheado en un test apuntaría a una fila
    que el siguiente test ya borró con `drop_all`.
    """
    from app.services.auth import limpiar_cache_tokens
    limpiar_cache_tokens()
    yield
    limpiar_cache_tokens()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """
    El limiter (slowapi) vive a nivel de módulo/proceso, no por test — sin
    esto, los contadores de "N requests por minuto" se acumularían entre
    tests distintos y algunos empezarían a fallar con 429 según el orden
    en que corra la suite.
    """
    limiter.reset()
    yield
    limiter.reset()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def usuario_factory(db_session):
    """
    Crea y persiste un Usuario de prueba con los roles indicados. No pasa
    por Supabase Auth en absoluto: es solo la fila local, para probar la
    lógica de cada endpoint (ownership, roles) de forma aislada.
    """
    def _factory(roles_activos=None, **kwargs):
        estado_documentos = kwargs.get("estado_documentos", "verificado")
        user = Usuario(
            id=kwargs.get("id") or str(uuid.uuid4()),
            nombre=kwargs.get("nombre", "Usuario de Prueba"),
            rut=kwargs.get("rut"),
            email=kwargs.get("email") or f"{uuid.uuid4().hex[:10]}@test.cl",
            telefono=kwargs.get("telefono"),
            roles_activos=roles_activos if roles_activos is not None else ["cliente"],
            estado_documentos=estado_documentos,
            sucursal_id=kwargs.get("sucursal_id"),
            # Un usuario verificado tiene, por definición, una tarjeta validada:
            # se registra junto con el KYC y sin ella no puede arrendar ni
            # publicar. Los tests que prueban justamente esa puerta pasan
            # `tarjeta_estado` explícito.
            tarjeta_estado=kwargs.get("tarjeta_estado", "validada"),
            tarjeta_ultimos4=kwargs.get("tarjeta_ultimos4", "4242"),
            tarjeta_marca=kwargs.get("tarjeta_marca", "visa"),
            tarjeta_token=kwargs.get("tarjeta_token", "tok-test"),
            expo_push_token=kwargs.get("expo_push_token"),
            # Un usuario "verificado" salió del KYC: en producción eso deja
            # licencia_clase poblada (default "B" para chilenos si no la trae
            # el OCR — ver onboarding/router.py). Solo se aplica ese default
            # cuando estado_documentos ya es "verificado": un usuario
            # "pendiente" (todavía no pasó KYC) no debe traerlo, ver
            # test_verification_kyc.py::...persiste_identidad_pero_no_la_licencia.
            licencia_pais_emisor=kwargs.get("licencia_pais_emisor"),
            licencia_clase=kwargs.get("licencia_clase", "B" if estado_documentos == "verificado" else None),
            licencia_estado=kwargs.get("licencia_estado"),
            fecha_nacimiento=kwargs.get("fecha_nacimiento"),
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user
    return _factory

@pytest.fixture
def auth_as(client):
    """
    Devuelve una función `auth_as(usuario)` que autentica el `client` de
    pruebas como ese usuario, sobreescribiendo la dependencia
    `get_current_user` directamente (sin pasar por la verificación real de
    token contra Supabase). Es la forma correcta de probar la lógica de
    cada endpoint (ownership, roles) sin acoplarla a la red real — esa
    verificación de token se prueba aparte en test_auth_dependency.py.
    """
    def _auth_as(usuario):
        app.dependency_overrides[get_current_user] = lambda: usuario
        app.dependency_overrides[get_optional_current_user] = lambda: usuario
        return client
    return _auth_as
