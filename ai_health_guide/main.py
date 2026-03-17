"""FastAPI application — AI Health Guide backend."""

import base64
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ai_health_guide.config import AppConfig
from ai_health_guide.clients.medgemma_client import MedGemmaClient
from ai_health_guide.clients.redis_client import RedisSessionClient
from ai_health_guide.clients.voice_input import VoiceInputHandler
from ai_health_guide.clients.voice_output import VoiceOutputHandler
from ai_health_guide.models.session import SessionState
from ai_health_guide.orchestrator import SessionOrchestrator

# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
config: AppConfig = AppConfig()
redis: RedisSessionClient | None = None
medgemma_client: MedGemmaClient | None = None
orchestrator: SessionOrchestrator | None = None
voice_in: VoiceInputHandler | None = None
voice_out: VoiceOutputHandler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis, medgemma_client, orchestrator, voice_in, voice_out

    redis = RedisSessionClient(config.redis_url, config.redis_password)
    medgemma = MedGemmaClient(config)
    medgemma_client = medgemma
    orchestrator = SessionOrchestrator(medgemma, config)

    # Voice features require an OpenAI key
    openai_client = None
    if config.openai_api_key:
        from openai import AsyncOpenAI
        openai_client = AsyncOpenAI(api_key=config.openai_api_key)

    voice_in = VoiceInputHandler(openai_client, config.whisper_model)
    voice_out = VoiceOutputHandler(openai_client, config.tts_model, config.tts_voice)

    print(f"[startup] model={config.medgemma_model_name}  ollama={config.medgemma_ollama_base_url}")
    available = await medgemma.is_available()
    print(f"[startup] Ollama model available: {available}")

    yield  # app running

    print("[shutdown] cleaning up")


app = FastAPI(title="AI Health Guide", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    language: str = "en"


class CreateSessionResponse(BaseModel):
    session_id: str


class SendMessageRequest(BaseModel):
    content: str
    language: str | None = None


class UpdateLanguageRequest(BaseModel):
    language: str


class TranslateReportRequest(BaseModel):
    language: str


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ERROR] Unhandled exception: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    redis_ok = await redis.ping() if redis else False
    ollama_ok = await medgemma_client.is_available() if medgemma_client else False
    return {"status": "ok", "redis": redis_ok, "ollama": ollama_ok}


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@app.post("/api/v1/sessions", response_model=CreateSessionResponse)
@limiter.limit("20/minute")
async def create_session(request: Request, body: CreateSessionRequest):
    session = SessionState(patient_language=body.language, clinical_language=config.default_clinical_language)
    await redis.save(session)
    return CreateSessionResponse(session_id=session.session_id)


@app.get("/api/v1/sessions/{session_id}")
async def get_session(session_id: str):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found or expired")
    return session.model_dump(mode="json")


@app.patch("/api/v1/sessions/{session_id}/language")
async def update_language(session_id: str, body: UpdateLanguageRequest):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if body.language in config.supported_languages:
        session.patient_language = body.language
        await redis.save(session)
    return session.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@app.post("/api/v1/sessions/{session_id}/messages")
async def send_message(session_id: str, body: SendMessageRequest):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    # Sync language if the frontend sends one
    if body.language and body.language in config.supported_languages:
        session.patient_language = body.language
    try:
        session = await orchestrator.process_message(session, body.content)
        await redis.save(session)
    except Exception as exc:
        print(f"[send_message] error: {exc}")
        raise HTTPException(500, "Failed to process message")
    return session.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Voice
# ---------------------------------------------------------------------------

@app.post("/api/v1/sessions/{session_id}/voice")
async def voice_message(session_id: str, audio: UploadFile = File(...)):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not voice_in:
        raise HTTPException(501, "Voice features not configured")

    audio_bytes = await audio.read()
    text = await voice_in.transcribe(
        audio_bytes,
        filename=audio.filename or "audio.webm",
        language_hint=session.patient_language,
    )

    session = await orchestrator.process_message(session, text)
    await redis.save(session)
    return session.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Image upload
# ---------------------------------------------------------------------------

@app.post("/api/v1/sessions/{session_id}/image")
async def upload_image(session_id: str, image: UploadFile = File(...)):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    image_bytes = await image.read()
    session.image_data = base64.b64encode(image_bytes).decode("utf-8")
    await redis.save(session)

    # If questioning is complete, trigger visual + triage pipeline
    if session.questioning_complete:
        session = await orchestrator.process_image_and_continue(session)
        await redis.save(session)

    return session.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

@app.get("/api/v1/sessions/{session_id}/report")
async def get_report(session_id: str):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    return {
        "patient_report": session.patient_report.model_dump() if session.patient_report else None,
        "clinician_report": session.clinician_report.model_dump() if session.clinician_report else None,
        "triage": session.triage.model_dump() if session.triage else None,
    }


# ---------------------------------------------------------------------------
# Report TTS
# ---------------------------------------------------------------------------

from fastapi.responses import StreamingResponse


@app.get("/api/v1/sessions/{session_id}/report/tts")
async def report_tts(session_id: str):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not voice_out:
        raise HTTPException(501, "TTS not configured")

    # Build TTS text: use the full patient report if available, otherwise triage info
    if session.patient_report:
        parts = [
            session.patient_report.summary,
            session.patient_report.what_we_found,
            session.patient_report.what_to_do_next,
            session.patient_report.what_to_tell_doctor,
        ]
        text = "\n\n".join(p for p in parts if p)
    elif session.triage:
        text = f"{session.triage.urgency_description}. {session.triage.rationale}"
    else:
        raise HTTPException(400, "No triage or report available yet")

    audio_bytes = await voice_out.synthesize(text)
    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=report.mp3"},
    )


# ---------------------------------------------------------------------------
# Report Translation
# ---------------------------------------------------------------------------

LANGUAGE_NAMES: dict[str, str] = {
    "en": "English", "fr": "French", "es": "Spanish",
    "ar": "Arabic", "ja": "Japanese", "sw": "Swahili",
}


@app.post("/api/v1/sessions/{session_id}/report/translate")
async def translate_report(session_id: str, body: TranslateReportRequest):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.patient_report:
        raise HTTPException(400, "No patient report to translate")
    if body.language not in config.supported_languages:
        raise HTTPException(400, f"Unsupported language: {body.language}")

    from ai_health_guide.clients.openai_client import OpenAIReportClient
    openai_report = OpenAIReportClient(config)

    target_lang = LANGUAGE_NAMES.get(body.language, body.language)
    report = session.patient_report

    prompt = f"""Translate the following medical consultation report into {target_lang}.
Keep the same structure and meaning. Use simple, non-clinical language appropriate for a patient.
Do NOT add or remove any medical information.

=== ORIGINAL REPORT ===
Summary: {report.summary}

What we found: {report.what_we_found}

What to do next: {report.what_to_do_next}

Facility recommendation: {report.facility_recommendation}

Directions summary: {report.directions_summary}

What to tell the doctor: {report.what_to_tell_doctor}

=== INSTRUCTIONS ===
Return a JSON object with the translated fields:
{{
  "summary": "<translated summary>",
  "what_we_found": "<translated>",
  "what_to_do_next": "<translated>",
  "facility_recommendation": "<translated>",
  "directions_summary": "<translated>",
  "what_to_tell_doctor": "<translated>",
  "disclaimer": "<translated disclaimer>"
}}
Write entirely in {target_lang}. Return ONLY the JSON object."""

    raw = await openai_report.generate([{"role": "system", "content": prompt}])

    import json, re
    raw = re.sub(r"```(?:json)?\s*", "", raw)
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            translated = json.loads(match.group())
            translated["language"] = body.language
            return translated
        except json.JSONDecodeError:
            pass

    raise HTTPException(500, "Translation failed — could not parse response")


# ---------------------------------------------------------------------------
# Translated Report TTS
# ---------------------------------------------------------------------------


class TranslatedTTSRequest(BaseModel):
    text: str


@app.post("/api/v1/sessions/{session_id}/report/translate/tts")
async def translated_report_tts(session_id: str, body: TranslatedTTSRequest):
    session = await redis.load(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not voice_out:
        raise HTTPException(501, "TTS not configured")
    if not body.text.strip():
        raise HTTPException(400, "No text to synthesize")

    audio_bytes = await voice_out.synthesize(body.text)
    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=translated-report.mp3"},
    )
