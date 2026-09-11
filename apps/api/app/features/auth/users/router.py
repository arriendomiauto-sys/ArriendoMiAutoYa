from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Body, HTTPException, Response, status
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Usuario, Reserva
from app.schemas.schemas import (
    UserOut, CuentaBancariaUpdate, PerfilBasicoUpdate, TarjetaUpdate, TarjetaOut,
    CodigoReferidoUpdate, TarjetaVaultCreate, CuentaCobroCreate, CuentaCobroOut,
)
from app.features.auth.login.service import get_current_user
from app.services import tarjetas, referidos
from app.features.payments import wallet_service, cuentas_cobro_service
from app.features.system.storage.service import StorageService

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.get("/me", response_model=UserOut, summary="Obtener el perfil del usuario autenticado")
async def get_me(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Las URLs firmadas de la selfie de verificación expiran a los 7 días —
    # sin esto, la foto de perfil dejaba de cargar en silencio pasada esa
    # semana. Se renueva (y se guarda) recién cuando hace falta, no en cada
    # llamada.
    renovada = StorageService.renovar_si_vence_pronto(current_user.foto_perfil_verificada_url)
    if renovada and renovada != current_user.foto_perfil_verificada_url:
        current_user.foto_perfil_verificada_url = renovada
        db.commit()
        db.refresh(current_user)

    if getattr(current_user, "foto_perfil_url", None):
        renovada_perfil = StorageService.renovar_si_vence_pronto(current_user.foto_perfil_url)
        if renovada_perfil and renovada_perfil != current_user.foto_perfil_url:
            current_user.foto_perfil_url = renovada_perfil
            db.commit()
            db.refresh(current_user)

    # Autorepara cuentas sin código propio (nuevas y ya existentes) sin
    # necesitar un backfill aparte.
    if not current_user.codigo_referido:
        referidos.obtener_o_generar_codigo(current_user, db)

    return current_user

@router.put(
    "/me/codigo-referido",
    response_model=UserOut,
    summary="Registrar el código de quien invitó a este usuario",
)
def aplicar_codigo_referido(
    payload: CodigoReferidoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    try:
        referidos.aplicar_codigo_referido(current_user, payload.codigo, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(current_user)
    return current_user

@router.put(
    "/me/tarjeta",
    response_model=TarjetaOut,
    summary="Registrar o reemplazar la tarjeta de crédito fuera del enrolamiento inicial",
)
def actualizar_tarjeta(
    payload: TarjetaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Sin identidad verificada no hay con qué comparar el nombre del
    # titular — la tarjeta se pide junto al KYC la primera vez para que no
    # exista ninguna ventana donde se acepte una tarjeta sin ese cruce.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=403,
            detail="Verifica tu identidad antes de registrar una tarjeta.",
        )

    resultado = tarjetas.validar_tarjeta(
        payload.tarjeta_token,
        payload.tarjeta_ultimos4,
        payload.tarjeta_marca,
        titular=payload.tarjeta_titular,
        nombre_cuenta=current_user.nombre,
    )

    current_user.tarjeta_token = payload.tarjeta_token
    current_user.tarjeta_ultimos4 = payload.tarjeta_ultimos4
    current_user.tarjeta_marca = resultado["marca"]
    current_user.tarjeta_estado = resultado["estado"]
    current_user.tarjeta_titular = payload.tarjeta_titular
    db.commit()
    db.refresh(current_user)

    return TarjetaOut(
        tarjeta_estado=current_user.tarjeta_estado,
        tarjeta_ultimos4=current_user.tarjeta_ultimos4,
        tarjeta_marca=current_user.tarjeta_marca,
        motivo=resultado["motivo"],
    )

# ============================================================================
# Bóveda de tarjetas (multi-tarjeta). Reemplaza a PUT /me/tarjeta para el
# flujo nuevo: el usuario guarda varias y en el checkout elige débito (cobro)
# y crédito (garantía).
# ============================================================================
@router.get("/me/tarjetas", summary="Listar las tarjetas guardadas del usuario")
def listar_tarjetas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return {"tarjetas": [wallet_service.serializar(t) for t in wallet_service.listar(db, current_user)]}


@router.post("/me/tarjetas", status_code=status.HTTP_201_CREATED, summary="Guardar una tarjeta en la bóveda")
def agregar_tarjeta(
    payload: TarjetaVaultCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Sin identidad verificada no hay nombre contra el cual cruzar el titular.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(status_code=403, detail="Verifica tu identidad antes de registrar una tarjeta.")
    try:
        tarjeta = wallet_service.agregar(
            db, current_user,
            card_token=payload.card_token,
            payment_method_id=payload.payment_method_id,
            device_id=payload.device_id,
            tipo_hint=payload.tipo,
            ultimos4_hint=payload.ultimos4,
            marca_hint=payload.marca,
        )
    except wallet_service.WalletError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    return {"tarjeta": wallet_service.serializar(tarjeta)}


@router.delete("/me/tarjetas/{tarjeta_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una tarjeta de la bóveda")
def eliminar_tarjeta(
    tarjeta_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    try:
        wallet_service.eliminar(db, current_user, tarjeta_id)
    except wallet_service.WalletError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/me/perfil-basico",
    response_model=UserOut,
    summary="Actualizar nombre/teléfono de una cuenta simple (sin pasar por KYC)",
)
def actualizar_perfil_basico(
    payload: PerfilBasicoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.nombre = payload.nombre
    if payload.telefono is not None:
        current_user.telefono = payload.telefono
    if payload.direccion is not None:
        current_user.direccion = payload.direccion
    if payload.foto_perfil_url is not None:
        current_user.foto_perfil_url = payload.foto_perfil_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put(
    "/me/cuenta-bancaria",
    response_model=UserOut,
    summary="Registrar/actualizar la cuenta bancaria de depósito del dueño",
)
def actualizar_cuenta_bancaria(
    payload: CuentaBancariaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Compat: crea/actualiza la cuenta de cobro predeterminada. Este endpoint
    # maneja UNA sola cuenta, así que la que llega queda como predeterminada
    # aunque el dueño tenga otras cargadas por la pantalla nueva.
    existentes = cuentas_cobro_service.listar(db, current_user)
    pred = next((c for c in existentes if c.predeterminada), None)
    if pred:
        cuentas_cobro_service.eliminar(db, current_user, pred.id)
    nueva = cuentas_cobro_service.agregar(
        db, current_user,
        banco=payload.banco, tipo_cuenta=payload.tipo_cuenta,
        numero=payload.numero, titular=payload.titular, rut=payload.rut,
    )
    if not nueva.predeterminada:
        cuentas_cobro_service.marcar_predeterminada(db, current_user, nueva.id)
    # Intento de depósito de lo que estuviera pendiente por falta de cuenta.
    # Acotado a este usuario: el barrido global es solo del loop/admin.
    from app.features.payments import liquidaciones_service
    liquidaciones_service.ejecutar_liquidaciones_pendientes(db, usuario_id=current_user.id)
    db.refresh(current_user)
    return current_user


@router.put(
    "/me/push-token",
    summary="Registrar el token de notificaciones push (expo-notifications) del dispositivo",
)
def registrar_push_token(
    expo_push_token: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.expo_push_token = (expo_push_token or "").strip() or None
    db.commit()
    return {"ok": True}


# ============================================================================
# Cuentas de cobro del dueño (multi-cuenta). La predeterminada es a la que se
# depositan las liquidaciones; `usuario.cuenta_bancaria` la espeja.
# ============================================================================
@router.get("/me/cuentas-cobro", summary="Listar las cuentas de cobro del dueño")
def listar_cuentas_cobro(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    return {"cuentas_cobro": [
        CuentaCobroOut(**cuentas_cobro_service.serializar(c))
        for c in cuentas_cobro_service.listar(db, current_user)
    ]}


@router.post("/me/cuentas-cobro", status_code=status.HTTP_201_CREATED,
             summary="Agregar una cuenta de cobro")
def agregar_cuenta_cobro(payload: CuentaCobroCreate, db: Session = Depends(get_db),
                         current_user: Usuario = Depends(get_current_user)):
    try:
        c = cuentas_cobro_service.agregar(
            db, current_user,
            banco=payload.banco, tipo_cuenta=payload.tipo_cuenta,
            numero=payload.numero, titular=payload.titular, rut=payload.rut,
        )
    except cuentas_cobro_service.CuentaCobroError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    # Solo las liquidaciones de este dueño (ver nota en actualizar_cuenta_bancaria).
    from app.features.payments import liquidaciones_service
    liquidaciones_service.ejecutar_liquidaciones_pendientes(db, usuario_id=current_user.id)
    return {"cuenta_cobro": CuentaCobroOut(**cuentas_cobro_service.serializar(c))}


@router.delete("/me/cuentas-cobro/{cuenta_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Eliminar una cuenta de cobro")
def eliminar_cuenta_cobro(cuenta_id: str, db: Session = Depends(get_db),
                          current_user: Usuario = Depends(get_current_user)):
    try:
        cuentas_cobro_service.eliminar(db, current_user, cuenta_id)
    except cuentas_cobro_service.CuentaCobroError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me/cuentas-cobro/{cuenta_id}/predeterminada",
              summary="Marcar una cuenta de cobro como predeterminada")
def predeterminar_cuenta_cobro(cuenta_id: str, db: Session = Depends(get_db),
                               current_user: Usuario = Depends(get_current_user)):
    try:
        c = cuentas_cobro_service.marcar_predeterminada(db, current_user, cuenta_id)
    except cuentas_cobro_service.CuentaCobroError as e:
        raise HTTPException(status_code=e.http_status, detail=e.as_detail())
    return {"cuenta_cobro": CuentaCobroOut(**cuentas_cobro_service.serializar(c))}


@router.post(
    "/me/solicitar-eliminacion",
    summary="Solicita la baja de la cuenta, validando que no queden arriendos ni pagos en curso",
)
def solicitar_eliminacion(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # No borra nada por sí sola: registra la marca que soporte revisa para
    # tramitar la baja real. Bloquea mientras haya arriendos o pagos en
    # curso, sea como arrendatario o como dueño de flota.
    ESTADOS_ACTIVOS = ("pendiente_pago", "confirmada", "en_curso", "disputada")
    reservas_cliente = (
        db.query(Reserva)
        .filter(Reserva.cliente_id == current_user.id, Reserva.estado.in_(ESTADOS_ACTIVOS))
        .count()
    )
    autos_ids = [a.id for a in current_user.autos]
    reservas_dueno = (
        db.query(Reserva)
        .filter(Reserva.auto_id.in_(autos_ids), Reserva.estado.in_(ESTADOS_ACTIVOS))
        .count()
        if autos_ids else 0
    )
    if reservas_cliente or reservas_dueno:
        bloqueos = []
        if reservas_cliente:
            bloqueos.append(f"{reservas_cliente} arriendo(s) tuyo(s) en curso o pendiente(s)")
        if reservas_dueno:
            bloqueos.append(f"{reservas_dueno} reserva(s) de tu flota en curso o pendiente(s)")
        raise HTTPException(
            status_code=409,
            detail=f"No puedes eliminar tu cuenta todavía: tienes {' y '.join(bloqueos)}. Espera a que terminen y vuelve a intentarlo.",
        )
    current_user.eliminacion_solicitada_en = datetime.now(timezone.utc)
    db.commit()
    return {"solicitado": True, "mensaje": "Tu solicitud quedó registrada. Soporte confirma la baja por correo dentro de 48 horas hábiles."}
