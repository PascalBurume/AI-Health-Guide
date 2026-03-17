"""Language detection wrapper using the lingua library."""

from lingua import Language, LanguageDetectorBuilder

# Build a detector for the supported languages only (faster + more accurate than all-language).
_SUPPORTED = [
    Language.ENGLISH,
    Language.FRENCH,
    Language.JAPANESE,
    Language.ARABIC,
    Language.SWAHILI,
    Language.SPANISH,
    Language.GERMAN,  # included to give the detector better contrast
]

_detector = LanguageDetectorBuilder.from_languages(*_SUPPORTED).build()

# ISO 639-1 code mapping
_LINGUA_TO_ISO: dict[Language, str] = {
    Language.ENGLISH:  "en",
    Language.FRENCH:   "fr",
    Language.JAPANESE: "ja",
    Language.ARABIC:   "ar",
    Language.SWAHILI:  "sw",
    Language.SPANISH:  "es",
}


def detect_language(text: str) -> str:
    """Detect the language of the given text and return an ISO 639-1 code.

    Falls back to "en" if detection fails or the language is unsupported.
    """
    detected = _detector.detect_language_of(text)
    if detected is None:
        return "en"
    return _LINGUA_TO_ISO.get(detected, "en")
