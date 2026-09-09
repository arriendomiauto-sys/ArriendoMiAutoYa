"""
Orchestrator service for criminal and driver background verification.
"""
from typing import Optional
import logging

from .models import BackgroundCheckResult
from .chapi_provider import ChapiApiProvider

logger = logging.getLogger(__name__)

# ============================================================================
# Servicio BackgroundCheckService
# ============================================================================
class BackgroundCheckService:

    @classmethod
    def verify_driver_eligibility(cls, rut: str) -> BackgroundCheckResult:
        """
        Verifica si el usuario está habilitado para conducir y no posee antecedentes graves.
        """
        # Bloque: Guarda de entrada — sin RUT no se puede consultar nada
        if not rut:
            return BackgroundCheckResult(
                is_eligible=False,
                criminal_record_clean=False,
                driver_record_clean=False,
                rejection_reasons=["RUT no proporcionado"],
            )

        # Bloque: Delegación en el proveedor (ChapiAPI o mock)
        return ChapiApiProvider.check_driver_background(rut)

    @classmethod
    def run_and_flag_user(cls, db, user_id: str) -> Optional[BackgroundCheckResult]:
        """
        Ejecuta la verificación de antecedentes y, si el conductor está
        inhabilitado, marca al usuario para revisión manual (bloquea reservas
        y publicaciones) abriendo un ticket de soporte. Pensada para correr en
        background tras el veredicto de identidad.
        """
        # Bloque: Import diferido para evitar ciclos con los modelos/servicios
        from app.models.entities import Usuario, TicketSoporte
        from app.features.communications.notifications.service import crear_notificacion

        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
        if not usuario:
            logger.warning("BackgroundCheck: usuario %s no existe", user_id)
            return None

        # Bloque: Consulta de antecedentes por RUT
        result = cls.verify_driver_eligibility(usuario.rut or "")

        # Bloque: Persistencia del veredicto y marcado para revisión si aplica
        if result.is_eligible:
            usuario.antecedentes_estado = "limpio"
            db.commit()
            logger.info("BackgroundCheck: usuario %s con antecedentes limpios", user_id)
            return result

        usuario.antecedentes_estado = "bloqueado" if result.has_suspended_license else "revision"
        usuario.estado_documentos = "requiere_revision_manual"
        motivos = result.rejection_reasons or ["Antecedentes del conductor requieren revisión."]
        usuario.notas_auditoria = " | ".join(motivos)[:1000]

        db.add(TicketSoporte(
            usuario_id=usuario.id,
            sucursal_id=usuario.sucursal_id,
            asunto="Antecedentes del conductor requieren revisión",
            descripcion=(
                f"La verificación de antecedentes de {usuario.nombre or usuario.email} "
                f"(RUT {usuario.rut or '—'}) no pasó automáticamente:\n\n"
                + "\n".join(f"- {m}" for m in motivos)
            ),
        ))
        db.commit()

        crear_notificacion(
            db,
            usuario_id=usuario.id,
            tipo="kyc",
            titulo="Estamos revisando tu cuenta",
            mensaje="Un ejecutivo está revisando tu información. Te avisamos apenas quede lista.",
            entidad_tipo="usuario",
            entidad_id=usuario.id,
        )
        logger.info("BackgroundCheck: usuario %s marcado para revisión (%s)", user_id, motivos)
        return result
