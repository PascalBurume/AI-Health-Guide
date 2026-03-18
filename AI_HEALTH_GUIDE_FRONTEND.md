# AI Health Guide — Front-End Design Document

**Patient-Facing Web Application | Mobile-First | Multilingual**

---

## 1. Overview

The AI Health Guide front-end is a **mobile-first web application** that guides patients through a 5-stage clinical intake pipeline. It includes a full **landing home page** with hero, feature showcase, agent orchestration animation, and testimonials. It connects to the Python backend (MedGemma 1.0:4b via Ollama + OpenAI GPT-4o for reports/voice) via a Next.js BFF (Backend-for-Frontend) proxy layer.

**Design principles:**
- Patients use this on their phones at clinic check-in, often under stress
- Every interaction must be achievable with one hand on a phone screen
- Language is selected once and the entire UI adapts (including RTL for Arabic)
- Voice input is a first-class input method, not an afterthought

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 14** (App Router, TypeScript) | SSR for fast first paint; built-in BFF API routes; file-based routing maps to pipeline stages |
| Styling | **Tailwind CSS 3** | Utility-first; RTL via logical properties (`ms-`, `me-`); rapid prototyping |
| State | **Zustand** | Lightweight single-store; no provider nesting; SSR compatible |
| Internationalization | **next-intl** | App Router integration; RTL direction switching; per-language message bundles |
| Maps | **leaflet + react-leaflet** | Lightweight mapping library (installed); facility directions via external Google Maps links |
| Audio Recording | **Native MediaRecorder API** | No library needed; WebM/Opus (Chrome) + MP4 fallback (Safari) |
| PDF Generation | **@react-pdf/renderer** | Client-side downloadable patient report |
| Icons | **lucide-react** | MIT, tree-shakable; mic, camera, map-pin, flag icons |
| Testing | **Vitest + React Testing Library + Playwright** | Unit + integration + E2E |

### Dependencies

```json
{
  "dependencies": {
    "next": "14.2.35",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "zustand": "^5.0.12",
    "next-intl": "^4.8.3",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "@react-pdf/renderer": "^4.3.2",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.1",
    "@types/react": "^18.0.0",
    "vitest": "^4.1.0",
    "@playwright/test": "^1.58.2"
  }
}
```

---

## 3. Architecture

### Communication Pattern: REST with Polling

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────────────┐
│  Patient Browser │ ───── │  Next.js BFF    │ ───── │  Python Backend (FastAPI)│
│  (React SPA)     │  REST │  API Routes     │  REST │  MedGemma 1.5 (local)   │
│                  │ ◀──── │  /app/api/...   │ ◀──── │  OpenAI (voice only)    │
└─────────────────┘       └─────────────────┘       └─────────────────────────┘
```

**Why REST polling over WebSocket:**
- MedGemma inference takes 2-8s per turn — 1.5s polling is adequate
- No sticky sessions or load balancer complexity
- SSE upgrade path available later if latency needs tighten

**Polling logic:**
- Poll every 1.5s while `isAgentTyping === true`
- Stop polling when backend returns a new agent message or stage change
- Resume polling on next patient message send

---

## 4. Component Hierarchy

```
AppShell (page.tsx — conditional rendering based on showHome state)
│
├── [showHome === true] HomePage
│   ├── Navbar (logo + "Start Consultation" / "Resume" CTA)
│   ├── Hero Section (headline, subtext, CTA buttons)
│   ├── Features Section (5 feature cards: Multilingual, Triage, Hospitals, Reports, Voice)
│   ├── How It Works (4-step visual flow)
│   ├── "Under the Hood" Agent Orchestration Section
│   │   ├── AgentPipeline (scenario-driven animation cycling 3 patient personas)
│   │   │   ├── Scenario carousel (Mrs. Chen/72, David/34, Aiko/21)
│   │   │   ├── Typewriter effect for patient messages
│   │   │   ├── Agent cards (7 agents with micro-outputs)
│   │   │   ├── Safety Guardian status bar
│   │   │   └── Triage result card (RED/YELLOW/GREEN)
│   │   └── Architecture callouts (agent cards with descriptions)
│   ├── Testimonials Section (3 user quotes)
│   ├── About/Trust Section (mission, trust badges)
│   └── Footer (links, copyright, disclaimer)
│
├── [showHome === false, no session] WelcomeScreen
│   ├── LanguageSelector (6 large flag cards)
│   └── Disclaimer acceptance
│
├── [Session active] Main Layout
│   ├── Header
│   │   ├── Logo (clickable → onGoHome, returns to HomePage)
│   │   ├── Stage badge
│   │   ├── Locale badge
│   │   └── "New Consultation" button
│   ├── StageProgressBar (stages 1-5 with labels)
│   │
│   └── Main Content Area (switches by currentStage)
│       │
│       ├── [Stage 1] Intake
│       │   └── ChatWindow + ChatInputBar
│       │
│       ├── [Stage 2] ClinicalChat
│       │   ├── MessageList
│       │   │   ├── MessageBubble (patient | agent, RTL-aware alignment)
│       │   │   └── TypingIndicator (3 animated dots)
│       │   └── ChatInputBar
│       │       ├── TextInput (auto-growing textarea)
│       │       ├── VoiceRecordButton (hold-to-record or toggle)
│       │       ├── ImageUploadButton (camera/gallery)
│       │       └── SendButton
│       │
│       ├── [Stage 3] ImageUploadScreen (optional)
│       │   ├── ImagePreview (uploaded thumbnail)
│       │   ├── ImageAnalysisStatus (spinner → result)
│       │   └── SkipButton
│       │
│       ├── [Processing] AgentActivityPanel
│       │   ├── Visual Agent status (pending/active/done)
│       │   ├── Triage Agent status
│       │   ├── Report Agents status
│       │   └── Safety Guardian bar
│       │
│       ├── [Stage 4] TriageResult
│       │   └── TriageCard (RED/YELLOW/GREEN, full-width color)
│       │       ├── TriageIcon (severity icon)
│       │       ├── UrgencyText (plain-language explanation)
│       │       ├── ActionSteps (numbered list)
│       │       └── ListenButton (TTS for triage summary)
│       │
│       └── [Stage 5] ReportView
│           ├── ReportTabs (Patient Report | Clinician Report)
│           ├── PatientReportCard
│           │   └── ReportSection × 4 (Summary, Next Steps, Facility, What to Tell Doctor)
│           ├── ClinicianReportCard (SOAP sections, collapsible)
│           ├── NearbyFacilities
│           │   ├── ShareLocation button (navigator.geolocation)
│           │   ├── Facility cards (name, distance, rating, open status)
│           │   ├── Google Maps direction links (external)
│           │   └── Skip option
│           ├── DisclaimerBanner
│           ├── ReportActions
│           │   ├── ListenButton (TTS for original report)
│           │   └── DownloadPDFButton (PatientReportDocument)
│           └── TranslateSection
│               ├── LanguagePicker (excludes report language)
│               ├── TranslatedReportCard
│               ├── ListenButton (TTS for translated text)
│               └── DownloadPDFButton (TranslatedReportDocument)
│
└── [Floating] Resume Banner (shown when hasActiveSession && showHome)
```

**Stage transitions** are driven by the backend's `SessionState.current_stage` — the patient does not navigate manually. The orchestrator advances them.

---

## 5. Screen Designs

### Screen 1: Language Selection (Stage 1a)

```
┌────────────────────────────────────────────┐
│  [Logo]   AI Health Guide                  │
│                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  [🇬🇧]   │  │  [🇫🇷]   │  │  [🇯🇵]   │   │
│  │ English  │  │ Francais │  │  日本語   │   │
│  └─────────┘  └─────────┘  └─────────┘   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  [🇸🇦]   │  │  [🇰🇪]   │  │  [🇪🇸]   │   │
│  │ العربية   │  │ Kiswahili│  │ Espanol  │   │
│  └─────────┘  └─────────┘  └─────────┘   │
│                                            │
│  Select your preferred language            │
│  to begin the health consultation.         │
└────────────────────────────────────────────┘
```

- Cards: **100×100px minimum** — large touch targets
- Flag SVGs are decorative; language name is the accessible label
- Tapping creates a session immediately and advances to intake

### Screen 2: Clinical Chat (Stage 2)

```
┌────────────────────────────────────────────┐
│  [Lang: AR]  Progress: [ ][●][ ][ ][ ]    │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────┐              │
│  │ Agent: "Can you tell me  │              │
│  │ when the pain started?"  │              │
│  └──────────────────────────┘              │
│                                            │
│              ┌──────────────────────────┐  │
│              │ You: "It started two     │  │
│              │ days ago in my chest"    │  │
│              └──────────────────────────┘  │
│                                            │
│  ┌──────────────────────────┐              │
│  │ Agent: "On a scale of    │              │
│  │ 1-10, how severe is it?" │              │
│  └──────────────────────────┘              │
│                                            │
│  Question 4 of up to 15                    │
├────────────────────────────────────────────┤
│ [🎤 56px] [📷] ┌──────────────┐ [Send →] │
│                 │ Type here... │            │
│                 └──────────────┘            │
└────────────────────────────────────────────┘
```

- Agent messages: left-aligned (right in RTL)
- Patient messages: right-aligned (left in RTL)
- Mic button: **56px diameter**, pulsing red ring when recording
- Camera button opens `<input type="file" accept="image/*" capture="environment">`
- Turn counter: "Question N of up to 15"

### Screen 3: Image Upload (Stage 3 — standalone variant)

```
┌────────────────────────────────────────────┐
│  Progress: [ ][ ][●][ ][ ]                │
├────────────────────────────────────────────┤
│                                            │
│  Upload a photo of your symptom            │
│  (optional)                                │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │         [📷 Camera Icon]             │  │
│  │                                      │  │
│  │     Tap to take a photo              │  │
│  │     or choose from gallery           │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ [Skip this step →]                   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

- Image compressed client-side to **max 2MB** before upload
- Loading spinner overlays thumbnail during Visual Interpretation Agent processing
- Can also appear inline during chat (image + analysis as chat messages)

### Screen 4: Triage + Navigation (Stage 4)

```
┌────────────────────────────────────────────┐
│  Progress: [ ][ ][ ][●][ ]                │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │  ⚠️  URGENT CARE NEEDED             │  │  ← YELLOW #F59E0B
│  │                                      │  │
│  │  Based on your symptoms, we          │  │
│  │  recommend you see a provider        │  │
│  │  within the next 24 hours.           │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  🏥 Nearby Facilities                      │
│  ┌──────────────────────────────────────┐  │
│  │ [📍 Share Location]                  │  │
│  │  or [Skip →]                         │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  (After location shared:)                  │
│  ┌──────────────────────────────────────┐  │
│  │ City Urgent Care Clinic              │  │
│  │ 1.2 km away  │  Rating: 4.5★        │  │
│  │ ● Open now                           │  │
│  │ [📍 Get Directions → Google Maps]    │  │  ← external link
│  └──────────────────────────────────────┘  │
│                                            │
│  [View your report →]                      │
└────────────────────────────────────────────┘
```

**Triage color system:**

| Color | Hex | Text | Icon | Label |
|-------|-----|------|------|-------|
| RED | `#DC2626` | White | ‼️ Exclamation | "Emergency — Go Now" |
| YELLOW | `#F59E0B` | Dark `#1a1a1a` | ⏰ Clock | "Urgent — Within 24h" |
| GREEN | `#16A34A` | White | ✅ Check | "Non-Urgent — Schedule Visit" |

- RED triage: emergency banner with local emergency number at top
- Facility search: Google Maps Places API via backend, ranked by composite score (proximity 0.6 + rating 0.3 + open 0.1)
- `open_now` fallback: tries open facilities first; if none found, searches all facilities
- Direction links open Google Maps externally (no embedded map — Embed API not enabled)
- If geolocation denied: skip option available; facility search not performed

### Screen 5: Report View (Stage 5)

```
┌────────────────────────────────────────────┐
│  Progress: [ ][ ][ ][ ][●]                │
├────────────────────────────────────────────┤
│  [Patient Report]  [Clinician Report]      │
├────────────────────────────────────────────┤
│                                            │
│  📋 SUMMARY                                │
│  You described chest pain that started     │
│  2 days ago with a severity of 6/10...     │
│                                            │
│  ✅ WHAT TO DO NEXT                        │
│  1. Visit the recommended clinic today     │
│  2. Bring this report with you             │
│  3. Describe any changes since now         │
│                                            │
│  🏥 WHERE TO GO                            │
│  City Urgent Care Clinic — 1.2 km away     │
│                                            │
│  💬 WHAT TO TELL THE DOCTOR                │
│  "I've had chest pain for 2 days, it       │
│   gets worse when I breathe deeply..."     │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ ⚕️ This is NOT a medical diagnosis.  │  │
│  │ Please consult a qualified healthcare│  │
│  │ professional.                        │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│ [🔊 Listen]  [📄 Download PDF]            │
├────────────────────────────────────────────┤
│  🌐 Translate report                       │
│  [English] [Français] [Español]            │
│  [العربية] [日本語] [Kiswahili]             │
│  (active language highlighted, excludes    │
│   the report's original language)          │
│                                            │
│  ── Translated version ──  [✕ Close]      │
│  [translated summary card]                 │
│  [translated what we found card]           │
│  [translated what to do next card]         │
│  [translated what to tell the doctor card] │
│  [translated disclaimer text]              │
│                                            │
│ [🔊 Listen]  [⬇️ Download PDF]            │
│   (for translated version)                 │
└────────────────────────────────────────────┘
```

- **Patient Report tab** (default): plain language, patient's language
- **Clinician Report tab**: SOAP format, clinical language, collapsible S/O/A/P sections
- **Listen**: streams TTS audio, creates Audio synchronously in click handler (avoids `NotAllowedError`)
- **Download PDF**: generates via `@react-pdf/renderer` (`PatientReportDocument` or `TranslatedReportDocument`)
- **Translate report**: language picker excludes the report's own language; clicking same language clears translation
- **Translated Listen**: POSTs concatenated translated text to `/report/translate/tts`, streams MP3
- **Translated Download PDF**: saves as `health-report-{lang}.pdf` using `TranslatedReportDocument`
- **Error handling**: on 404 (expired session) shows "Session expired. Please start a new consultation" instead of generic error
- Disclaimer banner is always visible and non-dismissible

---

## 6. State Management

### Session Store (`src/stores/sessionStore.ts`)

```typescript
interface SessionStore {
  // Session identity
  sessionId: string | null;
  currentStage: Stage;

  // Chat
  messages: Message[];
  isAgentTyping: boolean;

  // Clinical data (mirrors backend SessionState selectively)
  patientLanguage: string;
  questioningTurns: number;
  maxTurns: number;
  triage: TriageResult | null;
  facilities: Facility[];
  patientReport: PatientReport | null;
  clinicianReport: SOAPNote | null;

  // Actions
  createSession: (language: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendVoice: (audioBlob: Blob) => Promise<void>;
  sendImage: (file: File) => Promise<void>;
  submitLocation: (lat: number, lng: number) => Promise<void>;
  pollState: () => Promise<void>;
}
```

### UI Store (`src/stores/uiStore.ts`)

```typescript
interface UIStore {
  language: string;
  direction: 'ltr' | 'rtl';
  isRecording: boolean;
  audioPlayback: { isPlaying: boolean; progress: number };
  showHome: boolean;           // Controls landing page visibility (default: true)
  setShowHome: (show: boolean) => void;
}
```

### State Flow

1. App loads → `showHome === true` → **HomePage** rendered (landing page)
2. Patient clicks "Start Consultation" → `setShowHome(false)` → WelcomeScreen shown
3. Patient selects language → `uiStore.language` updates → `document.dir` changes
4. First message → `sessionStore.createSession()` → POST to BFF → receives `sessionId`
5. Each message (text/voice/image) → POST to BFF → start polling
6. Poll `GET /api/session/[id]` every 2s while waiting for agent response
7. Stage change in response → store updates → page renders new stage component
8. Header logo click → `setShowHome(true)` → return to HomePage (session preserved)
9. If active session exists: floating resume banner shown on HomePage

---

## 7. BFF API Routes

The Next.js API routes proxy all requests to the Python FastAPI backend.

### Route Map

| Frontend Route | Method | Proxies To | Purpose |
|---------------|--------|-----------|---------|
| `/api/session` | POST | `/api/v1/sessions` | Create session with language |
| `/api/session/[id]` | GET | `/api/v1/sessions/{id}` | Poll session state |
| `/api/session/[id]/language` | PATCH | `/api/v1/sessions/{id}/language` | Update session language mid-consultation |
| `/api/session/[id]/message` | POST | `/api/v1/sessions/{id}/messages` | Send text message (with optional `language` field) |
| `/api/session/[id]/voice` | POST | `/api/v1/sessions/{id}/voice` | Upload audio → Whisper → pipeline |
| `/api/session/[id]/image` | POST | `/api/v1/sessions/{id}/image` | Upload symptom image |
| `/api/session/[id]/report` | GET | `/api/v1/sessions/{id}/report` | Fetch final reports |
| `/api/session/[id]/report/tts` | GET | `/api/v1/sessions/{id}/report/tts` | Stream TTS audio for original report |
| `/api/session/[id]/report/translate` | POST | `/api/v1/sessions/{id}/report/translate` | Translate patient report to target language |
| `/api/session/[id]/report/translate/tts` | POST | `/api/v1/sessions/{id}/report/translate/tts` | Stream TTS audio for translated report text |

### BFF Proxy Pattern

```typescript
// src/app/api/session/[id]/message/route.ts
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const res = await fetch(`${process.env.BACKEND_URL}/api/v1/sessions/${params.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return Response.json(await res.json());
}
```

---

## 8. Voice Recording Implementation

### Browser Audio Capture (`src/lib/audioRecorder.ts`)

**State machine:** `idle` → `recording` → `processing` → `idle`

```
Patient taps mic button
    │
    ▼
Request microphone permission (navigator.mediaDevices.getUserMedia)
    │
    ▼ (granted)
Start MediaRecorder
  • Chrome/Android: mimeType: 'audio/webm;codecs=opus'
  • Safari/iOS:     mimeType: 'audio/mp4' (fallback)
    │
    ▼
Accumulate chunks via ondataavailable
    │
Patient taps mic again (or 30-second auto-stop)
    │
    ▼
Stop MediaRecorder → assemble Blob from chunks
    │
    ▼
POST FormData to /api/session/[id]/voice
    │
    ▼
BFF forwards to Python → OpenAI Whisper transcribes → text enters pipeline
    │
    ▼
Transcribed text appears as patient message bubble
```

### Hook: `useVoiceRecorder`

```typescript
interface VoiceRecorderReturn {
  status: 'idle' | 'recording' | 'processing' | 'error';
  duration: number;        // Seconds elapsed
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
}
```

**Visual feedback during recording:**
- Pulsing red ring around mic icon
- Seconds counter
- Auto-stop at 30s with haptic feedback (`navigator.vibrate`)

---

## 9. RTL + Multilingual Handling

### Language Configuration

```typescript
// src/lib/constants.ts
export const LANGUAGES = {
  en: { name: 'English',   nativeName: 'English',   flag: 'en', dir: 'ltr', font: 'font-sans' },
  fr: { name: 'French',    nativeName: 'Francais',  flag: 'fr', dir: 'ltr', font: 'font-sans' },
  ja: { name: 'Japanese',  nativeName: '日本語',     flag: 'ja', dir: 'ltr', font: 'font-jp' },
  ar: { name: 'Arabic',    nativeName: 'العربية',    flag: 'ar', dir: 'rtl', font: 'font-arabic' },
  sw: { name: 'Swahili',   nativeName: 'Kiswahili', flag: 'sw', dir: 'ltr', font: 'font-sans' },
  es: { name: 'Spanish',   nativeName: 'Espanol',   flag: 'es', dir: 'ltr', font: 'font-sans' },
} as const;
```

### RTL Strategy

1. **Document-level:** When `language === 'ar'`, set `document.documentElement.dir = 'rtl'`
2. **CSS logical properties:** Use `ms-4` (margin-inline-start) instead of `ml-4` — auto-adapts to direction
3. **Chat alignment:** Patient → `justify-end`, Agent → `justify-start` — auto-flips in RTL
4. **Progress stepper:** `flex-row` in LTR, auto-reverses in RTL via `direction: inherit`
5. **Fonts:** Arabic → `Noto Sans Arabic`, Japanese → `Noto Sans JP`, others → system sans-serif

### What is translated via i18n

| Translated (next-intl) | NOT translated (from backend) |
|------------------------|-------------------------------|
| Button labels ("Send", "Record", "Skip") | Chat messages (already in patient's language) |
| Stage names ("Intake", "Questions") | Report content |
| Error messages | Triage rationale |
| Placeholder text | Facility names |

---

## 10. Accessibility

This application is used by patients under stress, potentially elderly, on inexpensive phones. Accessibility is a safety requirement, not a nice-to-have.

### Touch Targets
- All interactive elements: minimum **48×48px** (WCAG 2.5.8 AAA)
- Mic, camera, send buttons: **56px diameter**
- Spacing between interactive elements: minimum **8px** gap

### Color + Contrast (WCAG AA)
- RED `#DC2626` + white text: 4.6:1 ✓
- YELLOW `#F59E0B` + dark `#1a1a1a` text: 5.2:1 ✓
- GREEN `#16A34A` + white text: 4.5:1 ✓
- **Triage never relies on color alone** — always includes icon + text label

### Screen Reader
- `aria-live="polite"` on stage changes + new chat messages
- `role="alert"` on triage card
- `aria-label` on all icon-only buttons
- Typing indicator: `aria-label="Agent is typing"`

### Motion
- `prefers-reduced-motion`: suppress typing animation, triage card entrance, progress stepper transitions

### Language-Specific
- Japanese: `word-break: normal` + `overflow-wrap: anywhere`
- Arabic: numbers remain LTR (`unicode-bidi: embed` on numeric content)

### Crisis UI
- If backend signals crisis detection → full-screen crisis hotline banner
- Banner cannot be dismissed; includes local emergency numbers
- `role="alertdialog"` for screen readers

---

## 11. Project File Structure

```
ai-health-guide-frontend/
├── package.json
├── tsconfig.json
├── tailwind.config.ts              # RTL, triage colors, large tap sizes
├── next.config.mjs                 # Next.js configuration
├── postcss.config.mjs
├── .env.local                      # BACKEND_URL
│
├── app/
│   ├── layout.tsx                  # Root layout (Geist fonts, metadata)
│   ├── page.tsx                    # Main SPA: showHome → HomePage | session UI
│   ├── globals.css                 # Tailwind base + custom styles
│   │
│   └── api/sessions/              # BFF proxy routes
│       ├── route.ts               # POST: create session
│       └── [id]/
│           ├── route.ts           # GET: poll session state
│           ├── messages/route.ts
│           ├── voice/route.ts
│           ├── image/route.ts
│           ├── language/route.ts
│           ├── location/route.ts
│           ├── skip-location/route.ts
│           └── report/
│               ├── route.ts       # GET: reports
│               ├── tts/route.ts   # GET: TTS audio stream
│               └── translate/
│                   ├── route.ts   # POST: translate report
│                   └── tts/route.ts # POST: translated TTS
│
├── components/
│   ├── home/
│   │   └── HomePage.tsx            # Full landing page (hero, features,
│   │                               #   how-it-works, agent orchestration
│   │                               #   with scenario animation, testimonials,
│   │                               #   about/trust, footer)
│   ├── shell/
│   │   ├── Header.tsx              # Sticky header, stage badge, locale, go-home logo
│   │   ├── StageProgressBar.tsx    # 5-step progress with labels
│   │   └── AgentActivityPanel.tsx  # Real-time agent pipeline status during processing
│   ├── chat/
│   │   ├── ChatWindow.tsx          # Message list, auto-scroll, typing dots
│   │   └── ChatInputBar.tsx        # Text + voice + language switcher
│   ├── stages/
│   │   ├── WelcomeScreen.tsx       # Language cards + disclaimer
│   │   ├── IntakeScreen.tsx        # Loading spinner
│   │   └── ImageUploadScreen.tsx   # Drag-drop + preview + skip
│   ├── triage/
│   │   └── TriageCard.tsx          # RED/YELLOW/GREEN triage display with Listen button
│   ├── report/
│   │   ├── ReportView.tsx          # Patient + clinician tabs, translate section
│   │   ├── NearbyFacilities.tsx    # Geolocation + facility cards + Google Maps directions
│   │   ├── PatientReportDocument.tsx  # PDF component for original report
│   │   └── TranslatedReportDocument.tsx # PDF component for translated report
│   └── ui/
│       ├── Button.tsx              # 4 variants, 3 sizes
│       ├── Card.tsx                # Header/Body/Footer composition
│       ├── Spinner.tsx             # sm/md/lg animated
│       └── TriageBadge.tsx         # Color pill + pulse for RED
│
├── store/
│   └── index.ts                    # useSessionStore (persisted sessionId) +
│                                   #   useUIStore (locale, isRtl, showHome, viewStage)
│
├── hooks/
│   ├── useCreateSession.ts         # Session creation
│   └── useSessionPolling.ts        # 2s interval polling
│
├── lib/
│   ├── proxy.ts                    # BFF request forwarding
│   └── utils.ts                    # cn() — Tailwind class merge
│
├── types/
│   └── session.ts                  # TS mirrors of backend Pydantic models
│
└── messages/                       # i18n translation bundles
    ├── en.json
    ├── fr.json
    ├── es.json
    ├── ar.json
    ├── ja.json
    └── sw.json
```

---

## 12. Care Navigation

The care navigation feature uses **Google Maps Places API** via the Python backend (`google_maps.py`) to find nearby healthcare facilities based on the patient's triage level and GPS coordinates.

### How It Works

1. **NearbyFacilities** component (in ReportView) prompts the patient to share their location
2. `navigator.geolocation.getCurrentPosition()` captures GPS coordinates
3. Coordinates are POSTed to `/api/sessions/{id}/location` → backend calls Google Maps
4. Backend `places_nearby()` searches with triage-aware parameters:
   - **RED**: hospitals with "emergency" keyword, 5km radius
   - **YELLOW**: hospitals/doctors with "urgent care" keyword, 10km radius
   - **GREEN**: doctors/pharmacies with "clinic" keyword, 15km radius
5. Results ranked by composite score: **proximity (0.6) + rating (0.3) + open status (0.1)**
6. `open_now` fallback: tries open facilities first; if none found, searches all facilities
7. Facility cards display name, distance, rating, open status, and an **external Google Maps direction link**
8. Patient can skip location sharing entirely

**Note:** Google Maps Embed API is not used — all direction links open in a new Google Maps tab/app. This avoids Embed API restrictions while still providing navigation.


## 13. Implementation Phases

| Week | Deliverables |
|------|-------------|
| **1** | Next.js scaffold + Tailwind config + TypeScript types mirroring backend models + all UI primitives (Button, Card, Badge, Spinner) + AppHeader/ProgressStepper/Footer + LanguageSelector with 6 languages + i18n setup + static mock screens for all 5 stages |
| **2** | Zustand stores (session + UI) + BFF API routes (session, message, voice) + ClinicalChat with MessageList/MessageBubble/ChatInputBar + polling logic + audioRecorder.ts + VoiceRecordButton with recording UI + end-to-end text + voice flow |
| **3** | ImageUploadButton + imageCompressor.ts + BFF image route + ImageReview component + TriageCard (color-coded, with ListenButton for TTS) |
| **4** | ReportView with tabs + PatientReportCard + ClinicianReportCard (collapsible SOAP) + ListenButton + TTS streaming + PatientReportDocument (PDF) + DisclaimerBanner + TranslateSection + TranslatedReportDocument (PDF) + translated TTS |
| **5** | Full RTL audit (Arabic) + accessibility audit (axe-core + VoiceOver + TalkBack) + Playwright E2E tests + Vitest unit tests + performance optimization (lazy-load Map/PDF) + PWA manifest + error boundaries + crisis detection UI + session timeout handling |

---

## 14. Environment Variables

```env
# .env.local

# Python backend URL
BACKEND_URL=http://localhost:8000

# App
NEXT_PUBLIC_APP_NAME=AI Health Guide
NEXT_PUBLIC_MAX_RECORDING_SECONDS=30
NEXT_PUBLIC_POLL_INTERVAL_MS=1500
```

---

## 15. Disclaimer

> AI Health Guide supports preliminary data collection, care navigation, and language accessibility only. It is not a substitute for professional medical evaluation, diagnosis, or certified medical interpretation.
