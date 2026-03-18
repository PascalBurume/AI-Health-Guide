# LinkedIn Post — AI Health Guide

> Use this as your LinkedIn post. Copy the section that fits your preferred length (short, medium, or full). Adjust the tone and details to your liking.

---

## Full Post

🏥 **I Built a Multilingual AI Health Triage System — Here's How**

Over the past weeks, I've been building **AI Health Guide** — a full-stack AI application that conducts structured clinical interviews in 6 languages, triages patients by urgency, navigates them to nearby facilities, and generates dual medical reports (patient-facing + clinician SOAP note) — all while keeping sensitive health data local.

Here's the architecture, the tools, and how I built it.

---

### 🧠 The Architecture: Pipeline-Orchestrator Hybrid

The system runs a **5-stage clinical pipeline** with **9 specialized AI agents**, each responsible for one step of the patient journey:

```
Patient Input
     ↓
[1. Language Detection + Intake]
     ↓ ── Safety Guardian ──
[2. Clinical Questioning (ABCDE + Red Flags)]  ↔ Patient (multi-turn)
     ↓ ── Safety Guardian ──
[3. Visual Interpretation]  (optional image upload)
     ↓ ── Safety Guardian ──
[4. Triage Classification]  (deterministic — never LLM-decided)
     ↓ ── Safety Guardian ──
[5. Care Navigation (Google Maps)]
     ↓
[6a. Patient Report] ‖ [6b. Clinician Report]  (parallel generation)
     ↓ ── Safety Guardian final check ──
[Session Complete — Deliver Reports]
```

**Key design decisions:**
- Triage color (RED/YELLOW/GREEN) is **always deterministic** — a rule-based matrix, not the LLM. The AI only writes the rationale.
- A **Safety Guardian** agent validates every stage boundary — checking for diagnostic language, missing disclaimers, red flag escalation, and crisis detection.
- Patient and clinician reports are generated **in parallel** using `asyncio.gather`.

---

### 🛠 The Tech Stack

**AI Models:**
| Model | What It Does | Where It Runs |
|-------|-------------|---------------|
| **MedGemma 1.0:4b** (via Ollama) | Clinical reasoning, ABCDE questioning, triage rationale, image analysis, translation | **Locally** — patient data never leaves the server |
| **GPT-4o** (OpenAI) | Patient report, clinician SOAP note, report translation | Cloud API (de-identified data only) |
| **Whisper-1** (OpenAI) | Speech-to-text for voice input | Cloud API (audio bytes only) |
| **TTS-1** (OpenAI) | Text-to-speech for report read-aloud | Cloud API |

**Backend:**
- Python · FastAPI · Uvicorn · Pydantic v2 · Redis (session store, 2-hour TTL) · pytest

**Frontend:**
- Next.js 14 · React 18 · TypeScript · Tailwind CSS · Zustand (state) · next-intl (i18n with RTL) · Leaflet + react-leaflet (maps) · @react-pdf/renderer (PDF export)

**APIs & Infrastructure:**
- Ollama (local model serving)
- Google Maps Places + Directions API (care navigation with composite facility ranking)
- Redis (session persistence)

---

### 🌍 Multilingual + RTL Support

The app supports **6 languages** out of the box — English, French, Spanish, Arabic, Japanese, and Swahili — including **full RTL layout** for Arabic with logical CSS properties that auto-flip the entire UI.

---

### ⚕️ The 9 AI Agents

| # | Agent | Purpose |
|---|-------|---------|
| 1 | Session Orchestrator | Drives the pipeline, manages session state and stage transitions |
| 2 | Intake Agent | Detects language, collects chief complaint in patient's words |
| 3 | Questioning Agent | Multi-turn ABCDE clinical interview with red flag screening |
| 4 | Visual Agent | Describes uploaded symptom images (never diagnoses) |
| 5 | Triage Agent | Assigns RED/YELLOW/GREEN urgency using deterministic rules + LLM rationale |
| 6 | Navigation Agent | Finds nearby facilities via Google Maps, ranks by proximity + rating + availability |
| 7 | Patient Report Agent | Plain-language report in patient's language (GPT-4o) |
| 8 | Clinician Report Agent | Structured SOAP note for the receiving doctor (GPT-4o) |
| 9 | Safety Guardian | Cross-cutting validator — blocks diagnostic language, enforces disclaimers, guarantees red flag escalation |

---

### 💻 How I Built It: VS Code + GitHub Copilot

This entire project was built in **VS Code** using **GitHub Copilot** as my AI pair programmer. Here's how the tools fit together:

**VS Code Extensions & Features:**
- **GitHub Copilot Chat (Agent Mode)** — Used extensively for architecture design, multi-file code generation, debugging, and documentation. Copilot helped scaffold all 9 agents, write prompt templates, design the safety validation logic, and build the React component hierarchy.
- **Copilot Inline Suggestions** — Autocomplete for Python type hints, FastAPI route handlers, Pydantic models, TypeScript interfaces, and Tailwind classes.
- **Integrated Terminal** — Running backend (uvicorn) and frontend (next dev) simultaneously, managing Redis, and running Ollama.
- **Multi-root Workspace** — Backend (`ai_health_guide/`) and frontend (`ai-health-guide-frontend/`) side by side.
- **Pylance + ESLint + Tailwind CSS IntelliSense** — Full type checking across both Python and TypeScript codebases.

**GitHub Copilot Capabilities Used:**
- **Code generation** — Agent implementations, API route handlers, React components, Zustand stores, custom hooks
- **Debugging** — Tracing pipeline issues, fixing async race conditions, resolving CORS and proxy errors
- **Documentation** — Generated and updated 4 comprehensive design documents (1,000+ lines each)
- **Testing** — Test scaffolds for triage matrix, red flag screening, safety guardian, and session flow
- **Refactoring** — Restructuring the frontend from a planned `src/` layout to a flat Next.js App Router structure
- **Architecture decisions** — Model responsibility split (MedGemma local vs GPT-4o cloud), Safety Guardian design, deterministic triage backbone

**Other Tools:**
- **Git + GitHub** — Version control with feature branches, push protection (caught an API key leak!)
- **Ollama** — Local model serving for MedGemma 1.0:4b
- **Docker** — Redis containerized for session storage
- **Postman / curl** — API testing during development
- **Chrome DevTools** — Frontend debugging, network inspection, RTL layout verification

---

### 🔒 Safety First

Healthcare AI demands extra caution. The system includes:
- **No diagnostic language** — The AI describes, suggests, and observes. It never says "you have X disease."
- **Mandatory disclaimers** — Every patient output includes: *"This is NOT a medical diagnosis."*
- **Deterministic triage** — RED/YELLOW/GREEN is decided by rules, not hallucination.
- **Crisis detection** — Suicidal ideation keywords immediately surface crisis hotline information.
- **Local inference** — MedGemma runs on-premise. Patient symptoms and images never leave the server.

---

### 📊 By the Numbers

- **9** specialized AI agents in a pipeline-orchestrator hybrid
- **6** languages with full RTL support
- **22** React components
- **5** clinical stages + parallel report generation
- **2** AI model providers (local MedGemma + cloud GPT-4o)
- **0** patient data sent to the cloud for clinical reasoning

---

### 🔗 Links

- **GitHub:** github.com/PascalBurume/AI-Health-Guide
- **Built with:** VS Code + GitHub Copilot + MedGemma + GPT-4o + Next.js + FastAPI

---

#AI #HealthTech #MedicalAI #GitHubCopilot #VSCode #NextJS #FastAPI #Python #TypeScript #OpenAI #MedGemma #Ollama #MultilingualAI #HealthcareInnovation #AIAgents #FullStack

---

## Short Version (for quick posts)

🏥 Built **AI Health Guide** — a multilingual AI triage system with 9 specialized agents that interviews patients in 6 languages, analyzes symptom images, assigns urgency (RED/YELLOW/GREEN), finds nearby facilities, and generates dual medical reports.

Tech: MedGemma 1.0:4b (local) + GPT-4o + Next.js 14 + FastAPI + Redis + Google Maps

Key design: Triage is **deterministic** (rule-based matrix, not LLM). A Safety Guardian validates every stage. Patient data stays local.

Built entirely in VS Code with GitHub Copilot as my AI pair programmer.

🔗 github.com/PascalBurume/AI-Health-Guide

#AI #HealthTech #GitHubCopilot #MedicalAI #FullStack
