"""
Cuentas de cobro del dueño: alta, baja, listado y la predeterminada.

`usuario.cuenta_bancaria` (JSON) se mantiene como ESPEJO de la cuenta
predeterminada — igual que el patrón legacy `usuario.tarjeta_*` frente a la
tabla `tarjetas`. Todo lo que escribe llama a `sincronizar_cuenta_espejo`.
"""
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.entities import CuentaCobro, Usuario


class CuentaCobroError(Exception):
    def __init__(self, http_status: int, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.http_status = http_status
        self.codigo = codigo
        self.mensaje = mensaje

    def as_detail(self) -> Dict[str, Any]:
        return {"codigo": self.codigo, "mensaje": self.mensaje}


def _enmascarar(numero: str) -> str:
    n = (numero or "").strip()
    return f"••••{n[-4:]}" if len(n) >= 4 else n


def serializar(c: CuentaCobro) -> Dict[str, Any]:
    return {
        "id": c.id,
        "banco": c.banco,
        "tipo_cuenta": c.tipo_cuenta,
        "numero": _enmascarar(c.numero),
        "titular": c.titular,
        "rut": c.rut,
        "predeterminada": bool(c.predeterminada),
    }


def listar(db: Session, usuario: Usuario) -> List[CuentaCobro]:
    return (
        db.query(CuentaCobro)
        .filter(CuentaCobro.usuario_id == usuario.id)
        .order_by(CuentaCobro.predeterminada.desc(), CuentaCobro.creada_en.asc())
        .all()
    )


def _de_usuario(db: Session, usuario: Usuario, cuenta_id: str) -> CuentaCobro:
    c = (
        db.query(CuentaCobro)
        .filter(CuentaCobro.id == cuenta_id, CuentaCobro.usuario_id == usuario.id)
        .first()
    )
    if not c:
        raise CuentaCobroError(404, "CUENTA_NO_ENCONTRADA", "La cuenta no existe o no es tuya.")
    return c


def sincronizar_cuenta_espejo(db: Session, usuario: Usuario) -> None:
    pred = (
        db.query(CuentaCobro)
        .filter(CuentaCobro.usuario_id == usuario.id, CuentaCobro.predeterminada.is_(True))
        .first()
    )
    if pred:
        usuario.cuenta_bancaria = {
            "banco": pred.banco, "tipo_cuenta": pred.tipo_cuenta,
            "numero": pred.numero, "titular": pred.titular, "rut": pred.rut,
        }
    else:
        usuario.cuenta_bancaria = None
    db.commit()


def agregar(db: Session, usuario: Usuario, banco: str, tipo_cuenta: str,
           numero: str, titular: str, rut: str) -> CuentaCobro:
    existentes = db.query(CuentaCobro).filter(CuentaCobro.usuario_id == usuario.id).count()
    c = CuentaCobro(
        usuario_id=usuario.id,
        banco=banco.strip(), tipo_cuenta=tipo_cuenta.strip(),
        numero=numero.strip(), titular=titular.strip(), rut=rut.strip(),
        predeterminada=(existentes == 0),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    sincronizar_cuenta_espejo(db, usuario)
    db.refresh(c)
    return c


def marcar_predeterminada(db: Session, usuario: Usuario, cuenta_id: str) -> CuentaCobro:
    c = _de_usuario(db, usuario, cuenta_id)
    for otra in db.query(CuentaCobro).filter(CuentaCobro.usuario_id == usuario.id).all():
        otra.predeterminada = (otra.id == c.id)
    db.commit()
    sincronizar_cuenta_espejo(db, usuario)
    db.refresh(c)
    return c


def eliminar(db: Session, usuario: Usuario, cuenta_id: str) -> None:
    c = _de_usuario(db, usuario, cuenta_id)
    era_pred = bool(c.predeterminada)
    db.delete(c)
    db.commit()
    if era_pred:
        sig = (
            db.query(CuentaCobro)
            .filter(CuentaCobro.usuario_id == usuario.id)
            .order_by(CuentaCobro.creada_en.asc())
            .first()
        )
        if sig:
            sig.predeterminada = True
            db.commit()
    sincronizar_cuenta_espejo(db, usuario)
