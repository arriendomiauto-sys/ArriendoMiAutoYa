from app.features.payments import cuentas_cobro_service as svc
from app.models.entities import CuentaCobro, Usuario


def _u(db):
    u = db.query(Usuario).first()
    u.cuenta_bancaria = None
    db.commit()
    return u


DATOS = dict(banco="BancoEstado", tipo_cuenta="CuentaRUT", numero="98765432",
             titular="Juan Perez", rut="11.111.111-1")


def test_primera_cuenta_queda_predeterminada_y_espejo(db_session):
    u = _u(db_session)
    c = svc.agregar(db_session, u, **DATOS)
    assert c.predeterminada is True
    db_session.refresh(u)
    assert u.cuenta_bancaria["numero"] == "98765432"


def test_segunda_cuenta_no_es_predeterminada(db_session):
    u = _u(db_session)
    svc.agregar(db_session, u, **DATOS)
    c2 = svc.agregar(db_session, u, **{**DATOS, "numero": "22223333"})
    assert c2.predeterminada is False


def test_marcar_predeterminada_mueve_flag_y_espejo(db_session):
    u = _u(db_session)
    c1 = svc.agregar(db_session, u, **DATOS)
    c2 = svc.agregar(db_session, u, **{**DATOS, "numero": "22223333"})
    svc.marcar_predeterminada(db_session, u, c2.id)
    db_session.refresh(c1); db_session.refresh(c2); db_session.refresh(u)
    assert c1.predeterminada is False and c2.predeterminada is True
    assert u.cuenta_bancaria["numero"] == "22223333"


def test_eliminar_predeterminada_asciende_otra(db_session):
    u = _u(db_session)
    c1 = svc.agregar(db_session, u, **DATOS)
    c2 = svc.agregar(db_session, u, **{**DATOS, "numero": "22223333"})
    svc.eliminar(db_session, u, c1.id)
    db_session.refresh(c2); db_session.refresh(u)
    assert c2.predeterminada is True
    assert u.cuenta_bancaria["numero"] == "22223333"


def test_eliminar_ultima_deja_espejo_none(db_session):
    u = _u(db_session)
    c1 = svc.agregar(db_session, u, **DATOS)
    svc.eliminar(db_session, u, c1.id)
    db_session.refresh(u)
    assert u.cuenta_bancaria is None


def test_eliminar_de_otro_usuario_falla(db_session):
    u = _u(db_session)
    c1 = svc.agregar(db_session, u, **DATOS)
    otro = Usuario(id="otro-user", nombre="Otro", email="otro@x.cl")
    db_session.add(otro); db_session.commit()
    try:
        svc.eliminar(db_session, otro, c1.id)
        assert False, "debió lanzar"
    except svc.CuentaCobroError as e:
        assert e.http_status == 404


def test_serializar_enmascara_numero(db_session):
    u = _u(db_session)
    c = svc.agregar(db_session, u, **DATOS)
    assert svc.serializar(c)["numero"] == "••••5432"
