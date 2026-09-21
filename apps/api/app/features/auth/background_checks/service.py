"""
Orquestador del estado de antecedentes.

Ya no consulta a ningún proveedor externo: el estado sale de los certificados oficiales
del Registro Civil que sube la persona (ver `certificados_service`). Se conservan los
envoltorios `*_in_background` porque el enrolamiento, los webhooks de Didit y la
asignación del segundo conductor los siguen llamando: ahora dejan el estado en
"pendiente" hasta que haya certificados aprobados, en vez de marcar "limpio" sin haber
mirado nada.
"""
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class BackgroundCheckService:

    @classmethod
    def run_and_flag_user_in_background(cls, user_id: str) -> None:
        """
        Envoltorio pensado para `BackgroundTasks.add_task`: abre su propia sesión de BD
        (la del request ya se cerró cuando esto corre) y la cierra al terminar.
        Best-effort: si algo falla se loguea y no revienta nada.
        """
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            cls.run_and_flag_user(db, user_id)
        except Exception:  # noqa: BLE001
            logger.exception("Cálculo de antecedentes falló para usuario %s", user_id)
        finally:
            db.close()

    @classmethod
    def run_and_flag_user(cls, db, user_id: str) -> Optional[str]:
        """Recalcula `Usuario.antecedentes_estado` a partir de sus certificados."""
        from app.models.entities import Usuario
        from app.features.auth.background_checks import certificados_service

        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
        if not usuario:
            logger.warning("BackgroundCheck: usuario %s no existe", user_id)
            return None
        return certificados_service.recalcular_estado_usuario(db, usuario)

    @classmethod
    def run_and_flag_conductor_in_background(cls, conductor_id: str) -> None:
        """Envoltorio para BackgroundTasks — ver run_and_flag_user_in_background."""
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            cls.run_and_flag_conductor(db, conductor_id)
        except Exception:  # noqa: BLE001
            logger.exception("Cálculo de antecedentes falló para conductor %s", conductor_id)
        finally:
            db.close()

    @classmethod
    def run_and_flag_conductor(cls, db, conductor_id: str) -> Optional[str]:
        """Recalcula `ConductorAdicional.antecedentes_estado` (segundo conductor de una reserva)."""
        from app.models.entities import ConductorAdicional
        from app.features.auth.background_checks import certificados_service

        conductor = db.query(ConductorAdicional).filter(ConductorAdicional.id == conductor_id).first()
        if not conductor:
            logger.warning("BackgroundCheck: conductor adicional %s no existe", conductor_id)
            return None
        return certificados_service.recalcular_estado_conductor(db, conductor)
