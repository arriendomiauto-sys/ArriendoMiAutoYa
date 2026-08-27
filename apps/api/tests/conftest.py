import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.main import app
from app.core.seed import seed_demo_data
from app.models.entities import Usuario
from app.services.auth import get_current_user
from app.core.limiter import limiter

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
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
        user = Usuario(
            id=kwargs.get("id") or str(uuid.uuid4()),
            nombre=kwargs.get("nombre", "Usuario de Prueba"),
            rut=kwargs.get("rut"),
            email=kwargs.get("email") or f"{uuid.uuid4().hex[:10]}@test.cl",
            telefono=kwargs.get("telefono"),
            roles_activos=roles_activos if roles_activos is not None else ["cliente"],
            estado_documentos=kwargs.get("estado_documentos", "verificado"),
            sucursal_id=kwargs.get("sucursal_id"),
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
        return client
    return _auth_as
