"""
Módulo de Auditoría de Seguridad (OWASP A09:2021 - Security Logging & Monitoring).
Registra eventos críticos de seguridad de manera estructurada sin exponer datos sensibles.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger("security.audit")

class SecurityAudit:
    @staticmethod
    def log_event(
        event_type: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        resource: Optional[str] = None,
        status: str = "SUCCESS",
        details: Optional[Dict[str, Any]] = None,
    ):
        """Registra un evento de seguridad de forma estructurada."""
        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event_type,
            "status": status,
            "user_id": user_id or "anonymous",
            "ip": ip_address or "unknown",
            "resource": resource or "unknown",
            "details": details or {},
        }
        
        log_msg = f"[SECURITY AUDIT] [{status}] {event_type} | User: {user_id or 'anon'} | IP: {ip_address} | Res: {resource}"
        if status == "SUCCESS":
            logger.info(log_msg)
        else:
            logger.warning(log_msg)
            
        return audit_entry
