from pydantic_settings import BaseSettings


class AppConfig(BaseSettings):
    """Application configuration — loaded from environment variables."""

    # MedGemma via Ollama — clinical reasoning, translation, reporting
    # Set MEDGEMMA_MODEL_NAME to the exact tag shown in `ollama list`
    medgemma_model_name: str = "MedAIBase/MedGemma1.0:4b"
    medgemma_ollama_base_url: str = "http://localhost:11434"
    medgemma_max_tokens: int = 4096
    medgemma_temperature: float = 0.3  # Low temperature for clinical precision
    # Kept for backwards compat — unused when Ollama backend is active
    medgemma_model_path: str = ""
    medgemma_device: str = "cpu"

    # OpenAI (cloud) — voice features + report generation
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"
    tts_model: str = "tts-1"
    tts_voice: str = "nova"
    openai_report_model: str = "gpt-4o"

    # Google Maps
    google_maps_api_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"
    redis_password: str = ""

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Session limits
    max_questioning_turns: int = 10
    max_session_duration_minutes: int = 30

    # Supported languages
    supported_languages: list[str] = ["en", "fr", "ja", "ar", "sw", "es"]
    default_clinical_language: str = "en"

    class Config:
        env_file = ".env"
