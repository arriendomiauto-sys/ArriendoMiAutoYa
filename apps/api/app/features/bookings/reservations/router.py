from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from datetime import datetime, timezone, timedelta
from app.schemas.schemas import (
    BookingCreate,
    BookingOut,
    ExtendBookingRequest,
    PreCheckinRequest,
    PreCheckinResponse,
    AplicarMultaRequest,
    ConductorAdicionalCreate,
    ConductorAdicionalUpdate,
    ConductorAdicionalOut,
    FirmaContratoRequest,
    FirmaContratoOut,
    SesionVerificacionExternaOut,
)
from app.models.entities import Reserva, Auto, Usuario, Pago, ConductorAdicional, FirmaContrato, Mensaje
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.auth.onboarding.contract_service import ContractService
from app.features.auth.onboarding.fines_service import FinesService
from app.features.communications.notifications.service import crear_notificacion
from app.features.auth.login.service import get_current_user
from app.features.auth.didit import didit as verificacion_didit
from app.features.auth.background_checks import BackgroundCheckService
from app.features.auth.onboarding.driver_kyc_service import ConductorKycService
from app.core.limiter import limiter
import uuid

from app.core.validators import validar_disponibilidad_reserva
from app.features.auth.onboarding.license_service import evaluar_licencia_usuario
from app.services import tarjetas
from app.features.payments import checkout_service

router = APIRouter(prefix="/reservas", tags=["Reservas"])


def _con_desglose_pago(reserva: Reserva):
    """
    Adjunta a la reserva (atributos transitorios, no columnas) el desglose del
    pago dual que BookingOut expone: `cobro` = {monto, neto, iva} a la tarjeta
    de débito, `garantia` = {monto} del hold sobre la de crédito.
    """
    reserva.cobro = checkout_service.desglose_cobro(reserva.monto_cobro or 0)
    reserva.garantia = {"monto": int(reserva.monto_hold or 0)}
    return reserva

@router.post("", response_model=BookingOut, summary="Crear una nueva solicitud de reserva (Cliente)")
@limiter.limit("20/minute")
def crear_reserva(
    request: Request,
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # La cuenta se crea simple (sin RUT ni documentos); recién acá, al
    # reservar de verdad un vehículo, se exige identidad verificada — no en
    # el registro.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu identidad antes de reservar un vehículo."
        )

    # Sin tarjeta validada no hay de dónde retener la garantía ni cobrar los
    # cargos de la devolución.
    if not tarjetas.puede_operar(current_user):
        raise HTTPException(
            status_code=403,
            detail=tarjetas.motivo_bloqueo(current_user, "reservar un vehículo"),
        )

    # La licencia (y el PIC, si su país lo exige) tiene que seguir vigente el
    # último día del arriendo, no solo hoy. Acá también se aplica la edad
    # mínima de la plataforma.
    config = PricingService.obtener_configuracion(db)
    evaluacion_licencia = evaluar_licencia_usuario(
        current_user,
        fecha_fin_reserva=payload.fecha_fin,
        edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
    )
    if not evaluacion_licencia["permitido"]:
        raise HTTPException(status_code=400, detail=evaluacion_licencia["motivo"])

    # Bloqueo transaccional pesimista para evitar reservas solapadas concurrentes
    auto = db.query(Auto).filter(Auto.id == payload.auto_id).with_for_update().first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    if auto.estado != "activo":
        raise HTTPException(status_code=400, detail="El auto no está disponible para arriendo")

    # Reingreso al checkout: el usuario pudo arrancar el pago de este auto y
    # salirse sin pagar. Su propia reserva `pendiente_pago` no expirada ya ocupa
    # el auto (ver ESTADOS_OCUPAN_AUTO), así que el `validar_disponibilidad_reserva`
    # de abajo lo bloquearía con su PROPIA reserva hasta que venza el TTL.
    #   · mismas fechas    -> se devuelve la reserva que ya tenía (idempotente)
    #   · fechas distintas -> se cancela la anterior para liberar el rango
    ahora_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    propias_pendientes = (
        db.query(Reserva)
        .filter(
            Reserva.auto_id == payload.auto_id,
            Reserva.cliente_id == current_user.id,
            Reserva.estado == "pendiente_pago",
        )
        .filter((Reserva.expira_en.is_(None)) | (Reserva.expira_en > ahora_naive))
        .all()
    )
    exacta = next(
        (
            p for p in propias_pendientes
            if p.fecha_inicio == payload.fecha_inicio and p.fecha_fin == payload.fecha_fin
        ),
        None,
    )
    if exacta:
        return _con_desglose_pago(exacta)
    for previa in propias_pendientes:
        previa.estado = "cancelada"
    if propias_pendientes:
        db.flush()

    # Validar que no haya solapamiento de fechas con reservas existentes
    if not validar_disponibilidad_reserva(payload.auto_id, payload.fecha_inicio, payload.fecha_fin, db):
        raise HTTPException(
            status_code=400,
            detail="El vehículo no se encuentra disponible para las fechas seleccionadas (ya cuenta con otra reserva activa)."
        )

    # Pago dual: `monto_cobro` (días × tarifa, IVA incl.) se cobra a una tarjeta
    # de débito; `monto_hold` (garantía fija por categoría) se retiene en una de
    # crédito. La reserva nace "pendiente_pago" y vive un rato (TTL) antes de
    # expirar si no se paga.
    dias = PricingService.calcular_dias_reserva(payload.fecha_inicio, payload.fecha_fin)
    monto_cobro = PricingService.calcular_monto_hold_reserva(auto.tarifa_dia, dias)
    monto_hold = checkout_service.monto_garantia(config, auto.categoria)
    expira_en = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        minutes=checkout_service.TTL_RESERVA_MINUTOS
    )

    reserva_id = str(uuid.uuid4())
    contrato_url = f"/api/v1/reservas/{reserva_id}/contrato-pdf"

    # cliente_id siempre es el usuario autenticado: no se confía en el valor
    # del payload (evita crear reservas y holds a nombre de otro usuario).
    # La reserva nace "pendiente": se confirma recién cuando el hold de
    # garantía queda autorizada en Mercado Pago (POST /pagos/mercadopago/confirmar).
    # El pago NO se crea acá — lo crea /pagos/mercadopago/iniciar.
    reserva = Reserva(
        id=reserva_id,
        auto_id=payload.auto_id,
        cliente_id=current_user.id,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        estado="pendiente_pago",
        monto_cobro=monto_cobro,
        monto_hold=monto_hold,
        expira_en=expira_en,
        lugar_entrega_acordado=payload.lugar_entrega_acordado,
        contrato_pdf_url=contrato_url
    )
    db.add(reserva)
    db.flush()

    # Si se adjuntó un segundo conductor en la creación
    if payload.segundo_conductor:
        conductor = ConductorAdicional(
            reserva_id=reserva.id,
            nombre=payload.segundo_conductor.nombre,
            email=payload.segundo_conductor.email,
            telefono=payload.segundo_conductor.telefono,
            tipo_documento=payload.segundo_conductor.tipo_documento or "rut",
            rut=payload.segundo_conductor.rut,
            numero_documento=payload.segundo_conductor.numero_documento,
            pais_documento=payload.segundo_conductor.pais_documento,
            fecha_nacimiento=payload.segundo_conductor.fecha_nacimiento,
            licencia_pais_emisor=payload.segundo_conductor.licencia_pais_emisor,
            licencia_numero=payload.segundo_conductor.licencia_numero,
            licencia_clase=payload.segundo_conductor.licencia_clase,
            licencia_vencimiento=payload.segundo_conductor.licencia_vencimiento,
            pic_url=payload.segundo_conductor.pic_url,
            pic_vencimiento=payload.segundo_conductor.pic_vencimiento,
            es_residente_chile=payload.segundo_conductor.es_residente_chile,
            fecha_inicio_residencia=payload.segundo_conductor.fecha_inicio_residencia,
            carnet_frontal_url=payload.segundo_conductor.carnet_frontal_url,
            carnet_trasero_url=payload.segundo_conductor.carnet_trasero_url,
            licencia_url=payload.segundo_conductor.licencia_url,
            selfie_url=payload.segundo_conductor.selfie_url,
        )
        db.add(conductor)
        db.flush()
        ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
        _programar_antecedentes_conductor(background_tasks, conductor)

    db.commit()
    db.refresh(reserva)
    return _con_desglose_pago(reserva)

@router.get("", response_model=List[BookingOut], summary="Listar reservas del usuario actual")
def listar_reservas(
    rol: Optional[str] = Query(None, description="Filtrar por rol: 'cliente' o 'dueno'"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # `joinedload`: trae auto + segundo conductor en la misma consulta. Sin
    # esto, serializar cada Reserva a BookingOut dispara 1-2 queries extra por
    # fila (N+1) — con 15 reservas, ~30 round-trips a la BD de Render.
    base = db.query(Reserva).options(
        joinedload(Reserva.auto),
        joinedload(Reserva.segundo_conductor),
        joinedload(Reserva.firmas),
    )
    if rol == "dueno":
        autos_ids = [a.id for a in current_user.autos]
        filas = base.filter(Reserva.auto_id.in_(autos_ids)).all()
    elif rol == "cliente":
        filas = base.filter(Reserva.cliente_id == current_user.id).all()
    else:
        filas = base.all()
    return [_con_desglose_pago(r) for r in filas]

def _verificar_acceso_reserva(reserva: Reserva, current_user: Usuario, db: Session):
    if "admin" in (current_user.roles_activos or []):
        return
    if reserva.cliente_id == current_user.id:
        return
    # `reserva.auto` suele venir precargado (joinedload); si no, lazy-load.
    auto = reserva.auto or db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if auto and auto.dueno_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta reserva.")


def _programar_antecedentes_conductor(background_tasks: BackgroundTasks, conductor: ConductorAdicional) -> None:
    """
    Dispara la verificación de antecedentes (ChapiAPI) del segundo conductor
    en background, solo cuando su KYC quedó "verificado" -- si ya está en
    revisión manual por otro motivo, soporte lo revisa todo junto.
    """
    if conductor.estado_kyc == "verificado":
        background_tasks.add_task(BackgroundCheckService.run_and_flag_conductor_in_background, conductor.id)

@router.get("/{reserva_id}", response_model=BookingOut, summary="Detalle de una reserva")
def obtener_reserva(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = (
        db.query(Reserva)
        .options(
            joinedload(Reserva.auto),
            joinedload(Reserva.segundo_conductor),
            joinedload(Reserva.firmas),
        )
        .filter(Reserva.id == reserva_id)
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)
    return _con_desglose_pago(reserva)

# ============================================================================
# Helper: arma el PDF del contrato para una reserva (lo usan el endpoint de
# descarga y el de firma, para que ambos hasheen exactamente el mismo documento).
# ============================================================================
def _generar_pdf_contrato(reserva: Reserva, db: Session) -> bytes:
    auto = reserva.auto or db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    cliente = db.query(Usuario).filter(Usuario.id == reserva.cliente_id).first()
    dueno = db.query(Usuario).filter(Usuario.id == auto.dueno_id).first() if auto else None

    dias = PricingService.calcular_dias_reserva(reserva.fecha_inicio, reserva.fecha_fin)
    tarifa_dia = auto.tarifa_dia if auto else 35000
    cfg = PricingService.obtener_configuracion(db)

    # Firmas registradas (arrendatario / arrendador), para el bloque legal del PDF.
    firmas = [
        {
            "rol": f.rol,
            "metodo": f.metodo,
            "nombre_firmante": f.nombre_firmante,
            "firmado_en": f.firmado_en,
            "hash_contrato_sha256": f.hash_contrato_sha256,
            "firma_svg": getattr(f, "firma_svg", None),
        }
        for f in (reserva.firmas or [])
    ]

    # Si no se capturó firma_svg en FirmaContrato, buscar trazo manuscrito en el checklist "antes" (entrega)
    checklist_antes = next((c for c in (reserva.checklists or []) if c.tipo == "antes" and c.firma_svg), None)
    firma_svg_entrega = checklist_antes.firma_svg if checklist_antes else None

    fecha_defecto = getattr(reserva, "creado_en", None) or getattr(reserva, "fecha_inicio", None)
    tiene_firma_arrendatario = any(f.get("rol") == "arrendatario" for f in firmas)
    if not tiene_firma_arrendatario:
        firmas.append({
            "rol": "arrendatario",
            "metodo": "escrita" if firma_svg_entrega else "biometrica",
            "nombre_firmante": cliente.nombre if cliente else "Cliente Arrendatario",
            "firmado_en": (checklist_antes.timestamp if checklist_antes else reserva.fecha_firma_biometrica) or fecha_defecto,
            "hash_contrato_sha256": reserva.hash_contrato_sha256,
            "firma_svg": firma_svg_entrega,
        })
    elif firma_svg_entrega:
        for f in firmas:
            if f.get("rol") == "arrendatario" and not f.get("firma_svg"):
                f["firma_svg"] = firma_svg_entrega

    tiene_firma_arrendador = any(f.get("rol") == "arrendador" for f in firmas)
    if not tiene_firma_arrendador:
        firmas.append({
            "rol": "arrendador",
            "metodo": "biometrica",
            "nombre_firmante": dueno.nombre if dueno else "Dueño Registrado",
            "firmado_en": fecha_defecto,
            "hash_contrato_sha256": reserva.hash_contrato_sha256,
            "firma_svg": None,
        })

    return ContractService.generar_contrato_pdf(
        reserva_id=reserva.id,
        dueno_nombre=dueno.nombre if dueno else "Dueño Registrado",
        dueno_rut=dueno.rut if dueno else "15.892.341-6",
        dueno_telefono=dueno.telefono if dueno else "+56912345678",
        cliente_nombre=cliente.nombre if cliente else "Cliente Arrendatario",
        cliente_rut=cliente.rut if cliente else "19.234.567-7",
        cliente_telefono=cliente.telefono if cliente else "+56987654321",
        auto_marca=auto.marca if auto else "Toyota",
        auto_modelo=auto.modelo if auto else "RAV4",
        auto_anio=auto.anio if auto else 2022,
        auto_patente=auto.patente if auto else "BBCL-10",
        fecha_inicio=reserva.fecha_inicio,
        fecha_fin=reserva.fecha_fin,
        lugar_entrega=reserva.lugar_entrega_acordado,
        tarifa_dia_clp=tarifa_dia,
        dias=dias,
        monto_total_estimado_clp=dias * tarifa_dia,
        valor_uf_clp=float(cfg.valor_uf_clp),
        dias_cobro_posterior_peajes=getattr(cfg, "dias_cobro_posterior_peajes", None) or 30,
        segundo_conductor_nombre=reserva.segundo_conductor.nombre if reserva.segundo_conductor else None,
        segundo_conductor_rut=(reserva.segundo_conductor.rut or reserva.segundo_conductor.numero_documento) if reserva.segundo_conductor else None,
        segundo_conductor_telefono=reserva.segundo_conductor.telefono if reserva.segundo_conductor else None,
        segundo_conductor_licencia=reserva.segundo_conductor.licencia_numero if reserva.segundo_conductor else None,
        fecha_firma_biometrica=reserva.fecha_firma_biometrica,
        firmas=firmas,
    )


@router.get("/{reserva_id}/contrato-pdf", summary="Descargar contrato digital de arriendo en PDF")
def descargar_contrato_pdf(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    auto = reserva.auto or db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    pdf_bytes = _generar_pdf_contrato(reserva, db)

    pdf_hash = ContractService.calcular_hash_contrato(pdf_bytes)
    if reserva.hash_contrato_sha256 != pdf_hash:
        reserva.hash_contrato_sha256 = pdf_hash
        db.commit()

    filename = f"Contrato-Arriendo-{auto.patente if auto else 'AUTO'}-{reserva.id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Contract-SHA256": pdf_hash
        }
    )


# ============================================================================
# Endpoint: firmar el contrato de arriendo (arrendatario o arrendador)
# ============================================================================
@router.post(
    "/{reserva_id}/firmar-contrato",
    response_model=FirmaContratoOut,
    summary="Registra la firma del contrato de una parte (huella, facial o escrita)",
)
@limiter.limit("15/minute")
def firmar_contrato(
    request: Request,
    reserva_id: str,
    payload: FirmaContratoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    # 1. Bloque: rol del firmante — arrendatario (cliente) o arrendador (dueño del auto)
    auto = reserva.auto or db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if current_user.id == reserva.cliente_id:
        rol = "arrendatario"
    elif auto and auto.dueno_id == current_user.id:
        rol = "arrendador"
    else:
        raise HTTPException(status_code=403, detail="No eres parte de este contrato.")

    # 2. Bloque: validación del método y del consentimiento
    if not payload.acepta_terminos:
        raise HTTPException(
            status_code=400,
            detail={"motivo": "Debes aceptar los términos del contrato para firmar.", "categoria": "sin_consentimiento"},
        )
    if payload.metodo == "escrita" and not (payload.firma_svg or "").strip():
        raise HTTPException(
            status_code=400,
            detail={"motivo": "Falta el trazo de la firma manuscrita.", "categoria": "firma_vacia"},
        )

    # 3. Bloque: hash del contrato vigente — prueba de QUÉ se está firmando
    pdf_hash = ContractService.calcular_hash_contrato(_generar_pdf_contrato(reserva, db))

    # 4. Bloque: upsert del registro de firma (una por rol)
    firma = (
        db.query(FirmaContrato)
        .filter(FirmaContrato.reserva_id == reserva_id, FirmaContrato.rol == rol)
        .first()
    )
    if not firma:
        firma = FirmaContrato(reserva_id=reserva_id, rol=rol)
        db.add(firma)
    firma.usuario_id = current_user.id
    firma.metodo = payload.metodo
    firma.firma_svg = payload.firma_svg if payload.metodo == "escrita" else None
    firma.nombre_firmante = (payload.nombre_firmante or current_user.nombre or "").strip() or None
    firma.hash_contrato_sha256 = pdf_hash
    firma.ip = request.client.host if request.client else None
    firma.user_agent = (request.headers.get("user-agent") or "")[:500] or None
    firma.firmado_en = datetime.now(timezone.utc)

    reserva.hash_contrato_sha256 = pdf_hash

    # 5. Bloque: con ambas partes firmadas, se marca la fecha de firma del contrato
    roles_firmados = {f.rol for f in reserva.firmas} | {rol}
    ambas_partes = {"arrendatario", "arrendador"}.issubset(roles_firmados)
    if ambas_partes and not reserva.fecha_firma_biometrica:
        reserva.fecha_firma_biometrica = firma.firmado_en

    db.commit()
    db.refresh(firma)

    # 6. Bloque: avisar a la otra parte
    otra_parte_id = auto.dueno_id if (auto and rol == "arrendatario") else reserva.cliente_id
    if otra_parte_id and otra_parte_id != current_user.id:
        crear_notificacion(
            db,
            usuario_id=otra_parte_id,
            tipo="contrato",
            titulo="Contrato firmado por la otra parte" if not ambas_partes else "Contrato firmado por ambas partes",
            mensaje=(
                "El contrato quedó firmado por las dos partes."
                if ambas_partes
                else f"{firma.nombre_firmante or 'La otra parte'} firmó el contrato de arriendo."
            ),
            entidad_tipo="reserva",
            entidad_id=reserva_id,
        )

    return firma

# Transiciones que este endpoint genérico tiene permitido aplicar. El resto
# de los estados (confirmada -> en_curso, en_curso -> finalizada/disputada)
# los fija el propio flujo de entrega/checklist (DeliveryService), que ya
# valida sus propias condiciones (QR, firma, checklist) -- dejar que este
# endpoint salte directo a esos estados permitiría saltarse esas
# validaciones por completo. En la práctica, hoy el único uso real es que
# el cliente cancele antes de retirar el auto (mobile ya oculta "Cancelar"
# una vez que la reserva queda en_curso, ver hallazgo #10).
TRANSICIONES_ESTADO_VALIDAS: dict[str, set[str]] = {
    "pendiente": {"confirmada", "cancelada"},
    "pendiente_pago": {"confirmada", "cancelada"},
    "confirmada": {"cancelada"},
    "en_curso": set(),
    "finalizada": set(),
    "cancelada": set(),
    "disputada": set(),
}


@router.patch("/{reserva_id}/estado", response_model=BookingOut, summary="Actualizar estado de reserva (Aceptar/Rechazar)")
def actualizar_estado_reserva(
    reserva_id: str,
    nuevo_estado: str = Query(..., description="Nuevo estado: 'confirmada', 'cancelada'"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    permitidos = TRANSICIONES_ESTADO_VALIDAS.get(reserva.estado, set())
    if nuevo_estado not in permitidos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No se puede pasar de '{reserva.estado}' a '{nuevo_estado}'. "
                + (f"Desde este estado solo se permite: {', '.join(sorted(permitidos))}."
                   if permitidos else "Este estado no admite cambios manuales.")
            ),
        )

    reserva.estado = nuevo_estado
    db.commit()
    db.refresh(reserva)
    return reserva

@router.post(
    "/{reserva_id}/extender",
    response_model=BookingOut,
    summary="Extender la fecha de devolución de una reserva activa (Cliente)"
)
@limiter.limit("10/minute")
def extender_reserva(
    request: Request,
    reserva_id: str,
    payload: ExtendBookingRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el arrendatario de esta reserva puede extenderla.")
    if reserva.estado not in ("confirmada", "en_curso"):
        raise HTTPException(status_code=400, detail="Solo se puede extender una reserva confirmada o en curso.")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    nueva_fecha_fin = reserva.fecha_fin + timedelta(days=payload.dias_adicionales)

    if not validar_disponibilidad_reserva(reserva.auto_id, reserva.fecha_fin, nueva_fecha_fin, db, excluir_reserva_id=reserva.id):
        raise HTTPException(
            status_code=400,
            detail="El vehículo ya tiene otra reserva confirmada en los días solicitados para la extensión."
        )

    monto_adicional = PricingService.calcular_monto_hold_reserva(auto.tarifa_dia, payload.dias_adicionales)

    reserva.fecha_fin = nueva_fecha_fin
    reserva.monto_hold += monto_adicional
    db.add(Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo="hold_reserva",
        monto=monto_adicional,
        estado="capturado",
        referencia_pago=f"MP-EXT-{uuid.uuid4().hex[:8].upper()}"
    ))
    db.commit()
    db.refresh(reserva)
    return reserva

@router.post(
    "/{reserva_id}/precheckin",
    response_model=PreCheckinResponse,
    summary="Realizar Pre-Checkin 24h antes del viaje (Cliente o Dueño)"
)
def realizar_precheckin(
    reserva_id: str,
    payload: PreCheckinRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    ahora = datetime.now(timezone.utc)

    if payload.rol == "cliente":
        if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
            raise HTTPException(status_code=403, detail="Solo el arrendatario puede confirmar el precheck del cliente.")
        reserva.precheck_cliente_confirmado = True
        reserva.precheck_cliente_timestamp = ahora

        if auto:
            crear_notificacion(
                db,
                usuario_id=auto.dueno_id,
                tipo="reserva",
                titulo="Arrendatario listo para mañana",
                mensaje=f"{current_user.nombre} completó el pre-checkin para la entrega en {reserva.lugar_entrega_acordado}.",
                entidad_tipo="reserva",
                entidad_id=reserva.id,
                commit=False,
            )
    else:
        if (not auto or auto.dueno_id != current_user.id) and "admin" not in (current_user.roles_activos or []):
            raise HTTPException(status_code=403, detail="Solo el dueño del vehículo puede confirmar este precheck.")
        reserva.precheck_dueno_confirmado = True
        reserva.precheck_dueno_timestamp = ahora

        crear_notificacion(
            db,
            usuario_id=reserva.cliente_id,
            tipo="reserva",
            titulo="Vehículo preparado para entrega",
            mensaje=f"El anfitrión confirmó que tu {auto.marca if auto else 'auto'} estará listo en {reserva.lugar_entrega_acordado}.",
            entidad_tipo="reserva",
            entidad_id=reserva.id,
            commit=False,
        )

    # Si se incluyeron notas para la contraparte, se registran en el chat de la reserva
    if payload.notas and payload.notas.strip():
        db.add(Mensaje(
            id=str(uuid.uuid4()),
            reserva_id=reserva.id,
            autor_id=current_user.id,
            texto=f"📋 [Pre-Checkin 24h]: {payload.notas.strip()}",
            timestamp=ahora,
            leido=False,
        ))

    db.commit()
    db.refresh(reserva)

    ambos = bool(reserva.precheck_cliente_confirmado and reserva.precheck_dueno_confirmado)
    msg = (
        "¡Pre-checkin completado! Ambas partes han confirmado la entrega de mañana."
        if ambos
        else f"Pre-checkin registrado para {payload.rol}. Esperando confirmación de la contraparte."
    )

    return {
        "reserva_id": reserva.id,
        "precheck_cliente_confirmado": reserva.precheck_cliente_confirmado or False,
        "precheck_cliente_timestamp": reserva.precheck_cliente_timestamp,
        "precheck_dueno_confirmado": reserva.precheck_dueno_confirmado or False,
        "precheck_dueno_timestamp": reserva.precheck_dueno_timestamp,
        "ambos_confirmados": ambos,
        "mensaje": msg,
    }

@router.get(
    "/{reserva_id}/precheckin",
    response_model=PreCheckinResponse,
    summary="Consultar estado del Pre-Checkin 24h antes"
)
def obtener_estado_precheckin(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    ambos = bool(reserva.precheck_cliente_confirmado and reserva.precheck_dueno_confirmado)
    return {
        "reserva_id": reserva.id,
        "precheck_cliente_confirmado": reserva.precheck_cliente_confirmado or False,
        "precheck_cliente_timestamp": reserva.precheck_cliente_timestamp,
        "precheck_dueno_confirmado": reserva.precheck_dueno_confirmado or False,
        "precheck_dueno_timestamp": reserva.precheck_dueno_timestamp,
        "ambos_confirmados": ambos,
        "mensaje": "Pre-checkin completo" if ambos else "Pendiente de confirmación",
    }

@router.post(
    "/{reserva_id}/aplicar-multa",
    response_model=BookingOut,
    summary="Reportar y aplicar multa o cargo por falta en arriendo (Dueño o Admin)"
)
def aplicar_multa_reserva(
    reserva_id: str,
    payload: AplicarMultaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    es_dueno = auto and auto.dueno_id == current_user.id
    es_admin = "admin" in (current_user.roles_activos or [])

    if not es_dueno and not es_admin:
        raise HTTPException(status_code=403, detail="Solo el anfitrión del vehículo o un administrador pueden reportar multas.")

    if reserva.estado not in ("confirmada", "en_curso", "finalizada", "disputada"):
        raise HTTPException(status_code=400, detail="Solo se pueden aplicar multas en reservas activas o finalizadas.")

    item_multa = FinesService.validar_y_calcular_multa(
        tipo=payload.tipo,
        monto_clp=payload.monto_clp,
        motivo=payload.motivo,
        fotos=payload.fotos,
    )

    monto = item_multa["monto_clp"]

    # Actualizar campos de multas en la reserva
    detalles = list(reserva.multas_detalle or [])
    detalles.append(item_multa)
    reserva.multas_detalle = detalles

    reserva.cargo_falta_grave_clp = (reserva.cargo_falta_grave_clp or 0) + monto
    reserva.cargos_adicionales_clp = (reserva.cargos_adicionales_clp or 0) + monto
    reserva.monto_cobro_final = (reserva.monto_cobro_final or 0) + monto
    reserva.liquidacion_dueno_clp = (reserva.liquidacion_dueno_clp or 0) + monto

    desglose_txt = f"[{item_multa['nombre']}: ${monto:,} CLP - {payload.motivo}]"
    if reserva.motivo_multas:
        reserva.motivo_multas += f" | {desglose_txt}"
    else:
        reserva.motivo_multas = desglose_txt

    # Registrar cobro por la multa
    pago_multa = Pago(
        reserva_id=reserva.id,
        usuario_id=reserva.cliente_id,
        tipo=f"cargo_{payload.tipo}",
        monto=monto,
        estado="capturado",
        referencia_pago=f"MP-FINE-{uuid.uuid4().hex[:8].upper()}"
    )
    db.add(pago_multa)

    # Notificar al cliente con el detalle transparente
    crear_notificacion(
        db,
        usuario_id=reserva.cliente_id,
        tipo="reserva",
        titulo="Cargo por falta / penalización",
        mensaje=(
            f"Se ha aplicado un cargo de ${monto:,} CLP por '{item_multa['nombre']}'. "
            f"Motivo: {payload.motivo}."
        ),
        entidad_tipo="reserva",
        entidad_id=reserva.id,
    )

    db.commit()
    db.refresh(reserva)
    return reserva

# ==============================================================================
# GESTIÓN Y VERIFICACIÓN KYC DE SEGUNDO CONDUCTOR
# ==============================================================================
@router.post(
    "/{reserva_id}/segundo-conductor",
    response_model=ConductorAdicionalOut,
    summary="Asignar o registrar segundo conductor a una reserva"
)
@limiter.limit("15/minute")
def asignar_segundo_conductor(
    request: Request,
    reserva_id: str,
    payload: ConductorAdicionalCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede asignar un segundo conductor.")

    if reserva.estado in ["finalizada", "cancelada"]:
        raise HTTPException(status_code=400, detail=f"No se puede asignar conductor a una reserva en estado '{reserva.estado}'.")

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if conductor:
        # Actualizar datos existentes
        for campo, valor in payload.model_dump(exclude_unset=True).items():
            setattr(conductor, campo, valor)
    else:
        conductor = ConductorAdicional(
            reserva_id=reserva.id,
            **payload.model_dump()
        )
        db.add(conductor)

    db.commit()
    db.refresh(conductor)

    # Ejecutar validación KYC de documentos, licencia y biometría
    ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
    db.refresh(conductor)
    _programar_antecedentes_conductor(background_tasks, conductor)
    return conductor

@router.get(
    "/{reserva_id}/segundo-conductor",
    response_model=ConductorAdicionalOut,
    summary="Consultar datos y estado KYC del segundo conductor"
)
def obtener_segundo_conductor(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")

    ConductorKycService.renovar_fotos_conductor(conductor, db)
    return conductor

@router.put(
    "/{reserva_id}/segundo-conductor",
    response_model=ConductorAdicionalOut,
    summary="Actualizar datos o documentos del segundo conductor"
)
@limiter.limit("15/minute")
def actualizar_segundo_conductor(
    request: Request,
    reserva_id: str,
    payload: ConductorAdicionalUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede modificar el segundo conductor.")

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if valor is not None:
            setattr(conductor, campo, valor)

    db.commit()
    db.refresh(conductor)

    # Re-evaluar KYC tras actualización
    ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
    db.refresh(conductor)
    _programar_antecedentes_conductor(background_tasks, conductor)
    return conductor

@router.delete(
    "/{reserva_id}/segundo-conductor",
    summary="Eliminar segundo conductor de la reserva"
)
def eliminar_segundo_conductor(
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede remover el segundo conductor.")

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")

    db.delete(conductor)
    db.commit()
    return {"mensaje": "Segundo conductor eliminado exitosamente", "reserva_id": reserva_id}

@router.post(
    "/{reserva_id}/segundo-conductor/verificar-kyc",
    response_model=ConductorAdicionalOut,
    summary="Re-ejecutar verificación KYC para el segundo conductor"
)
@limiter.limit("10/minute")
def verificar_kyc_segundo_conductor(
    request: Request,
    reserva_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    _verificar_acceso_reserva(reserva, current_user, db)

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")

    ConductorKycService.procesar_kyc_conductor(conductor, reserva, db)
    db.refresh(conductor)
    _programar_antecedentes_conductor(background_tasks, conductor)
    return conductor

@router.post(
    "/{reserva_id}/segundo-conductor/verificacion-externa/sesion",
    response_model=SesionVerificacionExternaOut,
    summary="Crea una sesión de verificación de identidad con Didit para el segundo conductor",
)
@limiter.limit("10/minute")
def crear_sesion_verificacion_segundo_conductor(
    request: Request,
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Misma verificación de identidad hosted que ya usa el titular
    (crear_sesion_verificacion_externa) — la app abre `url` para que el
    segundo conductor complete la captura de cédula + selfie en su propio
    celular. La licencia de conducir tiene su PROPIA sesión, en un workflow
    separado (ver crear_sesion_verificacion_licencia_segundo_conductor):
    igual que la identidad, ambas caen al pipeline casero de Google Vision
    si Didit no está disponible (carnet_frontal_url/licencia_url en
    PUT .../segundo-conductor).
    """
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede iniciar esta verificación.")

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")
    if conductor.verificacion_externa_estado == "aprobada":
        raise HTTPException(status_code=400, detail="La identidad de este conductor ya está verificada.")
    if not verificacion_didit.esta_habilitado():
        raise HTTPException(status_code=503, detail="La verificación con proveedor externo no está habilitada.")

    partes = (conductor.nombre or "").strip().split()
    nombre = partes[0] if partes else None
    apellido = " ".join(partes[1:]) or None

    try:
        sesion = verificacion_didit.crear_sesion(
            # Prefijo para que el webhook distinga a un ConductorAdicional de
            # un Usuario (ambos usan el mismo vendor_data como llave).
            vendor_data=f"conductor:{conductor.id}",
            nombre=nombre,
            apellido=apellido,
            rut=conductor.rut,
            email=conductor.email,
        )
    except verificacion_didit.DiditNoConfigurado as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo iniciar la verificación: {e}")

    if not sesion.get("url") or not sesion.get("session_id"):
        raise HTTPException(status_code=502, detail="El proveedor no devolvió una sesión válida.")

    conductor.verificacion_externa_ref = sesion["session_id"]
    conductor.verificacion_externa_estado = "pendiente"
    conductor.verificacion_externa_actualizada = datetime.now(timezone.utc)
    db.commit()

    return SesionVerificacionExternaOut(url=sesion["url"], session_id=sesion["session_id"], estado="pendiente")


@router.post(
    "/{reserva_id}/segundo-conductor/verificacion-licencia/sesion",
    response_model=SesionVerificacionExternaOut,
    summary="Crea una sesión de verificación de la LICENCIA de conducir con Didit para el segundo conductor",
)
@limiter.limit("10/minute")
def crear_sesion_verificacion_licencia_segundo_conductor(
    request: Request,
    reserva_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Workflow de Didit separado del de identidad (solo OCR de la licencia,
    sin liveness ni face match — ver DIDIT_WORKFLOW_ID_LICENCIA). El
    resultado llega por webhook con
    vendor_data="licencia_conductor:{conductor_id}" y dispara de nuevo
    `ConductorKycService.procesar_kyc_conductor`. PUT .../segundo-conductor
    con `licencia_url` sigue siendo el respaldo manual si Didit no está
    disponible.
    """
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el titular de la reserva puede iniciar esta verificación.")

    conductor = db.query(ConductorAdicional).filter(ConductorAdicional.reserva_id == reserva.id).first()
    if not conductor:
        raise HTTPException(status_code=404, detail="Esta reserva no tiene segundo conductor asignado.")
    if conductor.licencia_verificacion_externa_estado == "aprobada":
        raise HTTPException(status_code=400, detail="La licencia de este conductor ya está verificada.")
    if not verificacion_didit.esta_habilitado_licencia():
        raise HTTPException(
            status_code=503,
            detail="La verificación de licencia con proveedor externo no está habilitada.",
        )

    try:
        sesion = verificacion_didit.crear_sesion_licencia(
            vendor_data=f"licencia_conductor:{conductor.id}",
            email=conductor.email,
        )
    except verificacion_didit.DiditNoConfigurado as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo iniciar la verificación: {e}")

    if not sesion.get("url") or not sesion.get("session_id"):
        raise HTTPException(status_code=502, detail="El proveedor no devolvió una sesión válida.")

    conductor.licencia_verificacion_externa_ref = sesion["session_id"]
    conductor.licencia_verificacion_externa_estado = "pendiente"
    conductor.licencia_verificacion_externa_actualizada = datetime.now(timezone.utc)
    db.commit()

    return SesionVerificacionExternaOut(url=sesion["url"], session_id=sesion["session_id"], estado="pendiente")


class TelemetriaCelularRequest(BaseModel):
    latitud: float = Field(..., ge=-90, le=90, description="Latitud GPS")
    longitud: float = Field(..., ge=-180, le=180, description="Longitud GPS")
    precision: Optional[float] = Field(None, description="Precisión en metros")
    velocidad: Optional[float] = Field(None, description="Velocidad en km/h o m/s")
    altitud: Optional[float] = None
    bateria: Optional[float] = None
    timestamp: Optional[datetime] = None


@router.post(
    "/{reserva_id}/telemetria",
    summary="Reportar posición GPS desde el celular del arrendatario durante el arriendo",
)
def reportar_telemetria_celular(
    reserva_id: str,
    payload: TelemetriaCelularRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    # Solo el cliente de la reserva o admin puede reportar telemetría
    if reserva.cliente_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="Solo el arrendatario puede reportar ubicación.")

    if reserva.estado not in ("en_curso", "confirmada"):
        return {"ok": False, "motivo": f"La reserva no está activa (estado actual: {reserva.estado})."}

    auto = db.query(Auto).filter(Auto.id == reserva.auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")

    ahora_iso = datetime.now(timezone.utc).isoformat()
    posicion_dict = {
        "latitud": payload.latitud,
        "longitud": payload.longitud,
        "precision": payload.precision,
        "velocidad": payload.velocidad,
        "altitud": payload.altitud,
        "bateria": payload.bateria,
        "timestamp": payload.timestamp.isoformat() if payload.timestamp else ahora_iso,
        "fuente": "celular_arrendatario",
        "reserva_id": reserva.id,
    }

    auto.gps_ultima_posicion = posicion_dict
    # Señal recuperada: se limpian los flags de alerta para que la próxima
    # ventana de silencio (30m/60m, ver gps_monitor_service) pueda re-avisar.
    reserva.gps_alerta_30m_enviada = False
    reserva.gps_alerta_60m_enviada = False
    db.commit()

    return {"ok": True, "timestamp": ahora_iso}


