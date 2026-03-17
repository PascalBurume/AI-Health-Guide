from ai_health_guide.models.clinical import RedFlag

# Full red flag keyword database.
# Each entry maps a clinical symptom to one or more trigger keywords.
RED_FLAG_DATABASE: list[dict] = [
    {
        "symptom": "chest pain",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["chest pain", "chest pressure", "chest tightness", "heart pain"],
    },
    {
        "symptom": "difficulty breathing",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["can't breathe", "cannot breathe", "shortness of breath", "breathing difficulty", "struggling to breathe"],
    },
    {
        "symptom": "sudden severe headache",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["worst headache", "thunderclap headache", "sudden headache", "explosive headache"],
    },
    {
        "symptom": "stroke symptoms",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["face drooping", "arm weakness", "speech difficulty", "sudden numbness", "can't speak", "slurred speech"],
    },
    {
        "symptom": "loss of consciousness",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["passed out", "fainted", "lost consciousness", "blacked out", "unconscious"],
    },
    {
        "symptom": "suicidal ideation",
        "severity": "critical",
        "requires_emergency": True,
        "keywords": ["want to die", "kill myself", "end my life", "suicide", "self-harm", "hurt myself"],
    },
    {
        "symptom": "severe bleeding",
        "severity": "high",
        "requires_emergency": True,
        "keywords": ["heavy bleeding", "won't stop bleeding", "blood loss", "bleeding a lot"],
    },
    {
        "symptom": "high fever with stiff neck",
        "severity": "high",
        "requires_emergency": True,
        "keywords": ["high fever", "stiff neck", "fever and neck", "neck stiffness"],
    },
    {
        "symptom": "severe abdominal pain",
        "severity": "high",
        "requires_emergency": True,
        "keywords": ["severe stomach pain", "abdominal pain severe", "belly pain severe", "intense abdominal"],
    },
    {
        "symptom": "allergic reaction",
        "severity": "high",
        "requires_emergency": True,
        "keywords": ["throat swelling", "tongue swelling", "anaphylaxis", "allergic reaction", "hives difficulty breathing"],
    },
    {
        "symptom": "high fever",
        "severity": "moderate",
        "requires_emergency": False,
        "keywords": ["high fever", "very high temperature", "fever 40", "fever 104"],
    },
    {
        "symptom": "vomiting blood",
        "severity": "high",
        "requires_emergency": True,
        "keywords": ["vomiting blood", "blood in vomit", "throwing up blood"],
    },
    {
        "symptom": "severe dehydration",
        "severity": "moderate",
        "requires_emergency": False,
        "keywords": ["can't keep water down", "severe dehydration", "not urinating"],
    },
]


def screen_red_flags(text: str) -> list[RedFlag]:
    """Screen patient text against the red flag database.

    Returns a list of RedFlag objects for any matched symptoms.
    Each symptom is matched at most once (first keyword match wins).
    """
    detected: list[RedFlag] = []
    text_lower = text.lower()
    seen_symptoms: set[str] = set()

    for flag in RED_FLAG_DATABASE:
        if flag["symptom"] in seen_symptoms:
            continue
        for keyword in flag["keywords"]:
            if keyword in text_lower:
                detected.append(
                    RedFlag(
                        symptom=flag["symptom"],
                        severity=flag["severity"],
                        description=f"Patient mentioned: '{keyword}'",
                        requires_emergency=flag["requires_emergency"],
                    )
                )
                seen_symptoms.add(flag["symptom"])
                break

    return detected


def is_crisis(text: str) -> bool:
    """Detect suicidal ideation or immediate self-harm intent."""
    crisis_keywords = [
        "want to die", "kill myself", "end my life",
        "suicide", "self-harm", "hurt myself",
    ]
    text_lower = text.lower()
    return any(kw in text_lower for kw in crisis_keywords)
