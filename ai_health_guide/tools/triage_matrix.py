from ai_health_guide.models.clinical import TriageColor, RedFlag


def triage_decision_matrix(
    red_flags: list[RedFlag],
    severity: int,
    visual_concerns: list[str],
) -> TriageColor:
    """Deterministic triage classification. This is the AUTHORITATIVE source — not the LLM.

    Rules:
    - Any critical red flag OR any high red flag OR severity >= 7 -> RED
    - Moderate red flag OR severity 5-6 OR visual concerns present -> YELLOW
    - No red flags AND severity 1-4 AND no visual concerns -> GREEN
    """
    critical_flags = [f for f in red_flags if f.severity == "critical"]
    high_flags     = [f for f in red_flags if f.severity == "high"]
    moderate_flags = [f for f in red_flags if f.severity == "moderate"]

    if critical_flags or high_flags or severity >= 7:
        return TriageColor.RED
    if moderate_flags or 5 <= severity <= 6 or len(visual_concerns) > 0:
        return TriageColor.YELLOW
    return TriageColor.GREEN


def map_facility_type(color: TriageColor) -> str:
    """Map triage color to required facility type."""
    mapping = {
        TriageColor.RED:    "emergency_department",
        TriageColor.YELLOW: "urgent_care",
        TriageColor.GREEN:  "clinic",
    }
    return mapping[color]


def urgency_description(color: TriageColor) -> str:
    """Plain-language urgency description for the triage color."""
    descriptions = {
        TriageColor.RED:    "Emergency — Go Now. Call emergency services or go directly to the emergency department.",
        TriageColor.YELLOW: "Urgent — Within 24 Hours. See a healthcare provider as soon as possible today.",
        TriageColor.GREEN:  "Non-Urgent — Schedule a Visit. You can book an appointment with a clinic or GP.",
    }
    return descriptions[color]
