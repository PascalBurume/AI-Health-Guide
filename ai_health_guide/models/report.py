from pydantic import BaseModel
from .clinical import TriageColor


class PatientReport(BaseModel):
    summary:                 str
    what_we_found:           str
    what_to_do_next:         str
    facility_recommendation: str
    directions_summary:      str
    what_to_tell_doctor:     str
    disclaimer:              str
    language:                str


class SOAPNote(BaseModel):
    subjective:        str
    objective:         str
    assessment:        str
    plan:              str
    triage_color:      TriageColor
    red_flags_summary: list[str]
    language:          str
    patient_language:  str  # For clinician reference / interpreter needs


class FinalReport(BaseModel):
    session_id:               str
    patient_report:           PatientReport
    clinician_report:         SOAPNote
    triage_color:             TriageColor
    session_duration_seconds: int
    safety_checks_passed:     bool
