from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.schemas import AutoCreate, AutoUpdate, AutoOut, DocumentosAutoIn
from app.models.entities import Auto, Usuario, TicketSoporte
from app.services.auth import get_current_user
from app.features.verificacion_vehiculos.car_doc_validator import CarDocValidator
from app.core.limiter import limiter

router = APIRouter(prefix="/autos", tags=["Autos y Marketplace"])

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
    return query.all()

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

@router.post(
    "/validar-documentos",
    summary="Lee los documentos legales del auto y responde si sirven para publicar",
)
@limiter.limit("10/minute")
def validar_documentos_auto(
    request: Request,
    payload: DocumentosAutoIn,
    current_user: Usuario = Depends(get_current_user),
):
    """
    Pasa por OCR el padrón, el permiso de circulación, el SOAP, el seguro del
    auto y la revisión técnica, y responde por cada uno qué documento es, de
    qué patente y hasta cuándo vale.

    Existe aparte de POST /autos para que el dueño se entere de un permiso
    vencido o de un documento de otro auto mientras los sube, y no después de
    llenar toda la publicación.
    """
    return CarDocValidator.validar_documentos_vehiculo(
        patente=payload.patente,
        doc_inscripcion_url=payload.doc_inscripcion_url,
        doc_permiso_circulacion_url=payload.doc_permiso_circulacion_url,
        doc_soap_url=payload.doc_soap_url,
        doc_revision_tecnica_url=payload.doc_revision_tecnica_url,
        doc_seguro_url=payload.doc_seguro_url,
    )

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
        doc_seguro_url=payload.doc_seguro_url,
    )

    # Un documento vencido, de otra patente o de otro tipo no se publica: no
    # es algo que un ejecutivo pueda "aprobar igual". Lo dudoso (ilegible, sin
    # fecha) sigue pasando a revisión manual más abajo.
    bloqueantes = resultado_validacion.get("bloqueantes") or []
    if bloqueantes:
        raise HTTPException(
            status_code=400,
            detail=" ".join(b["motivo"] for b in bloqueantes if b.get("motivo"))
            or "Los documentos del vehículo no están vigentes.",
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
        doc_seguro_url=payload.doc_seguro_url,
        documentos_verificados=doc_verificados,
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
