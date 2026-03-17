"""Disclaimer presence validator for patient-facing output."""

REQUIRED_DISCLAIMERS = [
    "not a medical diagnosis",
    "consult a qualified healthcare professional",
]


def has_disclaimer(text: str) -> bool:
    """Return True if the text contains all required disclaimer phrases."""
    text_lower = text.lower()
    return all(d in text_lower for d in REQUIRED_DISCLAIMERS)


def append_disclaimer(text: str, language: str = "en") -> str:
    """Append the standard disclaimer to any patient-facing text if not already present."""
    disclaimers = {
        "en": "\n\n⚕️ This is NOT a medical diagnosis. Please consult a qualified healthcare professional.",
        "fr": "\n\n⚕️ Ceci n'est PAS un diagnostic médical. Veuillez consulter un professionnel de santé qualifié.",
        "ja": "\n\n⚕️ これは医学的診断ではありません。資格のある医療専門家に相談してください。",
        "ar": "\n\n⚕️ هذا ليس تشخيصاً طبياً. يرجى استشارة متخصص رعاية صحية مؤهل.",
        "sw": "\n\n⚕️ Hii si utambuzi wa kimatibabu. Tafadhali wasiliana na mtaalamu wa afya aliyehitimu.",
        "es": "\n\n⚕️ Esto NO es un diagnóstico médico. Por favor consulte a un profesional de salud calificado.",
    }
    if has_disclaimer(text):
        return text
    disclaimer = disclaimers.get(language, disclaimers["en"])
    return text + disclaimer
