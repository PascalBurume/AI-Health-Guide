# AI Health Guide 🩺

An AI-powered pre-consultation healthcare platform that conducts structured clinical interviews, triages patients, and generates dual reports for both patients and clinicians — all while keeping sensitive medical data on-premise.

---

## Overview

Clinics lose valuable time during intake when patients struggle to articulate their symptoms, especially across language barriers. **AI Health Guide** solves this by automating the pre-consultation process through a pipeline of specialized AI agents. It collects symptoms in the patient's native language, screens for red flags, classifies triage severity, and routes the patient to the nearest appropriate care facility — before the doctor even enters the room.

---

## Key Features

- **Multilingual support** — English, Spanish, French, Japanese, Arabic (RTL), and Swahili
- **Structured clinical intake** using the ABCDE protocol (Appearance, Behavior, Circulation, Diarrhea/other symptoms, Exposure/Environment)
- **Automated red-flag screening** with a deterministic safety matrix
- **Medical image analysis** for preliminary visual assessment (optional)
- **Intelligent triage classification** routing patients to emergency, urgent, or routine care
- **Google Maps integration** to navigate patients to nearby healthcare facilities
- **Dual report generation** — a patient-friendly narrative and a clinician-focused SOAP note
- **Text-to-speech report narration** via OpenAI TTS
- **On-premise LLM inference** — all clinical reasoning runs locally via MedGemma 1.5 (Ollama)
- **Session safety guardian** — deterministic validation checks at every pipeline stage

---

## Architecture

The system implements a 6-stage clinical pipeline orchestrated by 9 specialized agents:

```
[Stage 1] Intake Agent        — Language detection + chief complaint collection
[Stage 2] Questioning Agent   — ABCDE protocol + multi-turn red-flag screening
[Stage 3] Visual Agent        — Optional medical image interpretation
[Stage 4] Triage Agent        — Deterministic severity classification + LLM rationale
[Stage 5] Navigation Agent    — Nearby facility search via Google Maps
[Stage 6] Report Agents       — Patient narrative + Clinician SOAP note
```

A **Safety Guardian** agent validates outputs between every stage to ensure safe, consistent results.

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Language | Python 3.11+ |
| API Framework | FastAPI (async, Pydantic v2) |
| Local LLM | MedGemma 1.5 via Ollama |
| Speech-to-Text | OpenAI Whisper |
| Text-to-Speech | OpenAI TTS |
| Session Store | Redis (30-min TTL) |
| ML Framework | PyTorch + Hugging Face Transformers |
| Language Detection | Lingua (offline) |
| Maps | Google Maps Python client |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS 3 (RTL-ready) |
| State Management | Zustand |
| Internationalization | next-intl (6 languages) |
| PDF Export | @react-pdf/renderer |
| Maps UI | @vis.gl/react-google-maps |

---

## Project Structure

```
AI-Health-Guide/
├── ai_health_guide/          # Python backend
│   ├── main.py               # FastAPI entry point
│   ├── orchestrator.py       # Pipeline orchestrator
│   ├── agents/               # 9 specialized AI agents
│   ├── clients/              # External service wrappers (Redis, OpenAI, MedGemma)
│   ├── models/               # Pydantic data models
│   ├── tools/                # Clinical utilities (ABCDE, triage matrix, red flags)
│   ├── prompts/              # LLM prompt templates
│   └── tests/                # Backend unit & integration tests
│
├── ai-health-guide-frontend/ # Next.js frontend
│   ├── app/                  # App Router pages & API routes
│   ├── components/           # React UI components
│   ├── store/                # Zustand global state
│   ├── messages/             # i18n translation files
│   └── hooks/                # Custom React hooks
│
├── requirements.txt          # Python dependencies
└── pytest.ini                # Test configuration
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis server
- [Ollama](https://ollama.com/) with MedGemma 1.5 loaded
- OpenAI API key (for Whisper STT and TTS)
- Google Maps API key

### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys (OPENAI_API_KEY, GOOGLE_MAPS_API_KEY, etc.)

# Start the FastAPI server
uvicorn ai_health_guide.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd ai-health-guide-frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Running Tests

```bash
# Backend tests
pytest

# Frontend tests
cd ai-health-guide-frontend && npm test
```

---

## Documentation

For in-depth design details, refer to the documentation files at the project root:

| File | Description |
|------|-------------|
| `PROJECT_BLUEPRINT.md` | Authoritative project specification (architecture, API contract, security, roadmap) |
| `AI_HEALTH_GUIDE_PROJECT.md` | Detailed backend design: agents, clinical protocols, pipeline stages |
| `AI_HEALTH_GUIDE_FRONTEND.md` | Frontend architecture: components, state management, i18n, deployment |
| `CODEBASE_COMPREHENSIVE_REVIEW.md` | Code review guide, best practices, and security checklist |

---

## Disclaimer

> **AI Health Guide is a pre-consultation aid only.** It does not provide medical diagnoses, replace professional clinical judgment, or constitute medical advice. All AI-generated triage and report content must be reviewed by a qualified healthcare provider before any clinical decision is made.

---

## License

This project is provided for educational and research purposes. See [LICENSE](LICENSE) for details.
