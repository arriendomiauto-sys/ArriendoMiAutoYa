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
    def run_and_flag_user_in_background(cls, user_id: str) -> None:
        """
        Envoltorio pensado para `BackgroundTasks.add_task`: abre su propia
        sesión de BD (la del request ya se cerró cuando esto corre) y la
        cierra al terminar. Best-effort: si algo falla, se loguea y no
        revienta nada (BackgroundTasks no tiene a quién devolverle el error).
        Único punto de entrada que deberían usar los routers de enrolamiento
        para no duplicar el manejo de sesión.
        """
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            cls.run_and_flag_user(db, user_id)
        except Exception:  # noqa: BLE001
            logger.exception("Verificación de antecedentes falló para usuario %s", user_id)
        finally:
            db.close()

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

    @classmethod
    def run_and_flag_conductor_in_background(cls, conductor_id: str) -> None:
        """Envoltorio para BackgroundTasks — ver run_and_flag_user_in_background."""
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            cls.run_and_flag_conductor(db, conductor_id)
        except Exception:  # noqa: BLE001
            logger.exception("Verificación de antecedentes falló para conductor %s", conductor_id)
        finally:
            db.close()

    @classmethod
    def run_and_flag_conductor(cls, db, conductor_id: str) -> Optional[BackgroundCheckResult]:
        """
        Misma verificación que run_and_flag_user, pero para un
        ConductorAdicional (segundo conductor de una reserva) — no tiene
        cuenta propia, así que el ticket y la notificación se dirigen al
        titular de la reserva, que es quien lo asignó y a quien le compete
        resolverlo.
        """
        from app.models.entities import ConductorAdicional, Reserva, TicketSoporte
        from app.features.communications.notifications.service import crear_notificacion

        conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == conductor_id).first()
        if not conductor:
            logger.warning("BackgroundCheck: conductor adicional %s no existe", conductor_id)
            return None

        reserva = db.query(Reserva).filter(Reserva.id == conductor.reserva_id).first()

        result = cls.verify_driver_eligibility(conductor.rut or "")

        if result.is_eligible:
            conductor.antecedentes_estado = "limpio"
            db.commit()
            logger.info("BackgroundCheck: conductor %s con antecedentes limpios", conductor_id)
            return result

        conductor.antecedentes_estado = "bloqueado" if result.has_suspended_license else "revision"
        conductor.estado_kyc = "requiere_revision_manual"
        motivos = result.rejection_reasons or ["Antecedentes del conductor requieren revisión."]
        nota = " | ".join(motivos)[:1000]
        conductor.notas_auditoria = (
            f"{conductor.notas_auditoria} | {nota}" if conductor.notas_auditoria else nota
        )

        if reserva:
            db.add(TicketSoporte(
                usuario_id=reserva.cliente_id,
                sucursal_id=None,
                asunto="Antecedentes del segundo conductor requieren revisión",
                descripcion=(
                    f"La verificación de antecedentes del segundo conductor {conductor.nombre or '—'} "
                    f"(RUT {conductor.rut or '—'}) de la reserva {reserva.id} no pasó automáticamente:\n\n"
                    + "\n".join(f"- {m}" for m in motivos)
                ),
            ))
        db.commit()

        if reserva:
            crear_notificacion(
                db,
                usuario_id=reserva.cliente_id,
                tipo="kyc",
                titulo="El segundo conductor necesita revisión",
                mensaje=f"Un ejecutivo está revisando los antecedentes de {conductor.nombre or 'tu segundo conductor'}. Te avisamos apenas quede listo.",
                entidad_tipo="reserva",
                entidad_id=conductor.reserva_id,
            )
        logger.info("BackgroundCheck: conductor %s marcado para revisión (%s)", conductor_id, motivos)
        return result
