# AI Health Guide — Project Blueprint

**Clinical Reasoning | Care Navigation | Multilingual Accessibility**

---

## 1. Problem Statement

Clinics lose time before the doctor enters the room. Patients arrive with unstructured complaints, incomplete histories, and no prioritization. For foreign patients, language barriers don't just slow intake — they distort it. A patient who cannot accurately describe their symptoms in the local language may receive the wrong priority, the wrong referral, or no care at all.

**AI Health Guide** is a pre-consultation AI agent that conducts a structured clinical interview, interprets symptoms and images, navigates the patient to the right facility, and delivers a multilingual pre-diagnostic report so that neither the patient nor the clinician is lost in translation.

---

## 2. Architecture: Pipeline-Orchestrator Hybrid

The system uses a **Pipeline** backbone (five sequential clinical stages) with an embedded **Orchestrator** for parallel tasks (dual report generation) and a cross-cutting **Safety Guardian** that validates every stage boundary.

```
Patient Input
     |
     v
[1. Language Detection + Symptom Intake]
     |
     v -- Safety Guardian check
[2. Clinical Questioning (ABCDE + Red Flags)]  <--> Patient (multi-turn)
     |
     v -- Safety Guardian check
[3. Visual Interpretation]  (skipped if no image)
     |
     v -- Safety Guardian check
[4. Triage Classification]
     |
     v -- Safety Guardian check
[5. Care Navigation (Google Maps)]
     |
     v
[6a. Patient Report] || [6b. Clinician Report]  (parallel)
     |
     v -- Safety Guardian final check
[Session Complete — Deliver Reports]
```

---

## 3. Agent Inventory (9 Agents)

### Agent 1: Session Orchestrator

| Field | Value |
|-------|-------|
| **Role** | Central coordinator — drives pipeline, manages session state, decides stage transitions |
| **Model** | `medgemma-1.0:4b` via Ollama (local) |
| **Inputs** | Raw patient messages (text, images, language preference) |
| **Outputs** | Final assembled session with all intermediate artifacts |
| **Tools** | `advance_stage`, `get_session_state`, `update_session_state`, `call_sub_agent` |

```python
class SessionOrchestrator:
    """Drives the five-stage clinical pipeline."""

    def __init__(self, medgemma_client: MedGemmaClient, openai_client: AsyncOpenAI, config: AppConfig):
        self.medgemma = medgemma_client  # Local MedGemma 1.0:4b via Ollama for clinical reasoning
        self.openai = openai_client      # OpenAI for voice features
        self.config = config
        self.agents: dict[str, BaseAgent] = {}
        self.safety_guardian: SafetyGuardian = SafetyGuardian(client, config)

    async def run_session(self, session: SessionState) -> FinalReport:
        """Execute the full pipeline for a patient session."""
        ...

    async def _run_stage(self, agent: BaseAgent, session: SessionState) -> SessionState:
        """Run a single stage and validate with Safety Guardian."""
        result = await agent.execute(session)
        safety_check = await self.safety_guardian.validate(session, result)
        if not safety_check.approved:
            result = await agent.execute(session, corrections=safety_check.issues)
        return self._merge_state(session, result)

    async def _run_parallel_reports(self, session: SessionState) -> SessionState:
        """Generate patient and clinician reports in parallel."""
        patient_task = self.agents["patient_report"].execute(session)
        clinician_task = self.agents["clinician_report"].execute(session)
        patient_result, clinician_result = await asyncio.gather(patient_task, clinician_task)
        ...
```

---

### Agent 2: Language + Intake Agent

| Field | Value |
|-------|-------|
| **Role** | Detects patient language, collects chief complaint |
| **Model** | `medgemma-1.0:4b` via Ollama (local) — translation + intake |
| **Inputs** | Raw patient text (first message) |
| **Outputs** | `detected_language`, `chief_complaint`, `chief_complaint_english` |
| **Tools** | `detect_language` (lingua library) |

```python
class IntakeAgent(BaseAgent):
    """Detects language and collects the chief complaint."""

    stage = Stage.INTAKE

    SYSTEM_PROMPT = """You are a healthcare intake assistant. Your tasks:
    1. Greet the patient warmly in their detected language.
    2. Ask them to describe their primary health concern.
    3. Confirm you understood correctly by summarizing back to them.
    4. Extract a concise chief complaint in both the patient's language and English.

    Rules:
    - Never use diagnostic language ("you have", "this is").
    - Use simple, reassuring language.
    - If language detection is uncertain, ask the patient to confirm their preferred language.
    """

    async def execute(self, session: SessionState) -> dict:
        detected_lang = detect_language(session.conversation_history[-1].content)
        session.patient_language = detected_lang

        response = await self.client.chat.completions.create(
            model=self.config.intake_model,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                *self._format_history(session),
            ],
        )
        ...
```

---

### Agent 3: Clinical Questioning Agent

| Field | Value |
|-------|-------|
| **Role** | Multi-turn interview using ABCDE protocol and red flag screening |
| **Model** | `medgemma-1.0:4b` via Ollama (local) — clinical reasoning |
| **Inputs** | `chief_complaint`, `detected_language`, `session_history` |
| **Outputs** | `structured_symptoms`, `abcde_assessment`, `red_flags`, `severity`, `questioning_complete` |
| **Tools** | `abcde_protocol_checklist`, `red_flag_screener`, `severity_scale` |

```python
class ClinicalQuestioningAgent(BaseAgent):
    """Conducts structured clinical interview using ABCDE protocol."""

    stage = Stage.QUESTIONING
    MAX_TURNS = 15

    SYSTEM_PROMPT = """You are a clinical intake specialist. Conduct a structured interview in {patient_language}.

    Protocol:
    1. ABCDE Assessment (Airway, Breathing, Circulation, Disability, Exposure)
       - Ask relevant questions based on the chief complaint.
       - Not all categories apply to every case — use clinical judgment.
    2. Red Flag Screening — probe for:
       - Chest pain, shortness of breath, sudden severe headache
       - Neurological symptoms (weakness, vision changes, speech difficulty)
       - Signs of infection (high fever, stiff neck, rash)
       - Severe abdominal pain, bleeding, loss of consciousness
    3. Timeline: onset, duration, progression, triggers, alleviating factors
    4. Severity: ask patient to rate 1-10
    5. Associated symptoms: ask about related complaints

    Rules:
    - Communicate entirely in {patient_language}.
    - Ask ONE focused question at a time.
    - Never diagnose. Use "I want to understand more about..." framing.
    - If a red flag is detected, note it but continue the interview calmly.
    - Mark questioning_complete=true when you have sufficient information for triage.
    """

    async def execute(self, session: SessionState) -> dict:
        """Run multi-turn questioning loop."""
        ...

    def _check_completeness(self, session: SessionState) -> bool:
        """Determine if enough information has been gathered."""
        has_chief_complaint = bool(session.chief_complaint)
        has_severity = session.severity > 0
        has_duration = "duration" in session.structured_symptoms
        min_turns = session.questioning_turns >= 3
        return all([has_chief_complaint, has_severity, has_duration, min_turns])
```

---

### Agent 4: Visual Interpretation Agent

| Field | Value |
|-------|-------|
| **Role** | Analyzes uploaded symptom photos — describes, does not diagnose |
| **Model** | `medgemma-1.0:4b` via Ollama (local, multimodal) — medical image understanding |
| **Inputs** | `image_data` (base64), `chief_complaint`, `structured_symptoms` |
| **Outputs** | `visual_observations`, `consistency_with_symptoms`, `image_description_for_report` |
| **Tools** | None (uses multimodal LLM directly) |

```python
class VisualInterpretationAgent(BaseAgent):
    """Analyzes patient-uploaded symptom images."""

    stage = Stage.VISUAL

    SYSTEM_PROMPT = """You are a medical image description assistant. You DESCRIBE what is visible. You NEVER diagnose.

    For the uploaded image, provide:
    1. Description: color, size, shape, texture, location on body
    2. Consistency: does the visual match the patient's described symptoms?
    3. Additional observations: anything notable not mentioned by patient
    4. Quality note: is the image clear enough for useful observation?

    Language rules:
    - ALLOWED: "The image shows a raised, reddish area approximately 3cm in diameter on the forearm."
    - ALLOWED: "This appearance is sometimes associated with [X] and should be evaluated by a professional."
    - FORBIDDEN: "This is [condition]." / "You have [diagnosis]."
    - FORBIDDEN: Any definitive diagnostic statement.
    """

    async def execute(self, session: SessionState) -> dict:
        if not session.image_data:
            return {"image_analyzed": False, "visual_observations": []}

        response = await self.medgemma.generate(
            prompt=self.SYSTEM_PROMPT,
            context=f"Chief complaint: {session.chief_complaint}\nSymptoms: {session.structured_symptoms}",
            image=session.image_data,  # base64 image passed to MedGemma multimodal
        )
        ...
```

---

### Agent 5: Triage Classification Agent

| Field | Value |
|-------|-------|
| **Role** | Assigns RED/YELLOW/GREEN triage using deterministic matrix + LLM rationale |
| **Model** | `medgemma-1.0:4b` via Ollama (local) — rationale only, color is deterministic |
| **Inputs** | `structured_symptoms`, `red_flags`, `abcde_assessment`, `visual_observations`, `severity` |
| **Outputs** | `TriageResult` (color, rationale, facility_type_needed, urgency_description) |
| **Tools** | `triage_decision_matrix` (deterministic, rule-based) |

```python
class TriageClassificationAgent(BaseAgent):
    """Synthesizes clinical data into a triage classification."""

    stage = Stage.TRIAGE

    async def execute(self, session: SessionState) -> dict:
        # Step 1: Deterministic triage (authoritative)
        triage_color = triage_decision_matrix(
            red_flags=session.red_flags,
            severity=session.severity,
            visual_concerns=session.visual_observations,
        )

        # Step 2: LLM generates human-readable rationale
        rationale = await self._generate_rationale(session, triage_color)

        # Step 3: Map triage to facility type
        facility_type = self._map_facility_type(triage_color)

        return {
            "triage": TriageResult(
                color=triage_color,
                rationale=rationale,
                facility_type_needed=facility_type,
                urgency_description=self._urgency_text(triage_color),
                determined_by="rule_matrix",
            )
        }
```

---

### Agent 6: Care Navigation Agent

| Field | Value |
|-------|-------|
| **Role** | Finds appropriate nearby facilities using Google Maps |
| **Model** | `medgemma-1.0:4b` via Ollama (local) — facility selection logic |
| **Inputs** | `triage_color`, `facility_type_needed`, `patient_location` |
| **Outputs** | `facilities` (ranked list), `directions` to top facility, `map_url` |
| **Tools** | `google_places_search`, `google_directions`, `facility_filter` |

```python
class CareNavigationAgent(BaseAgent):
    """Locates appropriate nearby healthcare facilities via Google Maps."""

    stage = Stage.NAVIGATION

    # Triage-based search configuration
    SEARCH_CONFIG = {
        TriageColor.RED: {"types": ["hospital"], "keyword": "emergency", "radius": 5000},
        TriageColor.YELLOW: {"types": ["hospital", "doctor"], "keyword": "urgent care", "radius": 10000},
        TriageColor.GREEN: {"types": ["doctor", "pharmacy"], "keyword": "clinic", "radius": 15000},
    }

    async def execute(self, session: SessionState) -> dict:
        if not session.patient_location:
            return {"facilities": [], "directions": None}

        config = self.SEARCH_CONFIG[session.triage.color]
        raw_results = await self.maps_client.places_nearby(
            location=(session.patient_location.latitude, session.patient_location.longitude),
            radius=config["radius"],
            type=config["types"][0],
            keyword=config["keyword"],
            open_now=True,
        )

        # Fallback: if open_now=True returns no results, retry without the filter
        if not raw_results:
            raw_results = await self.maps_client.places_nearby(
                location=(session.patient_location.latitude, session.patient_location.longitude),
                radius=config["radius"],
                type=config["types"][0],
                keyword=config["keyword"],
            )

        facilities = self._rank_facilities(raw_results, session.patient_location)
        directions = await self._get_directions(session.patient_location, facilities[0])

        return {"facilities": facilities, "directions": directions}

    def _rank_facilities(self, raw: list, origin: Location) -> list[Facility]:
        """Rank by composite score: 0.6 * proximity + 0.3 * rating + 0.1 * open status."""
        ...
```

---

### Agent 7: Patient Report Agent

| Field | Value |
|-------|-------|
| **Role** | Generates plain-language report in patient's language |
| **Model** | **OpenAI GPT-4o** (cloud) — full conversation transcript aware |
| **Inputs** | Full `SessionState` including complete conversation transcript |
| **Outputs** | `PatientReport` in `patient_language` |

```python
class PatientReportAgent(BaseAgent):
    """Generates patient-facing report using GPT-4o with full conversation context."""

    stage = Stage.REPORT

    SYSTEM_PROMPT = """Generate a clear, reassuring health summary in {patient_language}.

    Structure:
    1. SUMMARY — What you told us and what we observed
    2. WHAT WE FOUND — Clinical observations in plain language
    3. WHAT TO DO NEXT — Clear action steps
    4. WHERE TO GO — Facility recommendation based on triage
    5. WHAT TO TELL THE DOCTOR — Prepared talking points for the visit

    Rules:
    - Use simple, non-clinical language. No medical jargon.
    - Be reassuring but honest about urgency.
    - Always include the standard disclaimer at the end.
    - Base the report on the FULL conversation transcript, not just extracted fields.
    """

    async def execute(self, session: SessionState) -> dict:
        ...
```

---

### Agent 8: Clinician Report Agent

| Field | Value |
|-------|-------|
| **Role** | Generates structured SOAP note in clinical language |
| **Model** | **OpenAI GPT-4o** (cloud) — full conversation transcript aware |
| **Inputs** | Full `SessionState` including complete conversation transcript |
| **Outputs** | `SOAPNote` in `clinical_language` |

```python
class ClinicianReportAgent(BaseAgent):
    """Generates clinician-facing SOAP note."""

    stage = Stage.REPORT

    SYSTEM_PROMPT = """Generate a structured SOAP note in {clinical_language} for the receiving clinician.

    Format:
    S (Subjective): Chief complaint in patient's own words, HPI, symptom timeline, severity rating.
    O (Objective): Visual findings from uploaded images (if any), observations from structured interview.
    A (Assessment): Triage classification with rationale, red flags detected, differential considerations.
    P (Plan): Recommended facility, urgency level, suggested next steps for clinician.

    Include:
    - Patient's preferred language (for interpreter needs)
    - Triage color prominently displayed
    - All red flags clearly listed
    """

    async def execute(self, session: SessionState) -> dict:
        ...
```

---

### Agent 9: Safety Guardian

| Field | Value |
|-------|-------|
| **Role** | Cross-cutting validator — checks every stage output |
| **Model** | `medgemma-1.0:4b` via Ollama (local) — safety validation |
| **Inputs** | Stage output + current `SessionState` |
| **Outputs** | `SafetyCheckResult` (approved/issues/corrective_action) |
| **Tools** | `disclaimer_checker`, `red_flag_validator`, `diagnostic_language_detector` |

```python
class SafetyGuardian(BaseAgent):
    """Validates agent outputs for safety compliance."""

    # Patterns that must NEVER appear in patient-facing output
    # Note: "you have" is narrowed to avoid blocking conversational phrasing
    FORBIDDEN_PATTERNS = [
        r"you have \w+ (?:disease|syndrome|disorder|infection|condition)",
        r"this is \w+ disease",
        r"you are suffering from",
        r"diagnosis:\s*\w+",
        r"you definitely have",
    ]

    def _extract_patient_facing_text(self, stage_output: dict) -> list[str]:
        """Extract only patient-facing text fields for safety validation.
        Clinician SOAP text is excluded — clinical language is intentional."""
        ...

    # Patterns that MUST appear in patient-facing output
    REQUIRED_DISCLAIMERS = [
        "not a medical diagnosis",
        "consult a qualified healthcare professional",
    ]

    async def validate(self, session: SessionState, stage_output: dict) -> SafetyCheckResult:
        issues = []

        # Check 1: Diagnostic language prohibition
        for text_field in self._extract_text_fields(stage_output):
            for pattern in self.FORBIDDEN_PATTERNS:
                if re.search(pattern, text_field, re.IGNORECASE):
                    issues.append(f"Diagnostic language detected: '{pattern}' in output")

        # Check 2: Red flag escalation guarantee
        if session.red_flags and session.current_stage == Stage.TRIAGE:
            if stage_output.get("triage", {}).get("color") != TriageColor.RED:
                issues.append("Red flags detected but triage is not RED — escalation required")

        # Check 3: Disclaimer enforcement (report stage only)
        if session.current_stage == Stage.REPORT:
            report_text = stage_output.get("patient_report", "")
            for disclaimer in self.REQUIRED_DISCLAIMERS:
                if disclaimer.lower() not in report_text.lower():
                    issues.append(f"Missing required disclaimer: '{disclaimer}'")

        # Check 4: Crisis detection
        if self._detect_crisis(session):
            issues.append("CRISIS DETECTED: Patient may need immediate mental health support")

        return SafetyCheckResult(
            approved=len(issues) == 0,
            issues=issues,
            corrective_action=self._suggest_corrections(issues) if issues else "",
        )
```

---

## 4. Data Models

### Session State

```python
from enum import Enum
from datetime import datetime
from typing import Optional, Literal
from uuid import uuid4
from pydantic import BaseModel, Field


class Stage(str, Enum):
    INTAKE = "intake"
    QUESTIONING = "questioning"
    VISUAL = "visual"
    TRIAGE = "triage"
    NAVIGATION = "navigation"
    REPORT = "report"
    COMPLETE = "complete"


class Message(BaseModel):
    role: Literal["patient", "agent", "system"]
    content: str
    language: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_name: Optional[str] = None
    image_id: Optional[str] = None


class SessionState(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    current_stage: Stage = Stage.INTAKE
    patient_language: str = "en"
    clinical_language: str = "en"
    conversation_history: list[Message] = []

    # Intake
    chief_complaint: str = ""
    chief_complaint_english: str = ""

    # Questioning
    structured_symptoms: dict = {}
    abcde_assessment: Optional["ABCDEAssessment"] = None
    red_flags: list["RedFlag"] = []
    severity: int = 0
    questioning_turns: int = 0
    questioning_complete: bool = False

    # Visual
    image_data: Optional[str] = None  # base64
    visual_observations: list[str] = []
    image_analyzed: bool = False

    # Triage
    triage: Optional["TriageResult"] = None

    # Navigation
    patient_location: Optional["Location"] = None
    facilities: list["Facility"] = []
    directions: Optional[dict] = None

    # Reports
    patient_report: str = ""
    clinician_report: Optional["SOAPNote"] = None

    # Safety
    safety_checks: list["SafetyCheckResult"] = []
    disclaimers_verified: bool = False
```

### Clinical Models

```python
class TriageColor(str, Enum):
    RED = "RED"        # Emergency — go to ED now
    YELLOW = "YELLOW"  # Urgent — see provider within 24h
    GREEN = "GREEN"    # Non-urgent — schedule appointment


class RedFlag(BaseModel):
    symptom: str
    severity: Literal["critical", "high", "moderate"]
    description: str
    requires_emergency: bool


class ABCDEAssessment(BaseModel):
    airway: Optional[str] = None
    breathing: Optional[str] = None
    circulation: Optional[str] = None
    disability: Optional[str] = None
    exposure: Optional[str] = None
    notes: str = ""


class TriageResult(BaseModel):
    color: TriageColor
    rationale: str
    facility_type_needed: str  # "emergency_department", "urgent_care", "clinic", "pharmacy"
    urgency_description: str
    determined_by: Literal["rule_matrix", "llm_override"] = "rule_matrix"
```

### Report Models

```python
class SOAPNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    triage_color: TriageColor
    red_flags_summary: list[str]
    language: str
    patient_language: str  # For clinician reference


class PatientReport(BaseModel):
    summary: str
    what_we_found: str
    what_to_do_next: str
    facility_recommendation: str
    directions_summary: str
    what_to_tell_doctor: str
    disclaimer: str
    language: str


class FinalReport(BaseModel):
    session_id: str
    patient_report: PatientReport
    clinician_report: SOAPNote
    triage: TriageResult
    facilities: list["Facility"]
    session_duration_seconds: int
    safety_checks_passed: bool
```

### Location and Facility Models

```python
class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


class Facility(BaseModel):
    name: str
    place_id: str
    address: str
    location: Location
    facility_type: str
    distance_meters: float
    duration_minutes: float
    is_open: bool
    rating: Optional[float] = None
    phone: Optional[str] = None
```

### Safety Models

```python
class SafetyCheckResult(BaseModel):
    stage: Stage
    approved: bool
    issues: list[str] = []
    corrective_action: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

---

## 5. Base Agent Interface

```python
from abc import ABC, abstractmethod
from openai import AsyncOpenAI


class BaseAgent(ABC):
    """Abstract base class for all AI Health Guide agents."""

    stage: Stage  # Which pipeline stage this agent handles

    def __init__(self, medgemma: "MedGemmaClient", config: "AppConfig"):
        self.medgemma = medgemma  # Local MedGemma 1.0:4b via Ollama for clinical reasoning + translation
        self.config = config

    @abstractmethod
    async def execute(self, session: SessionState, corrections: list[str] | None = None) -> dict:
        """Execute the agent's task and return a partial state update.

        Args:
            session: Current session state (read-only).
            corrections: Safety Guardian feedback to address (if re-running).

        Returns:
            Dictionary of SessionState fields to update.
        """
        ...

    def _format_history(self, session: SessionState) -> list[dict]:
        """Convert session history to OpenAI message format."""
        return [
            {"role": "user" if m.role == "patient" else "assistant", "content": m.content}
            for m in session.conversation_history
        ]
```

---

## 6. Deterministic Tools

### Triage Decision Matrix

```python
def triage_decision_matrix(
    red_flags: list[RedFlag],
    severity: int,
    visual_concerns: list[str],
) -> TriageColor:
    """Deterministic triage classification. This is the AUTHORITATIVE source — not the LLM.

    Rules:
    - Any critical red flag -> RED
    - Any high red flag OR severity >= 7 -> RED
    - Moderate red flag OR severity 5-6 OR concerning visual findings -> YELLOW
    - No red flags AND severity 1-4 AND no visual concerns -> GREEN
    """
    critical_flags = [f for f in red_flags if f.severity == "critical"]
    high_flags = [f for f in red_flags if f.severity == "high"]
    moderate_flags = [f for f in red_flags if f.severity == "moderate"]

    if critical_flags or high_flags or severity >= 7:
        return TriageColor.RED
    if moderate_flags or 5 <= severity <= 6 or len(visual_concerns) > 0:
        return TriageColor.YELLOW
    return TriageColor.GREEN
```

### Red Flag Database

```python
RED_FLAG_DATABASE: list[dict] = [
    {"symptom": "chest pain", "severity": "critical", "requires_emergency": True,
     "keywords": ["chest pain", "chest pressure", "chest tightness"]},
    {"symptom": "difficulty breathing", "severity": "critical", "requires_emergency": True,
     "keywords": ["can't breathe", "shortness of breath", "breathing difficulty"]},
    {"symptom": "sudden severe headache", "severity": "critical", "requires_emergency": True,
     "keywords": ["worst headache", "thunderclap headache", "sudden headache"]},
    {"symptom": "stroke symptoms", "severity": "critical", "requires_emergency": True,
     "keywords": ["face drooping", "arm weakness", "speech difficulty", "sudden numbness"]},
    {"symptom": "loss of consciousness", "severity": "critical", "requires_emergency": True,
     "keywords": ["passed out", "fainted", "lost consciousness", "blacked out"]},
    {"symptom": "severe bleeding", "severity": "high", "requires_emergency": True,
     "keywords": ["heavy bleeding", "won't stop bleeding", "blood loss"]},
    {"symptom": "high fever with stiff neck", "severity": "high", "requires_emergency": True,
     "keywords": ["high fever", "stiff neck", "fever and neck"]},
    {"symptom": "severe abdominal pain", "severity": "high", "requires_emergency": True,
     "keywords": ["severe stomach pain", "abdominal pain", "belly pain severe"]},
    {"symptom": "suicidal ideation", "severity": "critical", "requires_emergency": True,
     "keywords": ["want to die", "kill myself", "end my life", "suicide", "self-harm"]},
]


def screen_red_flags(text: str) -> list[RedFlag]:
    """Screen patient text against the red flag database."""
    detected = []
    text_lower = text.lower()
    for flag in RED_FLAG_DATABASE:
        for keyword in flag["keywords"]:
            if keyword in text_lower:
                detected.append(RedFlag(
                    symptom=flag["symptom"],
                    severity=flag["severity"],
                    description=f"Patient mentioned: '{keyword}'",
                    requires_emergency=flag["requires_emergency"],
                ))
                break
    return detected
```

---

## 7. Configuration

```python
from pydantic_settings import BaseSettings


class AppConfig(BaseSettings):
    """Application configuration — loaded from environment variables."""

    # MedGemma via Ollama — clinical reasoning, questioning, triage, image analysis
    # Set MEDGEMMA_MODEL_NAME to the exact tag shown in `ollama list`
    medgemma_model_name: str = "MedAIBase/MedGemma1.0:4b"
    medgemma_ollama_base_url: str = "http://localhost:11434"
    medgemma_max_tokens: int = 4096
    medgemma_temperature: float = 0.3  # Low temperature for clinical precision

    # OpenAI (cloud) — voice features + report generation + translation
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"       # Speech-to-text
    tts_model: str = "tts-1"              # Text-to-speech
    tts_voice: str = "nova"               # Voice style for TTS
    openai_report_model: str = "gpt-4o"   # GPT-4o for patient/clinician reports + translation

    # Redis session store
    redis_url: str = "redis://localhost:6379"
    redis_password: str = ""
    # SESSION_TTL is 7200 seconds (2 hours) — hardcoded in redis_client.py

    # Session limits
    max_questioning_turns: int = 10
    max_session_duration_minutes: int = 30

    # Supported languages
    supported_languages: list[str] = ["en", "fr", "ja", "ar", "sw", "es"]
    default_clinical_language: str = "en"

    class Config:
        env_file = ".env"
```

---

## 8. Project Structure

```
ai_health_guide/
    __init__.py
    main.py                         # FastAPI app, all API endpoints
    orchestrator.py                 # Session Orchestrator (Agent 1)
    config.py                       # AppConfig with env vars
    clients/
        __init__.py
        medgemma_client.py          # MedGemma via Ollama API wrapper
        openai_client.py            # OpenAIReportClient (GPT-4o) for reports + translation
        redis_client.py             # Redis session store (SESSION_TTL = 7200s)
        voice_input.py              # OpenAI Whisper speech-to-text
        voice_output.py             # OpenAI TTS text-to-speech
    agents/
        __init__.py
        base.py                     # BaseAgent ABC (uses MedGemma client)
        intake_agent.py             # Agent 2: Language + Intake
        questioning_agent.py        # Agent 3: Clinical Questioning
        visual_agent.py             # Agent 4: Visual Interpretation
        triage_agent.py             # Agent 5: Triage Classification
        navigation_agent.py         # Agent 6: Care Navigation (Google Maps)
        patient_report_agent.py     # Agent 7: Patient Report (GPT-4o)
        clinician_report_agent.py   # Agent 8: Clinician Report (GPT-4o)
        safety_guardian.py          # Agent 9: Safety Guardian
    tools/
        __init__.py
        language_detection.py       # lingua wrapper (en/fr/es/ar/ja/sw)
        abcde_protocol.py           # ABCDE checklist logic
        red_flag_screening.py       # Red flag database + matcher
        triage_matrix.py            # Deterministic triage rules
        google_maps.py              # Google Maps Places + Directions API wrapper (active)
        soap_formatter.py           # SOAP note enforcer
        disclaimer_checker.py       # Safety disclaimer validation
    models/
        __init__.py
        session.py                  # SessionState, Message, Stage
        clinical.py                 # TriageResult, ABCDEAssessment, RedFlag
        report.py                   # SOAPNote, PatientReport, FinalReport
        safety.py                   # SafetyCheckResult
    prompts/
        intake.txt
        questioning.txt
        visual.txt
        triage.txt
        navigation.txt
        patient_report.txt
        clinician_report.txt
        safety_guardian.txt
    tests/
        test_triage_matrix.py
        test_red_flags.py
        test_session_flow.py
        test_safety_guardian.py
        test_voice.py               # Voice input/output tests
        test_medgemma_client.py     # MedGemma/Ollama integration tests
```

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Python 3.11+ |
| Clinical LLM (local) | **MedGemma 1.0:4b via Ollama** — clinical reasoning, questioning, triage, image analysis |
| Report & Translation (cloud) | **OpenAI GPT-4o** — patient/clinician reports, report translation |
| Voice Features (cloud) | **OpenAI** — speech-to-text (Whisper-1), text-to-speech (TTS-1) |
| LLM Transport | Ollama REST API (`http://localhost:11434`) |
| Data Models | Pydantic v2 |
| Async | asyncio |
| Language Detection | lingua-language-detector |
| Session Store | Redis 7 (Docker), 2-hour TTL |
| Testing | pytest + pytest-asyncio |
| Config | pydantic-settings + .env |

### Model Responsibility Split

| Responsibility | Model | Location |
|---------------|-------|----------|
| Clinical reasoning (ABCDE, red flags) | MedGemma 1.0:4b | Local (Ollama) |
| Multi-turn questioning | MedGemma 1.0:4b | Local (Ollama) |
| Triage rationale | MedGemma 1.0:4b | Local (Ollama) |
| Medical image analysis | MedGemma 1.0:4b | Local (Ollama) |
| Safety validation | MedGemma 1.0:4b | Local (Ollama) |
| Patient report generation | OpenAI GPT-4o | Cloud API |
| Clinician SOAP note generation | OpenAI GPT-4o | Cloud API |
| Report translation (all 6 languages) | OpenAI GPT-4o | Cloud API |
| Speech-to-text (patient voice input) | OpenAI Whisper-1 | Cloud API |
| Text-to-speech (report + translated TTS) | OpenAI TTS-1 | Cloud API |

### Dependencies (requirements.txt)

```
# Core
fastapi>=0.110.0
uvicorn>=0.29.0
pydantic>=2.0.0
pydantic-settings>=2.0.0

# LLM + voice (OpenAI)
openai>=1.30.0
httpx>=0.27.0           # Ollama HTTP client

# Language detection
lingua-language-detector>=2.0.0

# Session store
redis>=5.0.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

---

## 10. Safety Guardrails

### 10.1 Deterministic Triage Backbone
The triage color is assigned by a **rule-based decision matrix**, not the LLM. The LLM only generates the human-readable rationale. This prevents hallucinated triage downgrades.

### 10.2 Diagnostic Language Prohibition
The Safety Guardian blocks all output containing diagnostic patterns ("you have X", "this is X disease"). Only observational language is allowed ("this may indicate", "should be evaluated for").

### 10.3 Mandatory Disclaimers
Every patient-facing output includes:
- "This is NOT a medical diagnosis."
- "Please consult a qualified healthcare professional."
- Emergency number guidance for RED triage cases.

### 10.4 Red Flag Escalation Guarantee
If any red flag is detected, the Safety Guardian verifies:
1. Triage is classified as RED
2. Patient report includes emergency guidance
3. Recommended facility is an emergency department

### 10.5 Crisis Detection
Self-harm or suicidal ideation triggers immediate crisis hotline referral, bypassing the normal pipeline flow.

### 10.6 Conversation Limits
- Maximum **10** questioning turns (prevents infinite loops)
- Maximum 30-minute session duration
- Sessions persist for **2 hours** in Redis before expiring
- All sessions logged for audit

---

## 11. Multilingual Implementation

| Level | How |
|-------|-----|
| **Detection** | `lingua` library detects language from first patient message (supports en/fr/es/ar/ja/sw) |
| **Language Sync** | `PATCH /api/v1/sessions/{id}/language` endpoint + optional `language` field on every message |
| **Interview** | MedGemma 1.0:4b system prompts instruct patient-facing agents to communicate in `patient_language` |
| **Patient Report** | Generated by GPT-4o with full conversation transcript, natively in `patient_language` |
| **Clinician Report** | Generated by GPT-4o with full conversation transcript, in `clinical_language` (default English) |
| **Chief Complaint** | Stored in both original language and English translation |
| **Voice Input** | OpenAI Whisper-1 transcribes spoken patient input in any supported language |
| **Voice Output** | OpenAI TTS-1 reads the patient report aloud in the patient's language |
| **Report Translation** | GPT-4o translates the full patient report to any of the 6 supported languages on demand |
| **Translated TTS** | Translated report text can also be read aloud via `POST /api/v1/sessions/{id}/report/translate/tts` |
| **Extensibility** | Adding a language = adding to `supported_languages` list in config |

Supported: English, French, Japanese, Arabic, Swahili, Spanish (extensible).

---

## 11.1 Voice Features (OpenAI)

Voice input/output uses OpenAI (cloud). Report generation and translation also use OpenAI GPT-4o. All clinical reasoning stays local on MedGemma 1.0:4b via Ollama.

### Speech-to-Text (Patient Voice Input)

```python
class VoiceInputHandler:
    """Transcribes patient voice input using OpenAI Whisper."""

    def __init__(self, openai_client: AsyncOpenAI, config: AppConfig):
        self.client = openai_client
        self.config = config

    async def transcribe(self, audio_file: bytes, language_hint: str | None = None) -> str:
        """Transcribe patient audio to text.

        Args:
            audio_file: Raw audio bytes (mp3, mp4, wav, webm supported).
            language_hint: Optional ISO-639-1 language code to improve accuracy.

        Returns:
            Transcribed text in the patient's language.
        """
        transcript = await self.client.audio.transcriptions.create(
            model=self.config.whisper_model,
            file=audio_file,
            language=language_hint,
        )
        return transcript.text
```

### Text-to-Speech (Patient Report Read-Aloud)

```python
class VoiceOutputHandler:
    """Converts patient report to speech using OpenAI TTS."""

    def __init__(self, openai_client: AsyncOpenAI, config: AppConfig):
        self.client = openai_client
        self.config = config

    async def synthesize(self, text: str) -> bytes:
        """Convert text to speech audio.

        Args:
            text: The patient report text to read aloud.

        Returns:
            Audio bytes (mp3 format).
        """
        response = await self.client.audio.speech.create(
            model=self.config.tts_model,
            voice=self.config.tts_voice,
            input=text,
        )
        return response.content
```

### Voice-Enabled Pipeline Flow

```
Patient speaks into microphone
         |
         v
[OpenAI Whisper] → transcribed text (cloud)
         |
         v
[Normal pipeline — MedGemma 1.0:4b via Ollama]
Intake → Questioning → Visual → Triage → Reports (GPT-4o)
         |
         v
Patient report text
         |
         v
[OpenAI TTS] → audio read-aloud (cloud)
         |
         v
Patient hears report in their language
```

---

## 11.2 Report Translation Feature

After the consultation report is generated, patients can request a translation of the patient report into any of the 6 supported languages.

### Translate Endpoint

`POST /api/v1/sessions/{session_id}/report/translate`

Request body: `{"language": "fr"}`

Response: JSON with all translated `PatientReport` fields + `language` code — generated by GPT-4o from the original report.

### Translated TTS Endpoint

`POST /api/v1/sessions/{session_id}/report/translate/tts`

Request body: `{"text": "<translated text to synthesize>"}`

Response: MP3 audio stream — the frontend concatenates the key translated fields and sends them as a single text payload.

### Translation Flow

```
Patient taps language button (e.g. "Français")
         |
         v
POST /report/translate {language: "fr"}
         |
         v
[GPT-4o] — translates all PatientReport fields into French
         |
         v
Translated cards displayed below original report
         |
         v
Patient taps 🔊 Listen  →  POST /report/translate/tts {text: "..."}
         |
         v
[OpenAI TTS-1] → MP3 audio in French
         |
         v
Patient taps ⬇️ Download PDF  →  TranslatedReportDocument (react-pdf)
         |
         v
PDF saved as health-report-fr.pdf
```

---

## 12. Implementation Phases

### Phase 1 — Foundation (Data Models + Deterministic Tools)
- `models/` — All Pydantic models
- `tools/triage_matrix.py` — Deterministic triage rules
- `tools/red_flag_screening.py` — Red flag database + matcher
- `tools/abcde_protocol.py` — ABCDE checklist logic
- `config.py` — AppConfig
- Unit tests for all deterministic tools

### Phase 2 — Core Agents (English-only Text Flow)
- `agents/base.py` — BaseAgent ABC
- `agents/intake_agent.py` — Language + Intake
- `agents/questioning_agent.py` — Clinical Questioning
- `orchestrator.py` — Session Orchestrator (stages 1-2)
- `main.py` — CLI entry point for testing

### Phase 3 — Visual + Triage + Safety
- `agents/visual_agent.py` — Image Interpretation
- `agents/triage_agent.py` — Triage Classification
- `agents/safety_guardian.py` — Safety Guardian
- End-to-end flow without navigation

### Phase 4 — Reports + Multilingual + Translation
- `clients/openai_client.py` — OpenAIReportClient (GPT-4o)
- `agents/patient_report_agent.py` — Patient Report (GPT-4o, full transcript)
- `agents/clinician_report_agent.py` — Clinician Report (GPT-4o, full transcript)
- `POST /api/v1/sessions/{id}/report/translate` — translation endpoint
- `POST /api/v1/sessions/{id}/report/translate/tts` — translated TTS endpoint
- Multilingual testing across all 6 languages

### Phase 5 — Integration + Safety Validation
- Full pipeline integration tests
- Red flag escalation scenarios
- Edge cases (no image, no location, crisis detection)
- Multilingual report quality review

---

## 13. Report Output Format

```
┌─────────────────────────────────────────────────┐
│            AI HEALTH GUIDE REPORT                │
│       Patient Language  <->  Clinical Language    │
├─────────────────────────────────────────────────┤
│  Patient Profile       │ Name / Age / Sex        │
│  Primary Complaint     │ In patient's words      │
│  Symptom Timeline      │ Duration + pattern      │
│  Severity Score        │ Self-reported 1-10      │
│  Associated Symptoms   │ Full symptom set        │
│  Image Findings        │ Visual observations     │
│  Red Flags Detected    │ Flagged or clear        │
│  Triage Level          │ RED / YELLOW / GREEN    │
│  Recommended Facility  │ Name + distance         │
│  SOAP Note             │ For clinician use       │
└─────────────────────────────────────────────────┘
```

---

## 14. Disclaimer

> AI Health Guide supports preliminary data collection, care navigation, and language accessibility only. It is not a substitute for professional medical evaluation, diagnosis, or certified medical interpretation.
