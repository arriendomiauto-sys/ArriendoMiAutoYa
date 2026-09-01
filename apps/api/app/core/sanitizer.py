"""
Módulo de Sanitización de Entradas (Anti-XSS / Input Hardening).
Limpia texto de usuario para evitar inyección de código JavaScript o HTML malicioso.
"""
import re
import html
from typing import Optional

# Patrones de etiquetas o inyecciones peligrosas
DANGEROUS_TAGS_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed|style|meta|link|svg|applet|form|base)[^>]*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL
)
SELF_CLOSING_DANGEROUS_TAGS = re.compile(
    r"<\s*(script|iframe|object|embed|style|meta|link|svg|applet|form|base|input|img)[^>]*>",
    re.IGNORECASE
)
EVENT_HANDLERS_PATTERN = re.compile(
    r"\s*on[a-zA-Z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)",
    re.IGNORECASE
)
JAVASCRIPT_URI_PATTERN = re.compile(
    r"(javascript|vbscript|data\s*:\s*text/html)\s*:",
    re.IGNORECASE
)

def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitiza una cadena de texto eliminando etiquetas HTML peligrosas,
    manejadores de eventos JS (onload, onerror, onclick) y esquemas URI maliciosos.
    Conserva texto en español, tildes, números y formato legible.
    """
    if text is None or not isinstance(text, str):
        return text
    
    # 1. Eliminar bytes nulos
    cleaned = text.replace("\x00", "")
    
    # 2. Eliminar bloques de tags peligrosos con su contenido
    cleaned = DANGEROUS_TAGS_PATTERN.sub("", cleaned)
    
    # 3. Eliminar tags peligrosos individuales
    cleaned = SELF_CLOSING_DANGEROUS_TAGS.sub("", cleaned)
    
    # 4. Eliminar manejadores de eventos (ej: onerror=alert(1))
    cleaned = EVENT_HANDLERS_PATTERN.sub("", cleaned)
    
    # 5. Desactivar protocolos maliciosos
    cleaned = JAVASCRIPT_URI_PATTERN.sub("blocked-protocol:", cleaned)
    
    return cleaned.strip()
