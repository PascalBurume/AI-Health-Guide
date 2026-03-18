# AI Health Guide — Project Blueprint

**Clinical Reasoning | Care Navigation | Multilingual Accessibility**

> **Status:** Foundation document — authoritative reference for all development decisions.  
> **Sources:** `AI_HEALTH_GUIDE_PROJECT.md` (backend) · `AI_HEALTH_GUIDE_FRONTEND.md` (frontend)  
> **Date:** March 16, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Core Entities & Relationships](#4-core-entities--relationships)
5. [Main User Flows](#5-main-user-flows)
6. [API Contract](#6-api-contract)
7. [Technical Risks & Tradeoffs](#7-technical-risks--tradeoffs)
8. [Security Considerations](#8-security-considerations)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Executive Summary

### Problem

Clinics lose time before the doctor enters the room. Patients arrive with unstructured complaints, incomplete histories, and no prioritization. For foreign patients, language barriers distort intake entirely — a patient unable to accurately describe symptoms in the local language may receive the wrong priority, the wrong referral, or no care at all.

### Solution

**AI Health Guide** is a pre-consultation AI agent platform consisting of:

- A **Python backend** running a 5-stage clinical pipeline with 9 specialized agents, powered by **MedGemma 1.0:4b via Ollama** running locally (patient data stays on-premise) and **OpenAI GPT-4o** for report generation, translation, and voice features.
- A **Next.js 14 mobile-first web application** with a full **landing home page** (hero, features, agent orchestration animation, testimonials) that guides patients through each stage via chat, voice, and image input — in their native language, including RTL (Arabic). Includes a real-time **AgentActivityPanel** for pipeline status and **NearbyFacilities** component with Google Maps-powered facility search.
- A **deterministic safety layer** (Safety Guardian + triage decision matrix) that cannot be overridden by LLM output.

### Pipeline Architecture

```
Patient Input
     │
     ▼
[Stage 1 — Language Detection + Symptom Intake]
     │
     ▼ ── Safety Guardian ──
[Stage 2 — Clinical Questioning (ABCDE + Red Flags)]  ◄──► Patient (multi-turn, max 15 turns)
     │
     ▼ ── Safety Guardian ──
[Stage 3 — Visual Interpretation]  (skipped if no image uploaded)
     │
     ▼ ── Safety Guardian ──
[Stage 4 — Triage Classification]  (deterministic matrix → LLM rationale)
     │
     ▼ ── Safety Guardian ──
[Stage 5 — Care Navigation]  (Google Maps)
     │
     ▼
[Stage 6a — Patient Report]  ║  [Stage 6b — Clinician Report]  (parallel)
     │
     ▼ ── Safety Guardian final check ──
[Session Complete — Deliver Reports]
```

---

## 2. Technology Stack

### 2.1 Backend

| Technology | Role | Justification |
|-----------|------|--------------|
| **Python 3.11+** | Language | Async ecosystem (`asyncio`), ML library coverage, Pydantic native |
| **FastAPI** | API framework | Async-native, Pydantic v2 integration, auto OpenAPI docs, rich middleware ecosystem |
| **MedGemma 1.0:4b** (local via Ollama) | Clinical LLM | All clinical reasoning, translation, multilingual generation, image analysis — patient data never leaves the premises |
| **OpenAI Whisper** (cloud) | Speech-to-text | Best-in-class multilingual STT; only non-identifiable audio bytes hit the cloud |
| **OpenAI TTS** (cloud) | Text-to-speech | Patient report read-aloud in patient's language; no PHI in audio response |
| **Redis** (Docker container) | Session persistence | TTL-based auto-expiry (30 min), fast read/write, pub/sub for future SSE upgrade |
| **Ollama** | Local inference | MedGemma model serving, GPU acceleration (CUDA/MPS/CPU) |
| **Pydantic v2** | Data validation | Shared data contract between backend models and frontend TypeScript types |
| **pydantic-settings** | Configuration | Typed `.env` loading for `AppConfig` |
| **lingua** | Language detection | Offline — no API call, no external data transfer |
| **googlemaps** | Care navigation | Official Google Python client for Places + Directions APIs |
| **pytest + pytest-asyncio** | Testing | Async test support for the agent pipeline |

### 2.2 Frontend

| Technology | Role | Justification |
|-----------|------|--------------|
| **Next.js 14** (App Router, TypeScript) | Framework | SSR for fast first paint; built-in BFF via API routes; file-based routing maps to pipeline stages |
| **Tailwind CSS 3** | Styling | Utility-first; RTL via logical properties (`ms-`, `me-`); triage color tokens; rapid prototyping |
| **Zustand** | State management | Lightweight single store, no provider nesting, SSR compatible |
| **next-intl** | Internationalization | App Router integration, per-language message bundles, RTL direction switching |
| **leaflet + react-leaflet** | Maps | Open-source map rendering for NearbyFacilities component; external Google Maps links for directions |
| **@react-pdf/renderer** | PDF export | Client-side downloadable patient report — no server round-trip |
| **Native MediaRecorder API** | Voice recording | No extra library; WebM/Opus (Chrome) + MP4 fallback (Safari/iOS) |
| **lucide-react** | Icons | MIT, tree-shakable; accessible icon set |
| **Vitest + React Testing Library** | Unit/integration tests | Fast, Vite-powered test runner |
| **Playwright** | E2E tests | Cross-browser, including RTL and accessibility scenarios |

### 2.3 Infrastructure

| Technology | Role | Justification |
|-----------|------|--------------|
| **Redis** (Docker container) | Session store | TTL-based auto-expiry, stateless backend path for future horizontal scaling |
| **Local GPU server** | Inference host | MedGemma 1.0:4b via Ollama requires CUDA/MPS; all patient data stays on-premise |
| **Docker Compose** (future) | Containerization | Reproducible deployment: backend + frontend + Redis orchestrated as a single unit |

### 2.4 Model Responsibility Split

| Responsibility | Model | Location |
|---------------|-------|----------|
| Clinical reasoning (ABCDE, red flags) | MedGemma 1.0:4b | Local (Ollama) |
| Multilingual generation + translation | MedGemma 1.0:4b | Local (Ollama) |
| Medical image analysis | MedGemma 1.0:4b | Local (Ollama) |
| Triage rationale | MedGemma 1.0:4b | Local (Ollama) |
| Safety validation | MedGemma 1.0:4b | Local (Ollama) |
| Patient report generation | OpenAI GPT-4o | Cloud API |
| Clinician report generation (SOAP) | OpenAI GPT-4o | Cloud API |
| Report translation | OpenAI GPT-4o | Cloud API |
| Speech-to-text (patient voice input) | OpenAI Whisper | Cloud API |
| Text-to-speech (report read-aloud) | OpenAI TTS | Cloud API |

---

## 3. Project Structure

### 3.1 Backend — `ai_health_guide/`

```
ai_health_guide/
├── __init__.py
├── main.py                         # FastAPI app entry point, session management
├── orchestrator.py                 # Agent 1: Session Orchestrator — drives pipeline
├── config.py                       # AppConfig (pydantic-settings, .env loading)
│
├── clients/
│   ├── __init__.py
│   ├── medgemma_client.py          # MedGemma 1.0:4b via Ollama inference wrapper
│   ├── redis_client.py             # Redis session store (read/write/TTL)
│   ├── voice_input.py              # OpenAI Whisper speech-to-text
│   └── voice_output.py             # OpenAI TTS text-to-speech
│
├── agents/
│   ├── __init__.py
│   ├── base.py                     # BaseAgent ABC — execute(session) → dict
│   ├── intake_agent.py             # Agent 2: Language detection + chief complaint
│   ├── questioning_agent.py        # Agent 3: ABCDE protocol + red flags (multi-turn)
│   ├── visual_agent.py             # Agent 4: Medical image description
│   ├── triage_agent.py             # Agent 5: Deterministic matrix + LLM rationale
│   ├── navigation_agent.py         # Agent 6: Google Maps facility search
│   ├── patient_report_agent.py     # Agent 7: Plain-language report in patient's language
│   ├── clinician_report_agent.py   # Agent 8: SOAP note in clinical language
│   └── safety_guardian.py          # Agent 9: Cross-cutting validator (all stage boundaries)
│
├── tools/
│   ├── __init__.py
│   ├── language_detection.py       # lingua wrapper — detect_language()
│   ├── abcde_protocol.py           # ABCDE checklist logic + completeness check
│   ├── red_flag_screening.py       # Keyword DB + screen_red_flags()
│   ├── triage_matrix.py            # Deterministic triage_decision_matrix()
│   ├── google_maps.py              # Places nearby + Directions API wrapper
│   ├── soap_formatter.py           # SOAP note structure enforcer
│   └── disclaimer_checker.py       # Required disclaimer presence validator
│
├── models/
│   ├── __init__.py
│   ├── session.py                  # SessionState, Message, Stage
│   ├── clinical.py                 # TriageResult, ABCDEAssessment, RedFlag, TriageColor
│   ├── report.py                   # SOAPNote, PatientReport, FinalReport
│   └── safety.py                   # SafetyCheckResult
│
├── prompts/
│   ├── intake.txt
│   ├── questioning.txt
│   ├── visual.txt
│   ├── triage.txt
│   ├── navigation.txt
│   ├── patient_report.txt
│   ├── clinician_report.txt
│   └── safety_guardian.txt
│
└── tests/
    ├── test_triage_matrix.py
    ├── test_red_flags.py
    ├── test_session_flow.py
    ├── test_safety_guardian.py
    ├── test_voice.py
    └── test_medgemma_client.py
```

### 3.2 Frontend — `ai-health-guide-frontend/`

```
ai-health-guide-frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts              # RTL support, triage color tokens, large tap-size utilities
├── next.config.mjs
├── postcss.config.mjs
├── next-env.d.ts
│
├── app/
│   ├── layout.tsx                  # Root: RTL direction, fonts, providers
│   ├── page.tsx                    # Entry: renders HomePage or consultation flow (showHome state)
│   ├── globals.css                 # Tailwind base + triage design tokens + RTL overrides
│   │
│   ├── api/sessions/               # BFF proxy routes (all proxy to Python FastAPI)
│   │   ├── route.ts                # POST: create session
│   │   └── [id]/
│   │       ├── route.ts            # GET: poll session state
│   │       ├── message/route.ts    # POST: send text message
│   │       ├── voice/route.ts      # POST: upload audio for STT
│   │       ├── image/route.ts      # POST: upload symptom image
│   │       └── location/route.ts   # POST: submit GPS coordinates
│   │
│   └── fonts/                      # Local font files
│
├── components/
│   ├── home/
│   │   └── HomePage.tsx            # Landing page: hero, features, how-it-works, agent orchestration
│   │                               #   animation (3 patient scenarios), testimonials, about/trust, footer
│   │
│   ├── shell/
│   │   ├── Header.tsx              # App header with onGoHome callback (logo click returns to HomePage)
│   │   ├── StageProgressBar.tsx    # Pipeline progress indicator
│   │   └── AgentActivityPanel.tsx  # Real-time agent processing status (visual/triage/report agents)
│   │
│   ├── stages/
│   │   ├── WelcomeScreen.tsx       # Welcome + disclaimer acceptance
│   │   ├── IntakeScreen.tsx        # Language cards + initial complaint
│   │   └── ImageUploadScreen.tsx   # Image upload + analysis status
│   │
│   ├── chat/
│   │   ├── ChatWindow.tsx          # Multi-turn chat interface with message list + input
│   │   └── ChatInputBar.tsx        # Text input + voice + image upload buttons
│   │
│   ├── triage/
│   │   └── TriageCard.tsx          # Full-width RED/YELLOW/GREEN color card
│   │
│   ├── report/
│   │   ├── ReportView.tsx          # Tabbed Patient/Clinician report view
│   │   ├── PatientReportDocument.tsx  # @react-pdf/renderer patient report PDF
│   │   ├── TranslatedReportDocument.tsx  # Translated report PDF
│   │   └── NearbyFacilities.tsx    # Geolocation + Google Maps facility search + external direction links
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Spinner.tsx
│       └── TriageBadge.tsx
│
├── hooks/
│   ├── useCreateSession.ts         # Session creation logic
│   └── useSessionPolling.ts        # Polling logic (1.5s while isAgentTyping)
│
├── lib/
│   ├── proxy.ts                    # BFF proxy utility for forwarding to FastAPI
│   └── utils.ts                    # cn() utility (clsx + tailwind-merge)
│
├── store/
│   └── index.ts                    # Zustand store: SessionStore + UIStore (showHome, language, stage)
│
├── types/
│   └── session.ts                  # TypeScript mirrors of backend Pydantic models
│
└── messages/                       # i18n message bundles (next-intl)
    ├── en.json
    ├── fr.json
    ├── ja.json
    ├── ar.json
    ├── sw.json
    └── es.json
```

---

## 4. Core Entities & Relationships

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SessionState                                    │
│  session_id · created_at · current_stage · patient_language             │
│  chief_complaint · questioning_turns · image_data · disclaimers_verified│
└────────────────────────────┬────────────────────────────────────────────┘
                             │
        ┌────────────────────┼───────────────────────────────┐
        │                    │                               │
        ▼ 1:N                ▼ 1:1                          ▼ 1:N
┌─────────────────┐  ┌───────────────────┐        ┌──────────────────────┐
│    Message      │  │  ABCDEAssessment  │        │      RedFlag         │
│─────────────────│  │───────────────────│        │──────────────────────│
│ role            │  │ airway            │        │ symptom              │
│ content         │  │ breathing         │        │ severity             │
│ language        │  │ circulation       │        │ (critical/high/mod.) │
│ timestamp       │  │ disability        │        │ description          │
│ agent_name      │  │ exposure          │        │ requires_emergency   │
│ image_id        │  │ notes             │        └──────────────────────┘
└─────────────────┘  └───────────────────┘
                             │
        ┌────────────────────┴──────────────────────────────┐
        │                    │                               │
        ▼ 1:1                ▼ 1:N                          ▼ 1:1
┌─────────────────┐  ┌────────────────────┐       ┌────────────────────┐
│  TriageResult   │  │     Facility       │       │     Location       │
│─────────────────│  │────────────────────│       │────────────────────│
│ color (RED/YLW/ │  │ name               │       │ latitude           │
│  GRN)           │  │ place_id           │       │ longitude          │
│ rationale       │  │ address            │       │ address            │
│ facility_type   │  │ location (→)       │       └────────────────────┘
│ urgency_desc    │  │ distance_meters    │
│ determined_by   │  │ duration_minutes   │
└─────────────────┘  │ is_open            │
                     │ rating             │
                     │ phone              │
                     └────────────────────┘
        ┌────────────────────┴──────────────────────────────┐
        │                                                    │
        ▼ 1:1                                               ▼ 1:N
┌──────────────────────┐                      ┌─────────────────────────┐
│    PatientReport     │                      │   SafetyCheckResult     │
│──────────────────────│                      │─────────────────────────│
│ summary              │                      │ stage                   │
│ what_we_found        │                      │ approved                │
│ what_to_do_next      │                      │ issues[ ]               │
│ facility_rec         │                      │ corrective_action       │
│ directions_summary   │                      │ timestamp               │
│ what_to_tell_doctor  │                      └─────────────────────────┘
│ disclaimer           │
│ language             │
└──────────────────────┘
        │
        ▼ 1:1
┌──────────────────────┐        ┌──────────────────────────────────────┐
│      SOAPNote        │        │           FinalReport                │
│──────────────────────│        │──────────────────────────────────────│
│ subjective           │        │ session_id                           │
│ objective            │        │ patient_report (→ PatientReport)     │
│ assessment           │        │ clinician_report (→ SOAPNote)        │
│ plan                 ├───────►│ triage (→ TriageResult)              │
│ triage_color         │        │ facilities[ ] (→ Facility)           │
│ red_flags_summary[ ] │        │ session_duration_seconds             │
│ language             │        │ safety_checks_passed                 │
│ patient_language     │        └──────────────────────────────────────┘
└──────────────────────┘
```

### 4.2 Pydantic Data Models

#### Session & Message

```python
from enum import Enum
from datetime import datetime
from typing import Optional, Literal
from uuid import uuid4
from pydantic import BaseModel, Field


class Stage(str, Enum):
    INTAKE      = "intake"
    QUESTIONING = "questioning"
    VISUAL      = "visual"
    TRIAGE      = "triage"
    NAVIGATION  = "navigation"
    REPORT      = "report"
    COMPLETE    = "complete"


class Message(BaseModel):
    role:       Literal["patient", "agent", "system"]
    content:    str
    language:   str
    timestamp:  datetime = Field(default_factory=datetime.utcnow)
    agent_name: Optional[str] = None
    image_id:   Optional[str] = None


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
    structured_symptoms:   dict                       = {}
    abcde_assessment:      Optional["ABCDEAssessment"] = None
    red_flags:             list["RedFlag"]             = []
    severity:              int                        = 0
    questioning_turns:     int                        = 0
    questioning_complete:  bool                       = False

    # Stage 3 — Visual
    image_data:         Optional[str]   = None  # base64
    visual_observations: list[str]      = []
    image_analyzed:      bool           = False

    # Stage 4 — Triage
    triage: Optional["TriageResult"] = None

    # Stage 5 — Navigation
    patient_location: Optional["Location"] = None
    facilities:       list["Facility"]     = []
    directions:       Optional[dict]       = None

    # Stage 6 — Reports
    patient_report:   str                = ""
    clinician_report: Optional["SOAPNote"] = None

    # Cross-cutting
    safety_checks:        list["SafetyCheckResult"] = []
    disclaimers_verified: bool                      = False
```

#### Clinical Models

```python
class TriageColor(str, Enum):
    RED    = "RED"     # Emergency — go to ED now
    YELLOW = "YELLOW"  # Urgent — see provider within 24h
    GREEN  = "GREEN"   # Non-urgent — schedule appointment


class RedFlag(BaseModel):
    symptom:            str
    severity:           Literal["critical", "high", "moderate"]
    description:        str
    requires_emergency: bool


class ABCDEAssessment(BaseModel):
    airway:      Optional[str] = None
    breathing:   Optional[str] = None
    circulation: Optional[str] = None
    disability:  Optional[str] = None
    exposure:    Optional[str] = None
    notes:       str           = ""


class TriageResult(BaseModel):
    color:               TriageColor
    rationale:           str
    facility_type_needed: str  # "emergency_department" | "urgent_care" | "clinic" | "pharmacy"
    urgency_description: str
    determined_by:       Literal["rule_matrix", "llm_override"] = "rule_matrix"
```

#### Report Models

```python
class SOAPNote(BaseModel):
    subjective:        str
    objective:         str
    assessment:        str
    plan:              str
    triage_color:      TriageColor
    red_flags_summary: list[str]
    language:          str
    patient_language:  str  # For clinician reference (interpreter needs)


class PatientReport(BaseModel):
    summary:                str
    what_we_found:          str
    what_to_do_next:        str
    facility_recommendation: str
    directions_summary:     str
    what_to_tell_doctor:    str
    disclaimer:             str
    language:               str


class FinalReport(BaseModel):
    session_id:              str
    patient_report:          PatientReport
    clinician_report:        SOAPNote
    triage:                  TriageResult
    facilities:              list["Facility"]
    session_duration_seconds: int
    safety_checks_passed:    bool
```

#### Location & Facility Models

```python
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
    phone:            Optional[str]   = None
```

#### Safety Models

```python
class SafetyCheckResult(BaseModel):
    stage:             Stage
    approved:          bool
    issues:            list[str] = []
    corrective_action: str       = ""
    timestamp:         datetime  = Field(default_factory=datetime.utcnow)
```

### 4.3 TypeScript Mirrors (Frontend)

The frontend `types/session.ts` mirrors all Pydantic models above. The canonical source is always the Python models — TypeScript types are derived, never invented.

```typescript
// types/session.ts
export type Stage = 'intake' | 'questioning' | 'visual' | 'triage' | 'navigation' | 'report' | 'complete';
export type TriageColor = 'RED' | 'YELLOW' | 'GREEN';
export type MessageRole = 'patient' | 'agent' | 'system';

export interface Message {
  role:       MessageRole;
  content:    string;
  language:   string;
  timestamp:  string;
  agent_name?: string;
  image_id?:  string;
}

export interface TriageResult {
  color:                TriageColor;
  rationale:            string;
  facility_type_needed: string;
  urgency_description:  string;
  determined_by:        'rule_matrix' | 'llm_override';
}

export interface Facility {
  name:             string;
  place_id:         string;
  address:          string;
  location:         { latitude: number; longitude: number };
  distance_meters:  number;
  duration_minutes: number;
  is_open:          boolean;
  rating?:          number;
  phone?:           string;
}

export interface PatientReport {
  summary:                string;
  what_we_found:          string;
  what_to_do_next:        string;
  facility_recommendation: string;
  directions_summary:     string;
  what_to_tell_doctor:    string;
  disclaimer:             string;
  language:               string;
}

export interface SOAPNote {
  subjective:        string;
  objective:         string;
  assessment:        string;
  plan:              string;
  triage_color:      TriageColor;
  red_flags_summary: string[];
  language:          string;
  patient_language:  string;
}

export interface SessionState {
  session_id:      string;
  current_stage:   Stage;
  patient_language: string;
  messages:        Message[];
  triage:          TriageResult | null;
  facilities:      Facility[];
  patient_report:  PatientReport | null;
  clinician_report: SOAPNote | null;
  questioning_turns: number;
  image_analyzed:  boolean;
}
```

---

## 5. Main User Flows

### Flow 1 — Happy Path (Text Input)

```
Patient arrives at app URL
  └─► HomePage: Landing page with hero, features, agent orchestration animation
        "Start Health Assessment" CTA button
        └─► Screen 1: Welcome + Disclaimer acceptance
              └─► Screen 2: Language Selection + Chief Complaint (Intake)
                    6 language options (EN / FR / JA / AR / SW / ES)
                    POST /api/sessions { language, complaint } → receives sessionId
                    └─► Screen 3: Clinical Chat (Stage 2)
                          Agent greets in detected language
                          Multi-turn Q&A: 3–15 turns (ABCDE + Red Flag screening)
                          └─► Screen 4: Image Upload (Stage 3) — optional
                                Patient uploads/skips
                                Visual agent describes (never diagnoses)
                                └─► Screen 5: Triage + Navigation (Stage 4)
                                      Deterministic matrix assigns RED / YELLOW / GREEN
                                      AgentActivityPanel shows real-time processing status
                                      └─► Screen 6: Report View (Stage 5)
                                            Patient tab (plain language, patient's language)
                                            Clinician tab (SOAP note, English)
                                            NearbyFacilities: geolocation → ranked facilities → external Google Maps links
                                            [ Download PDF ] [ Start New ]
```

### Flow 2 — Voice Input

```
Patient taps mic button (56px, idle state)
  └─► Browser requests microphone permission
        ├─ Denied → mic button disabled, text-only UI
        └─ Granted → MediaRecorder starts
              mimeType: audio/webm;codecs=opus (Chrome)
              mimeType: audio/mp4 (Safari fallback)
              Red pulsing ring + seconds counter displayed
              └─► Patient taps mic again (or 30s auto-stop)
                    Blob assembled → POST FormData to /api/session/[id]/voice
                    BFF forwards to Python backend
                    └─► OpenAI Whisper transcribes to text (cloud, audio bytes only)
                          Transcribed text enters pipeline as normal Message
                          Appears as patient message bubble in chat
```

### Flow 3 — Image Upload

```
Patient taps camera button
  └─► <input type="file" accept="image/*" capture="environment">
        ├─ Camera (mobile) or file picker (desktop)
        └─ File selected
              imageCompressor.ts resizes to max 2MB (quality-preserving)
              POST FormData to /api/session/[id]/image
              Image thumbnail shown → spinner overlay → "Analyzing..."
              └─► Visual Interpretation Agent (MedGemma 1.0:4b multimodal)
                    Describes: color, size, shape, texture, location on body
                    Checks: consistency with stated symptoms
                    Output: visual_observations[] appended to SessionState
                    Result appears as agent message bubble in chat
                    └─► Visual observations feed into Triage Classification
```

### Flow 4 — Red Flag Escalation

```
Red flag keyword detected in patient message (e.g. "chest pain", "can't breathe")
  └─► screen_red_flags(text) → RedFlag(severity="critical", requires_emergency=True)
        SessionState.red_flags.append(flag)
        Clinical Questioning Agent continues calmly (no alarm to patient)
        └─► Triage Stage
              triage_decision_matrix:
                critical_flags or high_flags → TriageColor.RED (deterministic, not LLM)
              Safety Guardian validates:
                ✓ triage.color == RED
                ✓ facility_type == "emergency_department"
                ✓ patient report includes emergency guidance
              └─► Screen 4: RED triage card
                    "‼ EMERGENCY — Go Now" banner (bg-red-600, white text)
                    Local emergency number prominently displayed
                    Nearest emergency department only (radius: 5km)
```

### Flow 5 — Crisis Detection

```
Patient message contains suicidal ideation keywords
("want to die", "kill myself", "end my life", "suicide", "self-harm")
  └─► Safety Guardian: _detect_crisis(session) → True
        Pipeline paused immediately
        └─► Full-screen crisis hotline banner (role="alertdialog")
              Non-dismissible
              Local mental health crisis number
              Local emergency number
              "You are not alone. Help is available right now."
              Cannot proceed in pipeline until crisis resolved
```

### Flow 6 — Geolocation Denied

```
Report View: NearbyFacilities component requests geolocation
  └─► Patient denies geolocation (or browser blocks)
        ├─ Denied → NearbyFacilities section shows "Skip" option
        └─ Granted → Google Maps Places API searched via backend
              Ranked facility cards displayed with:
                External Google Maps direction links (not embedded map)
                "Get Directions" opens google.com/maps in new tab
              If no facilities found → "No nearby facilities found" message
```

### Flow 7 — RTL Layout (Arabic)

```
Patient selects Arabic (العربية)
  └─► uiStore.language = 'ar', uiStore.direction = 'rtl'
        document.documentElement.dir = 'rtl'
        next-intl loads ar.json message bundle
        └─► All logical CSS properties auto-flip:
              ms-4 (margin-inline-start) → right side in RTL
              justify-end (patient) ↔ justify-start (agent) in chat
              ProgressStepper flex-row reverses via direction: inherit
              Noto Sans Arabic font loaded
              Arabic numerals remain LTR (unicode-bidi: embed)
              Voice + camera buttons reposition to leading edge
```

### Flow 8 — Polling Communication Pattern

```
Patient sends message → POST /api/session/[id]/message
  └─► sessionStore.isAgentTyping = true
        └─► Poll every 1500ms: GET /api/session/[id]
              ├─ Backend still processing → continue polling
              │    TypingIndicator shown (3 animated dots, aria-label="Agent is typing")
              └─ Response includes new agent message or stage change
                    sessionStore updates with new messages + currentStage
                    isAgentTyping = false → polling stops
                    If stage changed → page renders new stage component
```

---

## 6. API Contract

### 6.1 Backend Routes (FastAPI — `main.py`)

| Method | Route | Purpose | Request Body | Success Response |
|--------|-------|---------|-------------|-----------------|
| `POST` | `/api/v1/sessions` | Create a new session | `{ "language": "en" }` | `SessionState` |
| `GET` | `/api/v1/sessions/{id}` | Poll current session state | — | `SessionState` |
| `POST` | `/api/v1/sessions/{id}/messages` | Send a text message | `{ "content": "string" }` | `SessionState` (updated) |
| `POST` | `/api/v1/sessions/{id}/voice` | Upload audio for STT | `FormData: audio (file)` | `SessionState` (with transcription) |
| `POST` | `/api/v1/sessions/{id}/image` | Upload symptom image | `FormData: image (file)` | `SessionState` (with visual_observations) |
| `POST` | `/api/v1/sessions/{id}/location` | Submit GPS coordinates | `{ "lat": float, "lng": float }` | `SessionState` (with facilities) |
| `GET` | `/api/v1/sessions/{id}/report` | Fetch final reports | — | `FinalReport` |
| `GET` | `/api/v1/sessions/{id}/report/tts` | Stream TTS audio | — | `audio/mpeg` stream |

### 6.2 BFF Proxy Routes (Next.js API Routes)

All frontend routes are thin proxies — they add no business logic. They forward to FastAPI with the `BACKEND_URL` environment variable.

| Frontend BFF Route | Proxies To |
|-------------------|-----------|
| `POST /api/session` | `POST /api/v1/sessions` |
| `GET /api/session/[id]` | `GET /api/v1/sessions/{id}` |
| `POST /api/session/[id]/message` | `POST /api/v1/sessions/{id}/messages` |
| `POST /api/session/[id]/voice` | `POST /api/v1/sessions/{id}/voice` |
| `POST /api/session/[id]/image` | `POST /api/v1/sessions/{id}/image` |
| `POST /api/session/[id]/location` | `POST /api/v1/sessions/{id}/location` |
| `GET /api/session/[id]/report` | `GET /api/v1/sessions/{id}/report` |
| `GET /api/session/[id]/report/tts` | `GET /api/v1/sessions/{id}/report/tts` |

### 6.3 BFF Proxy Pattern

```typescript
// src/app/api/session/[id]/message/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const res = await fetch(`${process.env.BACKEND_URL}/api/v1/sessions/${params.id}/messages`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return Response.json(await res.json(), { status: res.status });
}
```

### 6.4 Redis Session Storage

Sessions are stored as JSON in Redis with a TTL of 1800 seconds (30 minutes), keyed by `session:{session_id}`.

```python
# clients/redis_client.py
class RedisSessionClient:
    SESSION_TTL = 1800  # seconds

    async def save(self, session: SessionState) -> None:
        await self.redis.setex(
            f"session:{session.session_id}",
            self.SESSION_TTL,
            session.model_dump_json(),
        )

    async def load(self, session_id: str) -> SessionState | None:
        data = await self.redis.get(f"session:{session_id}")
        return SessionState.model_validate_json(data) if data else None
```

---

## 7. Technical Risks & Tradeoffs

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **MedGemma GPU dependency** | 🔴 High | Cannot run without CUDA-capable or Apple Silicon hardware | Document minimum specs (16GB+ VRAM recommended); provide CPU fallback (10–30× slower); cloud GPU VM path for future scale |
| 2 | **MedGemma inference latency (2–8s/turn)** | 🟡 Medium | Clinical Q&A feels sluggish; patient may abandon | Typing indicator + 1.5s polling masks latency; pre-warm model on startup; SSE upgrade documented as latency mitigation path |
| 3 | **No session authentication (MVP)** | 🔴 High | Anyone with a `session_id` can access its state | Acceptable only for clinic-internal private network; add per-session HMAC tokens + IP binding in Phase 2 |
| 4 | **Patient data privacy (HIPAA/GDPR)** | 🔴 Critical | Medical data exposure; regulatory risk | Local inference keeps PHI on-premise; Redis TTL auto-expires sessions; no PHI in application logs; encrypt Redis at rest |
| 5 | **OpenAI cloud dependency (voice)** | 🟡 Medium | Voice features fail if API is down or rate-limited | Graceful degradation to text-only input/output; voice is always optional in the UX; circuit breaker on voice routes |
| 6 | **Google Maps API cost** | 🟢 Low-Medium | Per-request billing at scale | Cache facility results per `{triage_color}+{geohash}` in Redis with 15-minute TTL; rate-limit navigation requests per session |
| 7 | **Keyword-based red flag detection is brittle** | 🟡 Medium | Paraphrased or non-standard expressions miss detection | MedGemma provides secondary semantic red-flag pass; keyword DB is the baseline floor, not the ceiling |
| 8 | **MedGemma translation accuracy in clinical context** | 🟡 Medium | Mistranslation in medical context could be dangerous | Chief complaint stored in both original language and English; Safety Guardian validates all patient-facing text; clinician report defaults to English |
| 9 | **Single point of failure (one server)** | 🟡 Medium | No redundancy — server outage = total downtime | Redis enables stateless backend instances; Docker Compose multi-replica path defined; health check endpoint at `/health` |
| 10 | **RTL edge cases** | 🟢 Low | Broken layout for Arabic users; high trust risk | Dedicated Playwright `rtl-arabic.spec.ts` test suite; manual Arabic QA pass required before each release |
| 11 | **Image quality from phone cameras** | 🟡 Medium | Blurry/poorly-lit images reduce visual agent accuracy | Client-side JPEG quality preservation during compression; visual agent explicitly reports image quality confidence in output |
| 12 | **Session timeout misalignment** | 🟢 Low | Frontend timer and Redis TTL can desync | Both set to 1800s; frontend `SessionTimer` shows elapsed time; backend returns `expired` status on stale session fetch |
| 13 | **Deterministic triage + LLM rationale split** | Design decision | LLM could generate rationale mismatched to deterministic color | Safety Guardian cross-validates: if rationale text contradicts the matrix color, it triggers a correction pass |

---

## 8. Security Considerations

### Data Privacy
- All clinical reasoning (MedGemma 1.0:4b via Ollama) runs **locally** — patient symptom data, images, and reports never leave the server.
- Only **audio bytes** go to OpenAI (Whisper/TTS) and **de-identified clinical data** to OpenAI GPT-4o (report generation/translation) — no patient identifiers are included.
- Redis sessions expire automatically after 30 minutes (no persistent patient records in MVP).
- Application logs contain `session_id` only — no symptom content, no names.

### Input Validation
- Image uploads: MIME type validation (`image/jpeg`, `image/png`, `image/webp` only), max 2MB enforced both client-side (`imageCompressor.ts`) and server-side.
- Text messages: length limit enforced; no HTML injection in chat bubbles (content rendered as text, not HTML).
- Audio uploads: MIME type validation, max 10MB, duration capped at 30 seconds.

### API Security
- BFF validates `session_id` format (UUID v4) before proxying — rejects malformed IDs.
- Rate limiting on `POST /api/v1/sessions` — prevent session creation floods.
- `BACKEND_URL` is a server-side-only environment variable — never exposed to client.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` scoped to specific domains in Google Cloud Console.

### Infrastructure
- Redis bound to `localhost`/internal Docker network (not exposed externally), password-protected.
- All secrets in `.env` / environment variables — never committed to source control.
- HTTPS enforced in production (TLS termination at reverse proxy).
- MedGemma model weights stored locally, no model API key required.

### Safety Guardrails (Clinical)
- **Diagnostic language prohibition**: Safety Guardian blocks all output matching forbidden patterns (`you have X`, `this is X disease`).
- **Mandatory disclaimers**: Every patient-facing output must contain: *"This is NOT a medical diagnosis"* and *"Please consult a qualified healthcare professional."*
- **Red flag escalation guarantee**: Critical/high red flags deterministically force RED triage — not overridable by LLM.
- **Crisis detection bypass**: Suicidal ideation keywords immediately surface a crisis hotline banner, bypassing the normal pipeline.

---

## 9. Implementation Phases

### Phase 1 — Foundation
**Goal:** All data contracts defined, deterministic tools proven, project scaffolds ready.

**Backend deliverables:**
- All Pydantic models (`models/session.py`, `models/clinical.py`, `models/report.py`, `models/safety.py`)
- Deterministic tools with full unit tests:
  - `tools/triage_matrix.py` — `triage_decision_matrix()`
  - `tools/red_flag_screening.py` — `screen_red_flags()` + full `RED_FLAG_DATABASE`
  - `tools/abcde_protocol.py` — checklist logic + completeness check
- `config.py` (AppConfig with all env vars)
- `clients/redis_client.py` (session CRUD + TTL)
- FastAPI skeleton: session CRUD endpoints + `/health`
- `requirements.txt` locked

**Frontend deliverables:**
- Next.js 14 scaffold + Tailwind config (triage color tokens, RTL logical props, 48px+ tap sizes)
- TypeScript types mirroring all Pydantic models (`src/types/session.ts`, `src/types/api.ts`)
- All UI primitives: `Button`, `Card`, `Badge`, `Spinner`, `DisclaimerBanner`
- `AppHeader`, `ProgressStepper`, `Footer`, `LanguageSwitcher`
- i18n setup: `next-intl` configured, all 6 message bundles scaffolded
- Static mock screens for all 5 stages (no backend connection)
- `constants.ts`: `LANGUAGES`, `TRIAGE_COLORS`, `STAGE_NAMES`

**Verification gate:**
- `pytest tests/test_triage_matrix.py tests/test_red_flags.py` → all pass
- Frontend renders all 5 stage mocks; Arabic/RTL mock loads correctly

---

### Phase 2 — Core Pipeline (Text + Voice)
**Goal:** End-to-end text conversation in English; voice input working.

**Backend deliverables:**
- `agents/base.py` — `BaseAgent` ABC
- `clients/medgemma_client.py` — local inference wrapper
- `agents/intake_agent.py` — language detection + chief complaint extraction
- `agents/questioning_agent.py` — ABCDE multi-turn loop, completeness check
- `orchestrator.py` — Session Orchestrator (stages 1–2)
- `clients/voice_input.py` — Whisper STT integration
- `main.py` — FastAPI with `/messages` and `/voice` endpoints wired
- Prompts: `prompts/intake.txt`, `prompts/questioning.txt`

**Frontend deliverables:**
- Zustand stores: `sessionStore.ts`, `uiStore.ts`
- All BFF API routes: session, message, voice
- `ClinicalChat.tsx` component fully wired: `MessageList`, `MessageBubble`, `ChatInputBar`
- Polling logic (1.5s, `isAgentTyping` driven)
- `audioRecorder.ts` state machine + `useVoiceRecorder.ts` hook
- `VoiceRecordButton.tsx` with pulsing red ring + seconds counter + auto-stop at 30s
- Turn counter ("Question N of up to 15")

**Verification gate:**
- Full English text conversation: intake → 3+ questions → `questioning_complete: true`
- Voice input: speak → transcribe → appears as patient bubble → agent responds

---

### Phase 3 — Visual + Triage + Safety
**Goal:** Image upload works; triage is always deterministic; Safety Guardian blocks violations.

**Backend deliverables:**
- `agents/visual_agent.py` — multimodal MedGemma image description
- `agents/triage_agent.py` — deterministic matrix + LLM rationale + `facility_type` mapping
- `agents/safety_guardian.py` — all 4 validation checks + crisis detection
- `clients/voice_output.py` — TTS stub (for Phase 4)
- `tools/disclaimer_checker.py`, `tools/google_maps.py` (stub for navigation)
- Orchestrator updated for stages 3–4
- Prompts: `prompts/visual.txt`, `prompts/triage.txt`, `prompts/safety_guardian.txt`

**Frontend deliverables:**
- `ImageUploadButton.tsx` + `imageCompressor.ts`
- BFF image route
- `ImageReview.tsx` with spinner overlay and analysis result display
- `TriageCard.tsx` — full-width RED/YELLOW/GREEN color card with icon + text label (never color alone)
- `LocationPermissionPrompt.tsx` + `useGeolocation.ts` hook
- `MapEmbed.tsx` (Google Maps, placeholder pending Phase 3 navigation data)
- `FacilityCard.tsx`

**Verification gate:**
- Upload blurry image → visual agent reports quality issue
- Simulate red flag symptom → triage must be RED, regardless of LLM rationale
- Inject diagnostic language → Safety Guardian blocks and requests correction
- Test `crisis detection` keyword → crisis hotline banner appears

---

### Phase 4 — Navigation + Reports + Multilingual
**Goal:** Patients can navigate to facilities; full dual reports generated in all 6 languages.

**Backend deliverables:**
- `agents/navigation_agent.py` — Google Maps Places + Directions, facility ranking
- `agents/patient_report_agent.py` — plain-language in `patient_language`
- `agents/clinician_report_agent.py` — SOAP note in `clinical_language`
- Parallel report generation in Orchestrator (`asyncio.gather`)
- `clients/voice_output.py` — TTS streaming integration
- Full orchestrator for all 6 stages
- Multilingual system prompt parameterization
- Prompts: `prompts/navigation.txt`, `prompts/patient_report.txt`, `prompts/clinician_report.txt`

**Frontend deliverables:**
- `MapEmbed.tsx` fully wired with live directions polyline
- `ReportView.tsx` with Patient / Clinician tabs
- `PatientReportCard.tsx` — 4 sections (Summary, Next Steps, Where to Go, What to Tell Doctor)
- `ClinicianReportCard.tsx` — collapsible S/O/A/P sections
- `ReadAloudButton.tsx` + `useAudioPlayer.ts` — TTS streaming playback
- `ReportPDF.tsx` (`@react-pdf/renderer`)
- Print stylesheet
- `DisclaimerBanner` always visible and non-dismissible
- All 6 i18n message bundles completed

**Verification gate:**
- Full happy-path in English, French, Arabic (RTL), Japanese
- RED triage → nearest ED appears; YELLOW → urgent care; GREEN → clinic/pharmacy
- Patient report reads aloud in Arabic

---

### Phase 5 — Polish, Hardening & Compliance
**Goal:** Production-ready: all tests pass, accessible, RTL correct, crisis path tested.

**Backend deliverables:**
- Full integration tests: `test_session_flow.py`, `test_safety_guardian.py`
- Red flag escalation scenario test suite
- Edge case tests: no image, no location, session timeout, crisis detection
- Multilingual report quality review (native speaker spot-check for each language)
- Performance: MedGemma model pre-warming on startup
- Logging: structured JSON logs with `session_id` only (no PHI)

**Frontend deliverables:**
- Full RTL audit: Arabic layout correct on iOS Safari + Android Chrome
- Accessibility audit: axe-core + VoiceOver (iOS) + TalkBack (Android)
- WCAG AA compliance check (all triage colors + contrast ratios verified)
- Playwright E2E suites:
  - `full-flow.spec.ts` — complete happy path
  - `rtl-arabic.spec.ts` — RTL layout correctness
  - `voice-input.spec.ts` — voice recording + transcription
- Vitest unit/integration tests to ≥80% coverage
- Lazy loading: `MapEmbed` + `ReportPDF` components
- Error boundaries on all stage components
- Session timeout handling (30-min Frontend timer + backend TTL alignment)
- `manifest.json` + PWA configuration

**Verification gate:**
- All tests pass (pytest + Vitest + Playwright)
- No axe-core violations on all 5 screens
- Crisis detection scenario: banner shown, pipeline blocked, cannot dismiss
- Session expires at 30 min: frontend redirects to start, Redis key gone

---

## Appendix A: Agent Inventory Summary

| # | Agent | Stage | Model | Key Output |
|---|-------|-------|-------|-----------|
| 1 | **Session Orchestrator** | All | MedGemma 1.0:4b | Drives pipeline; manages `SessionState` |
| 2 | **Intake Agent** | `intake` | MedGemma 1.0:4b | `detected_language`, `chief_complaint`, `chief_complaint_english` |
| 3 | **Clinical Questioning Agent** | `questioning` | MedGemma 1.0:4b | `structured_symptoms`, `abcde_assessment`, `red_flags`, `severity` |
| 4 | **Visual Interpretation Agent** | `visual` | MedGemma 1.0:4b (multimodal) | `visual_observations`, `consistency_with_symptoms` |
| 5 | **Triage Classification Agent** | `triage` | MedGemma 1.0:4b + deterministic matrix | `TriageResult` (color always from matrix) |
| 6 | **Care Navigation Agent** | `navigation` | MedGemma 1.0:4b + Google Maps | `facilities[]`, `directions`, `map_url` |
| 7 | **Patient Report Agent** | `report` | OpenAI GPT-4o | `PatientReport` in `patient_language` |
| 8 | **Clinician Report Agent** | `report` | OpenAI GPT-4o | `SOAPNote` in `clinical_language` |
| 9 | **Safety Guardian** | Cross-cutting | MedGemma 1.0:4b | `SafetyCheckResult` at every stage boundary |

---

## Appendix B: Triage Color System

| Color | Hex | Text Color | Label | Icon | Facility Type | Search Radius |
|-------|-----|-----------|-------|------|--------------|--------------|
| RED | `#DC2626` | `#FFFFFF` | "Emergency — Go Now" | ‼️ | `emergency_department` | 5 km |
| YELLOW | `#F59E0B` | `#1a1a1a` | "Urgent — Within 24h" | ⏰ | `urgent_care` | 10 km |
| GREEN | `#16A34A` | `#FFFFFF` | "Non-Urgent — Schedule Visit" | ✅ | `clinic` / `pharmacy` | 15 km |

**Rule:** Triage color is **never determined by the LLM** — only by `triage_decision_matrix()`. The LLM provides the human-readable rationale only.

```
critical_flags OR high_flags OR severity ≥ 7  →  RED
moderate_flags OR severity 5–6 OR visual_concerns  →  YELLOW
no flags AND severity 1–4 AND no visual concerns  →  GREEN
```

---

## Appendix C: Supported Languages

| Code | Language | Native Name | Direction | TTS Support |
|------|----------|------------|-----------|------------|
| `en` | English | English | LTR | ✓ |
| `fr` | French | Français | LTR | ✓ |
| `ja` | Japanese | 日本語 | LTR | ✓ |
| `ar` | Arabic | العربية | **RTL** | ✓ |
| `sw` | Swahili | Kiswahili | LTR | ✓ |
| `es` | Spanish | Español | LTR | ✓ |

Language is extensible — adding a new language requires: (1) adding to `AppConfig.supported_languages`, (2) adding a flag SVG, (3) adding a `messages/{lang}.json` bundle. MedGemma 1.5 handles the language natively.

---

## Appendix D: Environment Variables

### Backend (`.env`)

```env
# MedGemma (local)
MEDGEMMA_MODEL_PATH=google/medgemma-1.5
MEDGEMMA_DEVICE=cuda           # cuda | mps | cpu
MEDGEMMA_MAX_TOKENS=2048
MEDGEMMA_TEMPERATURE=0.3

# OpenAI (voice features only)
OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1
TTS_MODEL=tts-1
TTS_VOICE=nova

# Google Maps
GOOGLE_MAPS_API_KEY=...

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=...

# Session limits
MAX_QUESTIONING_TURNS=15
MAX_SESSION_DURATION_MINUTES=30

# Supported languages
SUPPORTED_LANGUAGES=en,fr,ja,ar,sw,es
DEFAULT_CLINICAL_LANGUAGE=en
```

### Frontend (`.env.local`)

```env
# Python backend (server-side only - never exposed to client)
BACKEND_URL=http://localhost:8000

# Google Maps (client-side - domain-restricted in Google Cloud Console)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...

# App config
NEXT_PUBLIC_APP_NAME=AI Health Guide
NEXT_PUBLIC_MAX_RECORDING_SECONDS=30
NEXT_PUBLIC_POLL_INTERVAL_MS=1500
```

---

## Appendix E: Minimum Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8-core | 16-core |
| RAM | 16 GB | 32 GB |
| GPU VRAM | 12 GB (CUDA/MPS) | 24 GB |
| GPU | NVIDIA RTX 3080 / Apple M2 Pro | NVIDIA A100 |
| Storage | 50 GB SSD (model weights ~10 GB) | 100 GB NVMe SSD |
| OS | Ubuntu 22.04 LTS / macOS 13+ | Ubuntu 22.04 LTS |

> **CPU fallback:** MedGemma can run on CPU (`MEDGEMMA_DEVICE=cpu`) but inference latency increases to 30–120s per turn. For production, GPU is required.

---

*This blueprint is the single source of truth for all architecture, data model, and implementation decisions. Any deviation must be documented here before code is written.*

---

> **Disclaimer:** AI Health Guide supports preliminary data collection, care navigation, and language accessibility only. It is not a substitute for professional medical evaluation, diagnosis, or certified medical interpretation.
