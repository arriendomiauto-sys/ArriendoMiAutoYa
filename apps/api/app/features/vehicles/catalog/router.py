import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import (
    AutoCreate,
    AutoUpdate,
    AutoOut,
    ValidarDocumentosAutoRequest,
    ValidarDocumentosAutoResponse,
)
from app.models.entities import Auto, Usuario, TicketSoporte, Calificacion
from app.features.auth.login.service import get_current_user, get_optional_current_user
from app.services import tarjetas
from app.features.payments import checkout_service
from app.features.vehicles.catalog.pricing_service import PricingService
from app.features.vehicles.verification.car_doc_validator import CarDocValidator
from app.core.validators import rangos_ocupados_auto
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/autos", tags=["Autos y Marketplace"])

def _sanear_auto_out(auto: Auto, current_user: Optional[Usuario] = None) -> AutoOut:
    """
    Sanitiza los documentos sensibles del vehículo para que no queden expuestos
    en el marketplace público ni ante usuarios que no sean su dueño o admin.
    """
    es_dueno = bool(current_user and (current_user.id == auto.dueno_id or "admin" in (current_user.roles_activos or [])))
    out = AutoOut.model_validate(auto)
    if not es_dueno:
        out.doc_inscripcion_url = None
        out.doc_permiso_circulacion_url = None
        out.doc_soap_url = None
        out.doc_revision_tecnica_url = None
        out.doc_seguro_url = None
    if auto.dueno:
        out.dueno_nombre = auto.dueno.nombre or "Anfitrión"
        out.dueno_foto_url = auto.dueno.foto_perfil_verificada_url or getattr(auto.dueno, "foto_perfil_url", None)
    # Garantía estimada por categoría (sin config: usa los valores por defecto).
    out.monto_garantia = checkout_service.monto_garantia(None, auto.categoria)
    return out

def _adjuntar_calificaciones(db: Session, autos: List[Auto]) -> List[Auto]:
    """
    Deja `rating_promedio`/`rating_cantidad` como atributos
    transitorios en cada Auto (no son columnas: se calculan por request).

    Es la calificación del DUEÑO, no del vehículo — acá no hay reseñas por
    auto, solo por persona (Calificacion.destinatario_id es un usuario). Así
    que dos autos del mismo dueño muestran la misma calificación, a
    propósito: es la reputación de con quién se está tratando.
    """
    dueno_ids = {a.dueno_id for a in autos}
    promedios: dict = {}
    if dueno_ids:
        filas = (
            db.query(
                Calificacion.destinatario_id,
                func.avg(Calificacion.puntaje),
                func.count(Calificacion.id),
            )
            .filter(Calificacion.destinatario_id.in_(dueno_ids))
            .group_by(Calificacion.destinatario_id)
            .all()
        )
        promedios = {dueno_id: (round(float(prom), 1), cant) for dueno_id, prom, cant in filas}

    for auto in autos:
        prom, cant = promedios.get(auto.dueno_id, (None, 0))
        auto.rating_promedio = prom
        auto.rating_cantidad = cant
    return autos


@router.get("", response_model=List[AutoOut], summary="Buscar autos disponibles en el marketplace")
def listar_autos(
    ubicacion: Optional[str] = Query(None, description="Filtrar por ciudad/comuna"),
    estado: str = Query("activo", description="Estado de publicación"),
    tarifa_max: Optional[int] = Query(None, description="Tarifa máxima por día"),
    dueno_id: Optional[str] = Query(None, description="Filtrar por ID del dueño"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Límite de autos por página (opcional)"),
    offset: Optional[int] = Query(None, ge=0, description="Desplazamiento para paginación (opcional)"),
    db: Session = Depends(get_db),
    current_user: Optional[Usuario] = Depends(get_optional_current_user)
):
    query = db.query(Auto).filter(Auto.estado == estado)
    if ubicacion:
        query = query.filter(Auto.ubicacion_base.ilike(f"%{ubicacion}%"))
    if tarifa_max:
        query = query.filter(Auto.tarifa_dia <= tarifa_max)
    if dueno_id:
        query = query.filter(Auto.dueno_id == dueno_id)

    # Orden determinista: más recientes primero (o por id si no tiene fecha)
    query = query.order_by(Auto.fecha_publicacion.desc().nullslast(), Auto.id.asc())

    if offset is not None:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    autos = _adjuntar_calificaciones(db, query.all())
    return [_sanear_auto_out(a, current_user) for a in autos]

@router.get("/mios", response_model=List[AutoOut], summary="Autos publicados por el dueño autenticado (cualquier estado)")
def listar_mis_autos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    A diferencia de GET /autos (marketplace público, siempre filtrado a
    estado=activo salvo que se indique otro), esto devuelve TODOS los autos
    del dueño autenticado sin importar su estado — para que "Mi Flota" en
    mobile-owner también muestre los pausados/en mantención, y solo los
    suyos, en vez de mezclar la flota completa del marketplace.
    Nota de rutas: debe declararse antes de /{auto_id} para que FastAPI no
    intente interpretar "mios" como un auto_id.
    """
    autos = db.query(Auto).filter(Auto.dueno_id == current_user.id).all()
    return [_sanear_auto_out(a, current_user) for a in autos]

@router.get("/{auto_id}", response_model=AutoOut, summary="Obtener detalle de un auto")
def obtener_auto(
    auto_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[Usuario] = Depends(get_optional_current_user)
):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    return _sanear_auto_out(auto, current_user)


@router.get("/{auto_id}/disponibilidad", summary="Rangos de fechas ya ocupados de un auto")
def disponibilidad_auto(auto_id: str, db: Session = Depends(get_db)):
    """
    Fechas en que el auto NO está disponible (reservas `pendiente_pago` no
    expiradas, `confirmada` y `en_curso`). El calendario del móvil deshabilita
    esos días para que no se elijan fechas que el backend va a rechazar.
    """
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    return {"rangos_ocupados": rangos_ocupados_auto(auto_id, db)}

@router.post("", response_model=AutoOut, summary="Publicar un nuevo auto (Dueño)")
@limiter.limit("20/minute")
def crear_auto(
    request: Request,
    payload: AutoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    # La cuenta se crea simple (sin RUT ni documentos); recién acá, al
    # publicar de verdad un vehículo, se exige identidad verificada — no en
    # el registro. El frontend debería evitar llegar hasta acá sin pasar
    # antes por KYC, pero esto es lo que realmente lo hace cumplir.
    if current_user.estado_documentos != "verificado":
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu identidad antes de publicar un vehículo."
        )

    # Documentos legales del vehículo obligatorios para publicar. El padrón
    # (doc_inscripcion_url) quedó opcional: el permiso de circulación y el
    # SOAP ya traen la patente vigente, así que alcanza con esos para validar
    # el vehículo sin trabar la publicación por un trámite que no siempre
    # está a mano.
    DOCS_REQUERIDOS = {
        "doc_permiso_circulacion_url": "Permiso de circulación",
        "doc_soap_url": "Seguro Obligatorio (SOAP)",
        "doc_revision_tecnica_url": "Revisión técnica",
        "doc_certificado_gases_url": "Certificado de emisión de gases",
    }
    faltantes = [
        nombre for campo, nombre in DOCS_REQUERIDOS.items()
        if not (getattr(payload, campo, None) or "").strip()
    ]
    if faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan documentos del vehículo: {', '.join(faltantes)}. Súbelos para publicar el auto.",
        )

    # Sin tarjeta validada no se publica: es de donde salen el deducible, los
    # cargos de la devolución y los peajes que llegan después a nombre de la
    # patente. La tarjeta se registra junto con el KYC.
    if not tarjetas.puede_operar(current_user):
        raise HTTPException(
            status_code=403,
            detail=tarjetas.motivo_bloqueo(current_user, "publicar un vehículo"),
        )

    # Instalar un equipo GPS en el auto de un tercero requiere su
    # consentimiento expreso por escrito: sin él no se publica el vehículo.
    if not payload.gps_consentimiento:
        raise HTTPException(
            status_code=400,
            detail=(
                "Debes autorizar la instalación y el monitoreo del dispositivo GPS "
                "en tu vehículo para publicarlo en la plataforma."
            ),
        )

    # Verificar si la patente ya existe
    patente_existente = db.query(Auto).filter(Auto.patente == payload.patente.upper()).first()
    if patente_existente:
        raise HTTPException(status_code=400, detail="Ya existe un auto registrado con esta patente")

    # Validar documentos mediante el motor de OCR y extracción de folios
    resultado_validacion = CarDocValidator.validar_documentos_vehiculo(
        patente=payload.patente,
        doc_inscripcion_url=payload.doc_inscripcion_url,
        doc_permiso_circulacion_url=payload.doc_permiso_circulacion_url,
        doc_soap_url=payload.doc_soap_url,
        doc_revision_tecnica_url=payload.doc_revision_tecnica_url,
        doc_certificado_gases_url=payload.doc_certificado_gases_url,
        doc_seguro_url=payload.doc_seguro_url,
    )
    doc_verificados = bool(resultado_validacion.get("verificado", False))

    # Póliza de seguro comercial (opcional): solo se guarda si el OCR la
    # reconoció como un documento contractual de seguro. Una imagen genérica
    # subida en esa casilla se descarta en silencio — el seguro es opcional y
    # el auto se publica igual, pero nunca se aprueba una foto cualquiera como
    # "póliza". La app ya bloquea antes de llegar acá vía /autos/validar-
    # documentos (bloquea=True), esto es el resguardo del lado servidor.
    doc_seguro_a_guardar = payload.doc_seguro_url
    if payload.doc_seguro_url and not resultado_validacion.get("seguro_valido", False):
        logger.info(
            "Auto %s: doc_seguro_url descartado, no valida como póliza (%s).",
            payload.patente.upper(),
            resultado_validacion.get("seguro_motivo") or "sin lenguaje contractual",
        )
        doc_seguro_a_guardar = None

    # dueno_id siempre es el usuario autenticado: no se confía en el valor
    # que venga en el payload (evita que un cliente atribuya el auto a otro
    # usuario arbitrario).
    nuevo_auto = Auto(
        dueno_id=current_user.id,
        marca=payload.marca,
        modelo=payload.modelo,
        anio=payload.anio,
        patente=payload.patente.upper(),
        tarifa_dia=payload.tarifa_dia,
        ubicacion_base=payload.ubicacion_base,
        latitud=payload.latitud,
        longitud=payload.longitud,
        # Copia explícita: se guarda la secuencia tal cual la mandó el cliente
        # (posición 0 = frontal, 1 = trasera, ...). El schema ya rechazó slots
        # vacíos que correrían la indexación.
        fotos=list(payload.fotos or []),
        equipamiento=payload.equipamiento or {},
        transmision=payload.transmision,
        combustible=payload.combustible,
        asientos=payload.asientos,
        puertas=payload.puertas,
        categoria=payload.categoria,
        descripcion=payload.descripcion,
        doc_inscripcion_url=payload.doc_inscripcion_url,
        doc_permiso_circulacion_url=payload.doc_permiso_circulacion_url,
        doc_soap_url=payload.doc_soap_url,
        doc_revision_tecnica_url=payload.doc_revision_tecnica_url,
        doc_certificado_gases_url=payload.doc_certificado_gases_url,
        doc_seguro_url=doc_seguro_a_guardar,
        documentos_verificados=doc_verificados,
        gps_consentimiento=True,
        gps_consentimiento_fecha=datetime.now(timezone.utc),
    )

    # Si el OCR no pudo validar automáticamente con certeza los documentos,
    # se abre un ticket de soporte para revisión manual humana sin bloquear el registro.
    if not doc_verificados:
        db.add(
            TicketSoporte(
                usuario_id=current_user.id,
                sucursal_id=current_user.sucursal_id,
                asunto=f"Revisión manual de documentos de vehículo - Patente {payload.patente.upper()}",
                descripcion=(
                    f"El OCR no pudo validar con certeza los documentos del auto {payload.marca} {payload.modelo} "
                    f"({payload.patente.upper()}).\n"
                    f"Motivo: {resultado_validacion.get('motivo_soporte', 'Verificación visual requerida')}\n"
                    f"Padrón: {payload.doc_inscripcion_url}\n"
                    f"Permiso: {payload.doc_permiso_circulacion_url}\n"
                    f"SOAP: {payload.doc_soap_url}\n"
                    f"Revisión Técnica: {payload.doc_revision_tecnica_url}\n"
                    f"Certificado de gases: {payload.doc_certificado_gases_url}"
                ),
            )
        )

    # Asegurar que el usuario tenga el rol "dueno"
    roles = current_user.roles_activos or []
    if "dueno" not in roles:
        roles.append("dueno")
        current_user.roles_activos = roles

    db.add(nuevo_auto)
    db.commit()
    db.refresh(nuevo_auto)
    return nuevo_auto


# Nombre interno con el que CarDocValidator identifica cada documento ->
# campo del payload que lo trae, y -> el nombre que ya conoce el frontend
# (packages TIPO_POR_CAMPO en AddEditCarScreen.js). Los tres vocabularios
# no coinciden entre sí, así que hace falta esta doble tabla para no
# devolverle a la app un `tipo` que no sabe reconocer.
_DOC_INTERNO_A_CAMPO = {
    "padron": "doc_inscripcion_url",
    "permiso": "doc_permiso_circulacion_url",
    "soap": "doc_soap_url",
    "revision": "doc_revision_tecnica_url",
    "gases": "doc_certificado_gases_url",
}
_DOC_INTERNO_A_PUBLICO = {
    "padron": "padron",
    "permiso": "permiso_circulacion",
    "soap": "soap",
    "revision": "revision_tecnica",
    "gases": "certificado_gases",
}


@router.post(
    "/validar-documentos",
    response_model=ValidarDocumentosAutoResponse,
    summary="Lee en vivo un documento legal recién subido, antes de publicar",
)
@limiter.limit("30/minute")
def validar_documentos_auto(
    request: Request,
    payload: ValidarDocumentosAutoRequest,
    current_user: Usuario = Depends(get_current_user),
):
    """
    Se llama apenas se sube CADA documento (padrón, permiso, SOAP, revisión
    técnica, certificado de gases y — opcional — la póliza de seguro), para
    mostrar de inmediato si el OCR lo reconoció, en vez de que el dueño se
    entere al intentar publicar.

    Para los documentos obligatorios nunca bloquea: POST /autos deriva a revisión
    manual ante duda en vez de rechazar. La póliza de seguro OPCIONAL es la
    excepción: si se sube una imagen que no es un documento contractual de
    seguro, `bloquea=True` — no tiene sentido "aprobar" una foto cualquiera
    como póliza.
    """
    resultado = CarDocValidator.validar_documentos_vehiculo(
        patente=payload.patente,
        doc_inscripcion_url=payload.doc_inscripcion_url,
        doc_permiso_circulacion_url=payload.doc_permiso_circulacion_url,
        doc_soap_url=payload.doc_soap_url,
        doc_revision_tecnica_url=payload.doc_revision_tecnica_url,
        doc_certificado_gases_url=payload.doc_certificado_gases_url,
        doc_seguro_url=payload.doc_seguro_url,
    )

    # En modo mock (USE_OCR_MOCK) no hay desglose por documento, solo folios:
    # se arma un veredicto igual de simple a partir de si el folio salió.
    detalles = resultado.get("detalles") or {}
    folios = resultado.get("folios_detectados") or {}

    documentos = []
    for tipo_interno, campo in _DOC_INTERNO_A_CAMPO.items():
        if not getattr(payload, campo, None):
            continue

        detalle = detalles.get(tipo_interno)
        if detalle is not None:
            valido = bool(detalle.get("valido"))
            legible = bool(detalle.get("tiene_texto"))
        else:
            valido = bool(folios.get(tipo_interno))
            legible = valido

        if valido:
            estado, motivo = "vigente", "Documento reconocido para esta patente."
        elif legible:
            estado, motivo = (
                "revision_pendiente",
                "No pudimos confirmarlo automáticamente. Lo revisará un ejecutivo al publicar.",
            )
        else:
            estado, motivo = (
                "no_legible",
                "No pudimos leer este documento. Prueba con una foto más nítida y con buena luz.",
            )

        documentos.append(
            {
                "tipo": _DOC_INTERNO_A_PUBLICO[tipo_interno],
                "estado": estado,
                "motivo": motivo,
                "bloquea": False,
            }
        )

    # Seguro comercial opcional: a diferencia de los obligatorios, acá SÍ se
    # bloquea. Si el dueño sube algo que no se lee como una póliza, la app no
    # lo deja publicar con ese archivo (que lo quite o suba el contrato real).
    if payload.doc_seguro_url:
        if resultado.get("seguro_valido"):
            documentos.append(
                {
                    "tipo": "seguro",
                    "estado": "vigente",
                    "motivo": "Póliza de seguro reconocida.",
                    "bloquea": False,
                }
            )
        else:
            documentos.append(
                {
                    "tipo": "seguro",
                    "estado": "tipo_incorrecto",
                    "motivo": (
                        resultado.get("seguro_motivo")
                        or "Esto no parece una póliza de seguro. Sube el contrato o "
                        "certificado de cobertura de tu aseguradora."
                    ),
                    "bloquea": True,
                }
            )

    return {"verificado": bool(resultado.get("verificado", False)), "documentos": documentos}


@router.patch("/{auto_id}", response_model=AutoOut, summary="Editar o pausar auto publicado")
def actualizar_auto(
    auto_id: str,
    payload: AutoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")

    if auto.dueno_id != current_user.id and "admin" not in (current_user.roles_activos or []):
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este auto.")

    if payload.tarifa_dia is not None:
        if payload.tarifa_dia <= 0 or payload.tarifa_dia % 5000 != 0:
            raise HTTPException(
                status_code=400,
                detail="La tarifa diaria debe ser un múltiplo de $5.000 CLP."
            )
        categoria = payload.categoria or auto.categoria
        if categoria:
            config = PricingService.obtener_configuracion(db)
            tarifas_cfg = getattr(config, "tarifas_categoria", None) or {}
            cat_cfg = tarifas_cfg.get(categoria) or {
                "economico": {"base": 40000, "min": 25000},
                "sedan": {"base": 55000, "min": 35000},
                "suv": {"base": 80000, "min": 45000},
                "camioneta": {"base": 95000, "min": 55000},
                "premium": {"base": 180000, "min": 80000},
            }.get(categoria)

            if cat_cfg:
                base = cat_cfg.get("base", 350000)
                min_piso = cat_cfg.get("min", 15000)
                if payload.tarifa_dia > base or payload.tarifa_dia < min_piso:
                    raise HTTPException(
                        status_code=400,
                        detail=f"La tarifa diaria para la categoría '{categoria}' debe estar entre ${min_piso:,} y ${base:,} CLP (precio fijado por la plataforma)."
                    )
        else:
            if payload.tarifa_dia < 15000:
                raise HTTPException(
                    status_code=400,
                    detail="La tarifa diaria mínima es de $15.000 CLP."
                )

        auto.tarifa_dia = payload.tarifa_dia
    if payload.estado is not None:
        auto.estado = payload.estado
    if payload.fotos is not None:
        auto.fotos = list(payload.fotos)  # secuencia verbatim
    if payload.ubicacion_base is not None:
        auto.ubicacion_base = payload.ubicacion_base
    if payload.latitud is not None:
        auto.latitud = payload.latitud
    if payload.longitud is not None:
        auto.longitud = payload.longitud
    if payload.equipamiento is not None:
        auto.equipamiento = payload.equipamiento
    for campo in ("transmision", "combustible", "asientos", "puertas", "categoria", "descripcion"):
        valor = getattr(payload, campo, None)
        if valor is not None:
            setattr(auto, campo, valor)

    # Si el dueño reemplaza algún documento, vuelve a quedar pendiente de
    # revisión hasta que un ejecutivo lo valide de nuevo.
    docs_cambiados = False
    for campo in ("doc_inscripcion_url", "doc_permiso_circulacion_url", "doc_soap_url", "doc_revision_tecnica_url"):
        valor = getattr(payload, campo, None)
        if valor is not None:
            setattr(auto, campo, valor)
            docs_cambiados = True
    if docs_cambiados:
        auto.documentos_verificados = False

    db.commit()
    db.refresh(auto)
    return auto
