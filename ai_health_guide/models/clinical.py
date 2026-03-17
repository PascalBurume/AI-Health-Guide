from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel


class TriageColor(str, Enum):
    RED    = "RED"     # Emergency — go to ED now
    YELLOW = "YELLOW"  # Urgent — see provider within 24h
    GREEN  = "GREEN"   # Non-urgent — schedule appointment


class RedFlag(BaseModel):
    symptom:            str
    severity:           Literal["critical", "high", "moderate"]
    description:        str
    requires_emergency: bool


class ABCDEAssessment(BaseModel):
    airway:      Optional[str] = None
    breathing:   Optional[str] = None
    circulation: Optional[str] = None
    disability:  Optional[str] = None
    exposure:    Optional[str] = None
    notes:       str           = ""


class TriageResult(BaseModel):
    color:                TriageColor
    rationale:            str
    facility_type_needed: str  # "emergency_department" | "urgent_care" | "clinic" | "pharmacy"
    urgency_description:  str
    determined_by:        Literal["rule_matrix", "llm_override"] = "rule_matrix"
