from enum import Enum
from datetime import datetime
from typing import Optional, Literal
from uuid import uuid4
from pydantic import BaseModel, Field

from .clinical import ABCDEAssessment, RedFlag, TriageResult
from .report import SOAPNote, PatientReport
from .safety import SafetyCheckResult


class Stage(str, Enum):
    INTAKE      = "intake"
    QUESTIONING = "questioning"
    VISUAL      = "visual"
    TRIAGE      = "triage"
    REPORT      = "report"
    COMPLETE    = "complete"


class Message(BaseModel):
    role:       Literal["patient", "agent", "system"]
    content:    str
    language:   str
    timestamp:  datetime = Field(default_factory=datetime.utcnow)
    agent_name: Optional[str] = None
    image_id:   Optional[str] = None


class Location(BaseModel):
    latitude:  float
    longitude: float
    address:   Optional[str] = None


class Facility(BaseModel):
    name:             str
    place_id:         str
    address:          str
    location:         Location
    facility_type:    str
    distance_meters:  float
    duration_minutes: float
    is_open:          bool
    rating:           Optional[float] = None
    phone:            Optional[str] = None


class SessionState(BaseModel):
    session_id:           str      = Field(default_factory=lambda: str(uuid4()))
    created_at:           datetime = Field(default_factory=datetime.utcnow)
    current_stage:        Stage    = Stage.INTAKE
    patient_language:     str      = "en"
    clinical_language:    str      = "en"
    conversation_history: list[Message] = []

    # Stage 1 — Intake
    chief_complaint:         str = ""
    chief_complaint_english: str = ""

    # Stage 2 — Questioning
    structured_symptoms:  dict                      = {}
    abcde_assessment:     Optional[ABCDEAssessment] = None
    red_flags:            list[RedFlag]             = []
    severity:             int                       = 0
    questioning_turns:    int                       = 0
    questioning_complete: bool                      = False

    # Stage 3 — Visual
    image_data:          Optional[str] = None  # base64
    visual_observations: list[str]     = []
    image_analyzed:      bool          = False

    # Stage 4 — Triage
    triage: Optional[TriageResult] = None

    # Stage 5 — Reports
    patient_report:   Optional[PatientReport] = None
    clinician_report: Optional[SOAPNote]      = None

    # Cross-cutting
    safety_checks:        list[SafetyCheckResult] = []
    disclaimers_verified: bool                    = False
