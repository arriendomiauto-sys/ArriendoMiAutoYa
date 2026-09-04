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
from app.services.auth import get_current_user
from app.services import tarjetas
from app.features.verificacion_vehiculos.car_doc_validator import CarDocValidator
from app.core.limiter import limiter

router = APIRouter(prefix="/autos", tags=["Autos y Marketplace"])

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
    db: Session = Depends(get_db)
):
    query = db.query(Auto).filter(Auto.estado == estado)
    if ubicacion:
        query = query.filter(Auto.ubicacion_base.ilike(f"%{ubicacion}%"))
    if tarifa_max:
        query = query.filter(Auto.tarifa_dia <= tarifa_max)
    if dueno_id:
        query = query.filter(Auto.dueno_id == dueno_id)
    # El resto de los filtros (transmisión, combustible, rango de precio) y
    # el orden se resuelven en la app, igual que la categoría: ya trae todo
    # el catálogo a memoria y filtrar ahí evita un round-trip por cada toque
    # de filtro.
    return _adjuntar_calificaciones(db, query.all())

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
    return db.query(Auto).filter(Auto.dueno_id == current_user.id).all()

@router.get("/{auto_id}", response_model=AutoOut, summary="Obtener detalle de un auto")
def obtener_auto(auto_id: str, db: Session = Depends(get_db)):
    auto = db.query(Auto).filter(Auto.id == auto_id).first()
    if not auto:
        raise HTTPException(status_code=404, detail="Auto no encontrado")
    return auto

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

    # Documentos legales del vehículo: los 4 son obligatorios para publicar.
    DOCS_REQUERIDOS = {
        "doc_inscripcion_url": "Certificado de inscripción (padrón)",
        "doc_permiso_circulacion_url": "Permiso de circulación",
        "doc_soap_url": "Seguro Obligatorio (SOAP)",
        "doc_revision_tecnica_url": "Revisión técnica",
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
    )
    doc_verificados = bool(resultado_validacion.get("verificado", False))

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
        fotos=payload.fotos or [],
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
                    f"Revisión Técnica: {payload.doc_revision_tecnica_url}"
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
}
_DOC_INTERNO_A_PUBLICO = {
    "padron": "padron",
    "permiso": "permiso_circulacion",
    "soap": "soap",
    "revision": "revision_tecnica",
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
    técnica), para mostrar de inmediato si el OCR lo reconoció, en vez de que
    el dueño se entere recién al intentar publicar.

    Nunca bloquea: la decisión real de si un auto se publica es de POST
    /autos, que ante un documento que el OCR no pudo confirmar lo deriva a
    revisión manual en vez de rechazarlo. Esta lectura es solo informativa —
    bloquear acá sería más estricto que el propio flujo de publicación.
    """
    resultado = CarDocValidator.validar_documentos_vehiculo(
        patente=payload.patente,
        doc_inscripcion_url=payload.doc_inscripcion_url,
        doc_permiso_circulacion_url=payload.doc_permiso_circulacion_url,
        doc_soap_url=payload.doc_soap_url,
        doc_revision_tecnica_url=payload.doc_revision_tecnica_url,
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
        auto.tarifa_dia = payload.tarifa_dia
    if payload.estado is not None:
        auto.estado = payload.estado
    if payload.fotos is not None:
        auto.fotos = payload.fotos
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
