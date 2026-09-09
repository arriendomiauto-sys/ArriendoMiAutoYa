"""
Data models for background checks and driver eligibility.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

# ============================================================================
# Resultado del análisis de antecedentes
# ============================================================================
@dataclass
class BackgroundCheckResult:
    is_eligible: bool  # True si no presenta condenas ni suspensión de licencia
    criminal_record_clean: bool
    driver_record_clean: bool
    has_suspended_license: bool = False
    serious_infractions_count: int = 0
    raw_details: Dict[str, Any] = field(default_factory=dict)
    rejection_reasons: List[str] = field(default_factory=list)
