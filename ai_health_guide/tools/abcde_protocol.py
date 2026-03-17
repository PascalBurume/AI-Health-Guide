"""ABCDE protocol checklist logic for clinical questioning completeness."""

from ai_health_guide.models.session import SessionState


ABCDE_QUESTIONS: dict[str, list[str]] = {
    "airway": [
        "Do you have any difficulty swallowing?",
        "Is there any swelling in your throat?",
        "Do you feel like your airway is obstructed?",
    ],
    "breathing": [
        "Are you having any trouble breathing?",
        "Do you feel short of breath?",
        "Is your breathing fast, slow, or normal?",
    ],
    "circulation": [
        "Do you have any chest pain or palpitations?",
        "Have you noticed any changes in your skin color (pale, blue, flushed)?",
        "Are you feeling cold or sweaty?",
    ],
    "disability": [
        "Are you feeling confused or disoriented?",
        "Do you have any weakness or numbness in your limbs?",
        "Have you had any seizures, fainting, or loss of consciousness?",
    ],
    "exposure": [
        "Do you have any visible rashes, wounds, or swelling?",
        "Have you been exposed to any chemicals, extreme temperatures, or allergens?",
        "Is there anything unusual on your skin you'd like to describe?",
    ],
}


def get_relevant_categories(chief_complaint: str) -> list[str]:
    """Return ABCDE categories most relevant to the chief complaint."""
    complaint_lower = chief_complaint.lower()

    relevant = []

    if any(w in complaint_lower for w in ["breath", "breathing", "chest", "cough", "lungs"]):
        relevant += ["airway", "breathing", "circulation"]
    elif any(w in complaint_lower for w in ["heart", "palpitation", "pulse", "blood pressure"]):
        relevant += ["circulation"]
    elif any(w in complaint_lower for w in ["head", "dizzy", "confusion", "seizure", "faint", "numb", "weak"]):
        relevant += ["disability"]
    elif any(w in complaint_lower for w in ["skin", "rash", "redness", "swelling", "wound"]):
        relevant += ["exposure"]

    # Always include a minimum set
    if not relevant:
        relevant = ["breathing", "circulation", "disability"]

    return list(dict.fromkeys(relevant))  # deduplicate, preserve order


def check_completeness(session: SessionState) -> bool:
    """Determine whether sufficient clinical information has been gathered to proceed to triage."""
    has_chief_complaint = bool(session.chief_complaint)
    has_severity        = session.severity > 0
    has_duration        = "duration" in session.structured_symptoms
    min_turns           = session.questioning_turns >= 3
    return all([has_chief_complaint, has_severity, has_duration, min_turns])
