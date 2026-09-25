from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.schemas.schemas import (
    UserEnrolamiento, UserOut, EnrolamientoARevision, CompletarLicencia,
    SesionVerificacionExternaOut, SesionVerificacionLicenciaCreate,
)
from app.models.entities import Usuario, Pago, TicketSoporte
from app.features.auth.ocr.ocr_engine import OCRService
from app.features.auth.didit import didit as verificacion_didit
from app.features.auth.login.service import get_current_user
from app.features.auth.background_checks import BackgroundCheckService
from app.core.limiter import limiter
from datetime import datetime
import uuid

from app.core.validators import validar_documento_identidad
from app.features.auth.users.telefonos import exigir_telefono_libre
from app.features.auth.onboarding.license_service import evaluar_licencia_usuario
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.payments import cards_service as tarjetas

router = APIRouter(prefix="/enrolamiento", tags=["Enrolamiento de Clientes"])

@router.post("/procesar-documentos", summary="Extrae datos de carnet y licencia vía OCR")
def procesar_documentos_ocr(
    payload: UserEnrolamiento,
    current_user: Usuario = Depends(get_current_user),  # noqa: ARG001 — solo exige sesión (cada llamada cuesta OCR)
):
    """
    Envía las imágenes a Google Cloud Vision (o usa mock local con datos demo) para extraer RUT y validar vigencia.
    """
    resultado_ocr = OCRService.procesar_documentos_enrolamiento(
        carnet_frontal_url=payload.carnet_frontal_url,
        carnet_trasero_url=payload.carnet_trasero_url,
        licencia_url=payload.licencia_url,
        rut_usuario=payload.rut,
        selfie_url=payload.foto_perfil_verificada_url,
        selfie_liveness_url=payload.selfie_liveness_url,
        tipo_documento=payload.tipo_documento,
        pais_documento=payload.pais_documento,
    )
    return {
        "mensaje": "Documentos procesados exitosamente",
        "datos_extraidos": resultado_ocr
    }


@router.post(
    "/verificacion-externa/sesion",
    response_model=SesionVerificacionExternaOut,
    summary="Crea una sesión de verificación de identidad con el proveedor externo (Didit)",
)
@limiter.limit("10/minute")
def crear_sesion_verificacion_externa(
    request: Request,
    app: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Solo disponible con `VERIFICACION_EXTERNA_HABILITADA`. Crea una sesión
    hosted del proveedor y devuelve la URL a la que la app debe llevar al
    usuario. El resultado llega después por webhook (`POST /webhooks/didit`).
    Rate-limited a 10/min por si el usuario reintenta — cada llamada consume
    una verificación del plan.

    `app` ("owner" | "renter"): qué app mobile inició el flujo — el mismo
    usuario puede ser dueño y arrendatario, así que no se puede inferir del
    usuario. Se usa para que el callback de Didit vuelva al deep link
    correcto (ver didit.callback_url_para).
    """
    if current_user.estado_documentos == "verificado":
        raise HTTPException(status_code=400, detail="Tu identidad ya está verificada.")
    if not verificacion_didit.esta_habilitado():
        raise HTTPException(
            status_code=503,
            detail="La verificación con proveedor externo no está habilitada.",
        )

    nombre_completo = (current_user.nombre or "").strip()
    partes = nombre_completo.split()
    nombre = partes[0] if partes else None
    apellido = " ".join(partes[1:]) or None

    try:
        sesion = verificacion_didit.crear_sesion(
            vendor_data=current_user.id,
            nombre=nombre,
            apellido=apellido,
            rut=current_user.rut,
            email=current_user.email,
            callback_url=verificacion_didit.callback_url_para(app),
        )
    except verificacion_didit.DiditNoConfigurado as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo iniciar la verificación: {e}")

    if not sesion.get("url") or not sesion.get("session_id"):
        raise HTTPException(status_code=502, detail="El proveedor no devolvió una sesión válida.")

    current_user.verificacion_externa_ref = sesion["session_id"]
    current_user.verificacion_externa_estado = "pendiente"
    current_user.verificacion_externa_actualizada = datetime.utcnow()
    db.commit()

    return SesionVerificacionExternaOut(
        url=sesion["url"], session_id=sesion["session_id"], estado="pendiente"
    )

@router.post("/enviar-a-revision", summary="Manda el enrolamiento a revisión manual de un ejecutivo (no cobra el hold)")
@limiter.limit("5/minute")
def enviar_enrolamiento_a_revision(
    request: Request,
    payload: EnrolamientoARevision,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Se usa cuando la verificación automática rechazó al usuario por algo que
    un ejecutivo puede resolver mirando la foto (el OCR leyó mal la edad, un
    documento que parece vencido pero no lo está, control facial dudoso).
    Deja la cuenta en `requiere_revision_manual` —sigue sin poder reservar ni
    publicar— y abre UN ticket con los enlaces a los documentos. No cobra el
    hold: eso pasa recién en /completar, cuando el ejecutivo apruebe.
    """
    if current_user.estado_documentos == "verificado":
        return {"estado_documentos": "verificado"}

    current_user.estado_documentos = "requiere_revision_manual"
    nota = payload.motivo or "El usuario solicitó revisión manual desde el enrolamiento."
    current_user.notas_auditoria = nota[:1000]

    if payload.foto_perfil_verificada_url:
        current_user.foto_perfil_verificada_url = payload.foto_perfil_verificada_url
    if payload.licencia_url:
        current_user.licencia_url = payload.licencia_url
        current_user.licencia_estado = "revision"

    enlaces = "\n".join(
        f"- {etiqueta}: {url}"
        for etiqueta, url in (
            ("Cédula frente", payload.carnet_frontal_url),
            ("Cédula reverso", payload.carnet_trasero_url),
            ("Licencia", payload.licencia_url),
            ("Selfie", payload.foto_perfil_verificada_url),
        )
        if url
    )
    db.add(TicketSoporte(
        usuario_id=current_user.id,
        sucursal_id=current_user.sucursal_id,
        asunto="Revisión manual de enrolamiento (solicitada por el usuario)",
        descripcion=f"{payload.descripcion.strip()}\n\nDocumentos:\n{enlaces or '(sin enlaces)'}",
    ))
    db.commit()
    db.refresh(current_user)

    from app.features.communications.notifications.service import crear_notificacion
    crear_notificacion(
        db,
        usuario_id=current_user.id,
        tipo="kyc",
        titulo="Tu caso está en revisión",
        mensaje="Un ejecutivo revisa tus documentos a mano. Te avisamos apenas quede lista tu cuenta.",
        entidad_tipo="usuario",
        entidad_id=current_user.id,
    )
    return {"estado_documentos": current_user.estado_documentos}


@router.post("/completar", response_model=UserOut, summary="Completa el enrolamiento y realiza el hold de seguridad de $800.000")
@limiter.limit("10/minute")
def completar_enrolamiento(
    request: Request,
    payload: UserEnrolamiento,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # Si el usuario ya está verificado, no re-ejecutar OCR ni volver a cobrar el hold
    if current_user.estado_documentos == "verificado":
        return current_user

    if payload.telefono is not None:
        exigir_telefono_libre(db, payload.telefono, current_user.id)

    # --- Verificación de identidad con proveedor externo (Didit) -----------
    # Con el flag encendido, la identidad + control facial la resuelve Didit
    # (sesión hosta previa) y el resultado llega por webhook. Acá solo se lee
    # ese veredicto; si el webhook aún no llegó, se relee por API.
    identidad_por_proveedor = False
    if verificacion_didit.esta_habilitado():
        estado_ext = current_user.verificacion_externa_estado
        if estado_ext in (None, "no_iniciada", "pendiente") and current_user.verificacion_externa_ref:
            decision = verificacion_didit.obtener_decision(current_user.verificacion_externa_ref)
            if decision:
                estado_ext = verificacion_didit.interpretar_payload(decision)["estado"]
                current_user.verificacion_externa_estado = estado_ext
                current_user.verificacion_externa_actualizada = datetime.utcnow()
                db.commit()

        if estado_ext == "rechazada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "motivo": (current_user.notas_auditoria
                              or "La verificación de identidad no pasó. Puedes reintentarla o escribir a soporte."),
                    "categoria": "verificacion",
                },
            )
        if estado_ext not in ("aprobada", "revision"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "motivo": "Primero completa la verificación de identidad con el enlace que te enviamos.",
                    "categoria": "verificacion_externa_pendiente",
                },
            )
        identidad_por_proveedor = True

    # El chileno se identifica con RUT (Módulo 11); el extranjero con pasaporte
    # o DNI de su país. ClaveÚnica no es alternativa: solo la integran
    # organismos del Estado, no una empresa privada.
    es_chileno = (payload.tipo_documento or "rut") == "rut"
    numero_identidad = payload.rut if es_chileno else payload.numero_documento

    valido, motivo_documento = validar_documento_identidad(
        payload.tipo_documento, numero_identidad, payload.pais_documento
    )
    if not valido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=motivo_documento
        )

    # Sin este chequeo, un documento repetido revienta recién en el commit()
    # de más abajo con un IntegrityError crudo de SQLite/Postgres (mensaje
    # técnico en inglés, no algo que se le pueda mostrar a un usuario).
    if es_chileno:
        documento_en_uso = (
            db.query(Usuario)
            .filter(Usuario.rut == payload.rut, Usuario.id != current_user.id)
            .first()
        )
        detalle_duplicado = "Este RUT ya está registrado en otra cuenta."
    else:
        documento_en_uso = (
            db.query(Usuario)
            .filter(
                Usuario.numero_documento == payload.numero_documento,
                Usuario.pais_documento == payload.pais_documento,
                Usuario.id != current_user.id,
            )
            .first()
        )
        detalle_duplicado = "Este documento ya está registrado en otra cuenta."

    if documento_en_uso:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"motivo": detalle_duplicado, "categoria": "documento_duplicado"},
        )

    # El medio de pago YA NO se pide en el KYC: las tarjetas se agregan después
    # desde "Mis tarjetas" (bóveda multi-tarjeta), con su propio cruce de
    # titular. El KYC solo verifica identidad. Si por compatibilidad llega un
    # `tarjeta_token` en el payload, se valida y se guarda igual.
    resultado_tarjeta = None
    if payload.tarjeta_token:
        resultado_tarjeta = tarjetas.validar_tarjeta(
            payload.tarjeta_token,
            payload.tarjeta_ultimos4,
            payload.tarjeta_marca,
            titular=payload.tarjeta_titular,
            nombre_cuenta=payload.nombre,
        )

    # Procesar documentos para calcular confianza.
    #
    # Con la identidad ya resuelta por el proveedor externo y sin fotos de
    # cédula en el payload (el flujo hosted no las manda), el OCR de cédula no
    # aplica: se sintetiza el resultado según el veredicto de Didit. Si igual
    # llegaron fotos (flujo dueño), se corre el OCR normal como red extra.
    if identidad_por_proveedor and not payload.carnet_frontal_url:
        _ext_ok = current_user.verificacion_externa_estado == "aprobada"
        # La cédula ya la validó Didit; acá solo se revisa la licencia si vino
        # (mismo criterio liviano que POST /completar-licencia).
        _lic_a_soporte = False
        if payload.licencia_url and current_user.licencia_verificacion_externa_estado != "aprobada":
            _lic_bytes = OCRService.descargar_imagen_bytes(payload.licencia_url)
            _texto_lic, _ = (
                OCRService.llamar_google_vision_api(_lic_bytes) if _lic_bytes else (None, 0.0)
            )
            _api_key, _tiene_creds = OCRService._credenciales_vision()
            _vision_on = bool(_api_key or _tiene_creds) and not settings.USE_OCR_MOCK
            _lic_a_soporte = (
                (_vision_on and bool(_lic_bytes) and not _texto_lic)
                or (bool(_texto_lic) and OCRService.clasificar_documento(_texto_lic) != "licencia")
            )
        resultado_ocr = {
            "estado_recomendado": "verificado" if _ext_ok else "requiere_revision_manual",
            "documentos_legibles": True,
            "confianza_ocr": 0.99 if _ext_ok else 0.7,
            "rut_extraido": payload.rut,
            "nombre_extraido": payload.nombre,
            "coincide_rut_declarado": True,
            "verificacion_facial": "ok" if _ext_ok else "revision",
            "licencia_a_soporte": _lic_a_soporte,
            "motivo": None if _ext_ok else "Verificación de identidad en revisión por el proveedor.",
            "es_mock": False,
        }
    else:
        resultado_ocr = OCRService.procesar_documentos_enrolamiento(
            carnet_frontal_url=payload.carnet_frontal_url,
            carnet_trasero_url=payload.carnet_trasero_url,
            licencia_url=payload.licencia_url,
            rut_usuario=payload.rut,
            selfie_url=payload.foto_perfil_verificada_url,
            selfie_liveness_url=payload.selfie_liveness_url,
            tipo_documento=payload.tipo_documento,
            pais_documento=payload.pais_documento,
        )

    # Un rechazo del OCR bloquea el enrolamiento de verdad: no se otorga el
    # rol "cliente" ni se cobra el hold de garantía sobre documentos que la
    # verificación marcó como no válidos.
    #
    # `categoria` le dice a la app cómo reaccionar:
    #  - "fotos_ilegibles": la foto no se pudo leer -> la app manda a
    #    re-tomarlas directamente, sin ofrecer soporte (no hay nada que
    #    revisar).
    #  - "verificacion": la foto se leyó pero algo no cuadra (control facial,
    #    etc.) -> la app ofrece 2 opciones: enviar a soporte o reintentar.
    if resultado_ocr.get("estado_recomendado") == "rechazado":
        legible = resultado_ocr.get("documentos_legibles", False)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "motivo": (
                    resultado_ocr.get("motivo")
                    or "No se pudo verificar tus documentos. Vuelve a tomar las fotos con buena iluminación."
                ),
                "categoria": "verificacion" if legible else "fotos_ilegibles",
            },
        )

    current_user.nombre = payload.nombre
    if es_chileno:
        current_user.rut = payload.rut
    current_user.tipo_documento = payload.tipo_documento
    current_user.numero_documento = numero_identidad
    current_user.pais_documento = payload.pais_documento or ("CL" if es_chileno else None)
    if payload.fecha_nacimiento:
        current_user.fecha_nacimiento = payload.fecha_nacimiento

    # Licencia de conducir. Un chileno que no declara país se asume con
    # licencia chilena Clase B, que es el flujo que ya existía.
    current_user.licencia_pais_emisor = payload.licencia_pais_emisor or ("CL" if es_chileno else None)
    current_user.licencia_numero = payload.licencia_numero
    current_user.licencia_clase = payload.licencia_clase or ("B" if es_chileno else None)
    current_user.licencia_vencimiento = payload.licencia_vencimiento
    current_user.pic_url = payload.pic_url
    current_user.pic_vencimiento = payload.pic_vencimiento
    current_user.es_residente_chile = payload.es_residente_chile
    current_user.fecha_inicio_residencia = payload.fecha_inicio_residencia

    if resultado_tarjeta:
        current_user.tarjeta_token = payload.tarjeta_token
        current_user.tarjeta_ultimos4 = payload.tarjeta_ultimos4
        current_user.tarjeta_marca = resultado_tarjeta["marca"]
        current_user.tarjeta_estado = resultado_tarjeta["estado"]
        current_user.tarjeta_titular = payload.tarjeta_titular

    if payload.email:
        current_user.email = payload.email
    if payload.telefono is not None:
        current_user.telefono = payload.telefono
    if payload.direccion is not None:
        current_user.direccion = payload.direccion
    if payload.foto_perfil_verificada_url:
        current_user.foto_perfil_verificada_url = payload.foto_perfil_verificada_url
    current_user.confianza_ocr = resultado_ocr.get("confianza_ocr", 0.95)
    current_user.estado_documentos = resultado_ocr.get("estado_recomendado", "verificado")

    notas = [resultado_ocr["motivo"]] if resultado_ocr.get("motivo") else []
    if payload.qr_carnet_payload:
        # No se sabe con certeza qué formato trae el QR de la cédula nueva
        # (ver notas de la Fase 1 del plan) — se guarda tal cual para que
        # soporte lo revise, sin usarlo para aprobar ni rechazar solo.
        notas.append(f"QR cédula leído (sin interpretar): {payload.qr_carnet_payload[:500]}")
    if notas:
        current_user.notas_auditoria = " | ".join(notas)
    
    roles = current_user.roles_activos or []
    if "cliente" not in roles:
        roles.append("cliente")
    current_user.roles_activos = roles

    # Árbol de decisión de licencia (Convenio de Viena, PIC, residencia > 1 año
    # y edad mínima). No bloquea el enrolamiento: lo deriva a un ejecutivo, igual
    # que se hace con la licencia ilegible.
    config = PricingService.obtener_configuracion(db)
    evaluacion_licencia = evaluar_licencia_usuario(
        current_user,
        edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
    )

    # Estado de la licencia para ARRENDAR. Solo se fija si en este
    # enrolamiento se subió una licencia (flujo renter); el dueño la deja en
    # None y la completa aparte con POST /completar-licencia si luego arrienda.
    if payload.licencia_url:
        licencia_ok = evaluacion_licencia["permitido"] and not resultado_ocr.get("licencia_a_soporte")
        current_user.licencia_estado = "verificada" if licencia_ok else "revision"

    # Todo lo que no se pudo verificar automáticamente se junta acá y sale en
    # UN SOLO ticket. Antes se abría uno por cada problema: el ejecutivo veía
    # tres tickets del mismo usuario sin saber que eran el mismo caso, y el
    # usuario recibía tres respuestas distintas.
    problemas = []

    if resultado_ocr.get("estado_recomendado") == "requiere_revision_manual":
        problemas.append(
            f"Documento de identidad: {resultado_ocr.get('motivo') or 'requiere revisión manual'}."
        )

    if not evaluacion_licencia["permitido"]:
        problemas.append(f"Licencia de conducir: {evaluacion_licencia['motivo']}")

    if resultado_ocr.get("licencia_a_soporte") and payload.licencia_url:
        problemas.append(
            "Licencia de conducir: el OCR no la reconoció. "
            f"Documento: {payload.licencia_url}"
        )

    if resultado_tarjeta and resultado_tarjeta["estado"] == tarjetas.REVISION_MANUAL:
        problemas.append(f"Medio de pago: {resultado_tarjeta['motivo']}")

    if problemas:
        current_user.estado_documentos = "requiere_revision_manual"
        current_user.notas_auditoria = " | ".join(problemas)
        db.add(TicketSoporte(
            usuario_id=current_user.id,
            sucursal_id=current_user.sucursal_id,
            asunto="Revisión manual de enrolamiento",
            descripcion=(
                f"Enrolamiento de {payload.nombre} que no se pudo verificar por completo "
                f"de forma automática. Puntos a revisar ({len(problemas)}):\n\n"
                + "\n".join(f"- {p}" for p in problemas)
            ),
        ))

    # Registrar hold de enrolamiento de $800.000 CLP
    pago_hold = Pago(
        usuario_id=current_user.id,
        tipo="hold_enrolamiento",
        monto=settings.HOLD_ENROLAMIENTO_CLP,
        estado="capturado",
        referencia_pago=f"MP-HOLD-{uuid.uuid4().hex[:8].upper()}"
    )
    db.add(pago_hold)
    db.commit()
    db.refresh(current_user)

    from app.features.communications.notifications.service import crear_notificacion
    _estado = current_user.estado_documentos
    crear_notificacion(
        db,
        usuario_id=current_user.id,
        tipo="kyc",
        titulo=(
            "Identidad verificada" if _estado == "verificado"
            else "Tus documentos están en revisión"
        ),
        mensaje=(
            "Ya puedes reservar y publicar autos."
            if _estado == "verificado"
            else "Un ejecutivo revisa tu caso. Te avisamos apenas quede lista tu cuenta."
        ),
        entidad_tipo="usuario",
        entidad_id=current_user.id,
    )

    # Verificación de antecedentes del conductor (ChapiAPI): recién ahora la
    # identidad quedó resuelta (verificada o en revisión) y hay un RUT sobre
    # el cual consultar. Si aparece cualquier antecedente, run_and_flag_user
    # deja la cuenta en revisión manual con su propio ticket de soporte —
    # nunca lo decide en silencio el resultado del OCR/Didit de más arriba.
    if _estado == "verificado":
        background_tasks.add_task(BackgroundCheckService.run_and_flag_user_in_background, current_user.id)

    return current_user


@router.post(
    "/verificacion-licencia/sesion",
    response_model=SesionVerificacionExternaOut,
    summary="Crea una sesión de verificación de la LICENCIA de conducir con Didit",
)
@limiter.limit("10/minute")
def crear_sesion_verificacion_licencia(
    request: Request,
    payload: Optional[SesionVerificacionLicenciaCreate] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Workflow de Didit separado del de identidad (solo OCR, sin liveness ni
    face match — ver DIDIT_WORKFLOW_ID_LICENCIA, habilitado con documento
    "DL" para prácticamente todos los países). El resultado llega por
    webhook (`POST /webhooks/didit`, vendor_data="licencia:{usuario_id}").

    Mismo gate que POST /completar-licencia (que sigue siendo el respaldo
    manual si Didit no está disponible): requiere identidad ya verificada.
    Los datos que no vienen del documento (país emisor, PIC, residencia) se
    guardan de una vez, antes de abrir la sesión.
    """
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"motivo": "Primero completa la verificación de identidad.", "categoria": "sin_kyc"},
        )
    if current_user.licencia_estado == "verificada":
        raise HTTPException(status_code=400, detail="Tu licencia ya está verificada.")
    if not verificacion_didit.esta_habilitado_licencia():
        raise HTTPException(
            status_code=503,
            detail="La verificación de licencia con proveedor externo no está habilitada.",
        )

    datos = payload or SesionVerificacionLicenciaCreate()
    es_chileno = (current_user.tipo_documento or "rut") == "rut"
    if datos.licencia_pais_emisor:
        current_user.licencia_pais_emisor = datos.licencia_pais_emisor.strip().upper()
    elif not current_user.licencia_pais_emisor:
        current_user.licencia_pais_emisor = "CL" if es_chileno else None
    if datos.pic_url:
        current_user.pic_url = datos.pic_url
    if datos.es_residente_chile is not None:
        current_user.es_residente_chile = datos.es_residente_chile
    if datos.fecha_inicio_residencia:
        current_user.fecha_inicio_residencia = datos.fecha_inicio_residencia

    try:
        sesion = verificacion_didit.crear_sesion_licencia(
            vendor_data=f"licencia:{current_user.id}",
            email=current_user.email,
            callback_url=verificacion_didit.callback_url_para(datos.app),
        )
    except verificacion_didit.DiditNoConfigurado as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo iniciar la verificación: {e}")

    if not sesion.get("url") or not sesion.get("session_id"):
        raise HTTPException(status_code=502, detail="El proveedor no devolvió una sesión válida.")

    current_user.licencia_verificacion_externa_ref = sesion["session_id"]
    current_user.licencia_verificacion_externa_estado = "pendiente"
    current_user.licencia_verificacion_externa_actualizada = datetime.utcnow()
    db.commit()

    return SesionVerificacionExternaOut(
        url=sesion["url"], session_id=sesion["session_id"], estado="pendiente"
    )


@router.post("/completar-licencia", response_model=UserOut, summary="Valida solo la licencia de conducir (usuario ya verificado como dueño que quiere arrendar)")
@limiter.limit("10/minute")
def completar_licencia(
    request: Request,
    payload: CompletarLicencia,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    El usuario ya pasó el KYC de identidad (como dueño, sin licencia) y ahora
    quiere arrendar. Acá se sube y valida SOLO la licencia — no se repite
    cédula, selfie ni tarjeta, y no se cobra ningún hold nuevo.
    """
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"motivo": "Primero completa la verificación de identidad.", "categoria": "sin_kyc"},
        )

    # OCR solo de la licencia (no se re-procesa el carnet).
    lic_bytes = OCRService.descargar_imagen_bytes(payload.licencia_url)
    texto_lic, _ = OCRService.llamar_google_vision_api(lic_bytes) if lic_bytes else (None, 0.0)
    api_key, tiene_creds = OCRService._credenciales_vision()
    vision_disponible = bool(api_key or tiene_creds) and not settings.USE_OCR_MOCK
    # Con Vision activo pero sin texto legible en la foto, no se aprueba a
    # ciegas: se deriva a revisión (mismo criterio que el flujo de identidad).
    licencia_ilegible = vision_disponible and bool(lic_bytes) and not texto_lic
    licencia_no_reconocida = bool(texto_lic) and OCRService.clasificar_documento(texto_lic) != "licencia"
    datos_lic = OCRService.extraer_datos_licencia(texto_lic or "")

    es_chileno = (current_user.tipo_documento or "rut") == "rut"
    current_user.licencia_pais_emisor = (
        payload.licencia_pais_emisor
        or current_user.licencia_pais_emisor
        or current_user.pais_documento
        or ("CL" if es_chileno else None)
    )
    current_user.licencia_clase = datos_lic.get("licencia_clase") or current_user.licencia_clase or "B"
    venc_str = datos_lic.get("fecha_vencimiento_licencia")
    if venc_str:
        try:
            current_user.licencia_vencimiento = datetime.fromisoformat(str(venc_str)[:10])
        except ValueError:
            pass  # formato raro del OCR: se deja sin fecha, igual que el flujo renter
    if payload.pic_url:
        current_user.pic_url = payload.pic_url
    if payload.es_residente_chile is not None:
        current_user.es_residente_chile = payload.es_residente_chile
    if payload.fecha_inicio_residencia:
        current_user.fecha_inicio_residencia = payload.fecha_inicio_residencia

    config = PricingService.obtener_configuracion(db)
    evaluacion = evaluar_licencia_usuario(
        current_user,
        edad_minima=getattr(config, "edad_minima_arriendo", None) or 21,
    )

    a_revision = licencia_ilegible or licencia_no_reconocida or not evaluacion["permitido"]
    current_user.licencia_estado = "revision" if a_revision else "verificada"

    from app.features.communications.notifications.service import crear_notificacion
    if a_revision:
        if licencia_ilegible or licencia_no_reconocida:
            motivo = "El OCR no pudo leer la licencia en la foto."
        else:
            motivo = evaluacion.get("motivo") or "La licencia requiere revisión manual."
        db.add(TicketSoporte(
            usuario_id=current_user.id,
            sucursal_id=current_user.sucursal_id,
            asunto="Validación de licencia para arrendar",
            descripcion=(
                f"{current_user.nombre or current_user.email} (ya verificado) quiere arrendar "
                f"y subió su licencia para validar.\n\n"
                f"Licencia: {payload.licencia_url}\nPIC: {payload.pic_url or '—'}\n"
                f"Motivo de revisión: {motivo}"
            ),
        ))
        crear_notificacion(
            db, usuario_id=current_user.id, tipo="kyc",
            titulo="Tu licencia está en revisión",
            mensaje="Un ejecutivo la revisa a mano. Te avisamos apenas puedas reservar.",
            entidad_tipo="usuario", entidad_id=current_user.id,
        )
    else:
        crear_notificacion(
            db, usuario_id=current_user.id, tipo="kyc",
            titulo="Licencia validada",
            mensaje="Ya puedes reservar autos.",
            entidad_tipo="usuario", entidad_id=current_user.id,
        )

    db.commit()
    db.refresh(current_user)

    # Este es el momento en que un dueño que solo publicaba autos pasa a
    # poder arrendarlos también: vuelve a correr la verificación de
    # antecedentes por si hubiera cambiado desde el enrolamiento inicial
    # (o si nunca corrió, porque en ese momento no había subido licencia).
    if not a_revision:
        background_tasks.add_task(BackgroundCheckService.run_and_flag_user_in_background, current_user.id)

    return current_user
