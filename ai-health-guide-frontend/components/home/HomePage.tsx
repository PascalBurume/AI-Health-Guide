"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

interface HomePageProps {
  hasActiveSession: boolean;
  onStartConsultation: () => void;
  onResumeConsultation: () => void;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: "🌍",
    title: "Multilingual Support",
    description:
      "Communicate in 6 languages — English, French, Spanish, Arabic, Japanese, and Swahili — with full RTL support.",
  },
  {
    icon: "🩺",
    title: "Clinical Triage",
    description:
      "AI-powered symptom assessment using ABCDE and ESI protocols to determine the appropriate level of care.",
  },
  {
    icon: "📍",
    title: "Nearby Hospitals",
    description:
      "Find hospitals and clinics near you with real-time availability, distance, and one-tap directions.",
  },
];

const STEPS = [
  { number: "1", icon: "💬", title: "Describe Symptoms", description: "Tell us how you feel in your own words." },
  { number: "2", icon: "🤖", title: "AI Assessment", description: "Our AI asks targeted follow-up questions." },
  { number: "3", icon: "🚦", title: "Triage Level", description: "Receive a clinically-informed urgency level." },
  { number: "4", icon: "📋", title: "Report & Directions", description: "Get a full report and nearby care options." },
];

const TESTIMONIALS = [
  {
    quote: "I was unsure whether to go to the ER at 2 AM. The triage report gave me clarity and likely saved me hours of unnecessary waiting.",
    name: "Maria S.",
    role: "Parent",
    avatar: "👩",
  },
  {
    quote: "Being able to describe my symptoms in French and receive a professional-grade report was incredible. This tool bridges a real gap.",
    name: "Jean-Pierre L.",
    role: "Traveler",
    avatar: "👨",
  },
  {
    quote: "The nearby hospital feature with directions made all the difference when I needed urgent care in an unfamiliar city.",
    name: "Aiko T.",
    role: "Student",
    avatar: "👩‍🎓",
  },
];

const LANGUAGES = ["English", "Français", "Español", "العربية", "日本語", "Kiswahili"];

const AGENTS = [
  {
    id: "safety",
    icon: "🛡️",
    name: "Safety Guardian",
    role: "Cross-cutting Validator",
    description:
      "Monitors every stage — blocks diagnoses, enforces disclaimers, escalates red flags, detects crisis signals.",
    color: "bg-red-500",
  },
  {
    id: "intake",
    icon: "👋",
    name: "Intake Agent",
    role: "Stage 1 — Language & Greeting",
    description:
      "Detects the patient's language, greets them, and collects the chief complaint.",
    color: "bg-blue-500",
  },
  {
    id: "questioning",
    icon: "🩺",
    name: "Questioning Agent",
    role: "Stage 2 — Clinical Interview",
    description:
      "Asks 6–10 ABCDE-structured follow-up questions to assess symptom severity.",
    color: "bg-violet-500",
  },
  {
    id: "visual",
    icon: "👁️",
    name: "Visual Agent",
    role: "Stage 3 — Image Analysis",
    description:
      "Analyzes uploaded images using MedGemma — observes visual features without diagnosing.",
    color: "bg-amber-500",
  },
  {
    id: "triage",
    icon: "🚦",
    name: "Triage Agent",
    role: "Stage 4 — Urgency Classification",
    description:
      "Applies a deterministic ESI matrix to assign RED / YELLOW / GREEN urgency with LLM rationale.",
    color: "bg-emerald-500",
  },
  {
    id: "patient-report",
    icon: "📋",
    name: "Patient Report Agent",
    role: "Stage 5a — Patient Summary",
    description:
      "Generates a plain-language health report with next steps and disclaimer.",
    color: "bg-cyan-500",
  },
  {
    id: "clinician-report",
    icon: "🏥",
    name: "Clinician Report Agent",
    role: "Stage 5b — SOAP Note",
    description:
      "Produces a structured SOAP note for healthcare providers — runs in parallel with the patient report.",
    color: "bg-indigo-500",
  },
];

const SCENARIOS = [
  {
    avatar: "👵",
    name: "Mrs. Chen, 72",
    message: "I have chest tightness and my left arm feels numb since this morning",
    lang: "English",
    outputs: [
      "English detected • Complaint captured",
      "8 questions • Circulation: Abnormal",
      "No image — skipped",
      "🔴 RED — ESI Level 1",
      "Reports + SOAP note ready",
    ],
    triageColor: "red" as const,
    triageLabel: "Emergency",
    triageDesc: "Call emergency services immediately",
  },
  {
    avatar: "👨‍👧",
    name: "David, 34",
    message: "Mon fils a de la fièvre à 38.5°C et tousse depuis hier soir",
    lang: "Français",
    outputs: [
      "Français détecté • Plainte capturée",
      "6 questions • Breathing: Mild cough",
      "No image — skipped",
      "🟡 YELLOW — ESI Level 3",
      "Reports in FR & EN ready",
    ],
    triageColor: "yellow" as const,
    triageLabel: "Urgent Care",
    triageDesc: "Visit urgent care within 4 hours",
  },
  {
    avatar: "👩‍🎓",
    name: "Aiko, 21",
    message: "目がかゆくて赤くなっています。花粉症かもしれません",
    lang: "日本語",
    outputs: [
      "日本語検出 • 主訴を記録",
      "6 questions • Eyes: Itchy, red",
      "📸 Redness observed in photo",
      "🟢 GREEN — ESI Level 5",
      "Reports in JA & EN ready",
    ],
    triageColor: "green" as const,
    triageLabel: "Self-Care",
    triageDesc: "OTC antihistamines recommended",
  },
];

const PIPELINE_NODES = [
  { icon: "👋", label: "Intake", id: "intake" },
  { icon: "🩺", label: "Interview", id: "questioning" },
  { icon: "👁️", label: "Visual", id: "visual" },
  { icon: "🚦", label: "Triage", id: "triage" },
  { icon: "📋", label: "Reports", id: "reports" },
];

const TRIAGE_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  red:    { border: "border-red-200",    bg: "bg-red-50",    text: "text-red-700",    badge: "bg-red-500" },
  yellow: { border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-500" },
  green:  { border: "border-green-200",  bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-500" },
};

/* ------------------------------------------------------------------ */
/*  Animated pipeline visualization — scenario-driven live simulation  */
/* ------------------------------------------------------------------ */

function AgentPipeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [patientVisible, setPatientVisible] = useState(false);
  const [typedLen, setTypedLen] = useState(0);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [doneAgents, setDoneAgents] = useState([false, false, false, false, false]);
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyLabel, setSafetyLabel] = useState("");
  const [resultVisible, setResultVisible] = useState(false);

  const scenario = SCENARIOS[scenarioIdx];

  /* Intersection observer */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Typewriter effect */
  useEffect(() => {
    if (!patientVisible || typedLen >= scenario.message.length) return;
    const t = setTimeout(() => setTypedLen((n) => n + 1), 25);
    return () => clearTimeout(t);
  }, [patientVisible, typedLen, scenario.message.length]);

  /* Main animation loop */
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const after = (ms: number, fn: () => void) => {
      timer = setTimeout(() => { if (!cancelled) fn(); }, ms);
    };

    const reset = () => {
      setPatientVisible(false);
      setTypedLen(0);
      setActiveAgent(-1);
      setDoneAgents([false, false, false, false, false]);
      setSafetyChecking(false);
      setSafetyLabel("");
      setResultVisible(false);
    };

    const processAgent = (idx: number) => {
      if (cancelled) return;
      if (idx > 4) {
        setActiveAgent(-1);
        after(400, () => {
          setResultVisible(true);
          after(4000, () => setScenarioIdx((p) => (p + 1) % SCENARIOS.length));
        });
        return;
      }
      setActiveAgent(idx);
      setSafetyChecking(false);
      setSafetyLabel(PIPELINE_NODES[idx].label);

      after(1200, () => {
        if (cancelled) return;
        setDoneAgents((prev) => { const n = [...prev]; n[idx] = true; return n; });
        setSafetyChecking(true);
        setActiveAgent(-1);
        after(600, () => {
          if (cancelled) return;
          setSafetyChecking(false);
          processAgent(idx + 1);
        });
      });
    };

    reset();
    after(400, () => {
      if (cancelled) return;
      setPatientVisible(true);
      const typeTime = SCENARIOS[scenarioIdx].message.length * 25 + 600;
      after(typeTime, () => { if (!cancelled) processAgent(0); });
    });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [isVisible, scenarioIdx]);

  const ts = TRIAGE_STYLES[scenario.triageColor];

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl">
      {/* ── Patient message bubble ── */}
      <div className={`mb-8 transition-all duration-500 ${
        patientVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-2xl ring-2 ring-blue-100">
            {scenario.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-700">{scenario.name}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                🌐 {scenario.lang}
              </span>
            </div>
            <div className="mt-1.5 inline-block max-w-full rounded-2xl rounded-tl-sm border border-blue-100 bg-blue-50/60 px-4 py-2.5">
              <p className="text-sm text-gray-700 break-words">
                {scenario.message.slice(0, typedLen)}
                {typedLen < scenario.message.length && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-blue-400 align-middle" />
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline nodes ── */}
      <div className="flex items-start justify-between px-1 sm:px-2">
        {PIPELINE_NODES.map((node, i) => {
          const isActive = activeAgent === i;
          const isDone = doneAgents[i];
          const isPending = !isActive && !isDone;

          return (
            <div key={node.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 56 }}>
                {/* Circle */}
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full text-lg transition-all duration-500 sm:h-14 sm:w-14 sm:text-xl ${
                    isActive
                      ? "bg-blue-100 shadow-lg shadow-blue-200/60 scale-110 ring-4 ring-blue-300/50"
                      : isDone
                        ? "bg-green-50 ring-2 ring-green-300/60"
                        : "bg-gray-100 ring-2 ring-gray-200"
                  }`}
                >
                  {isDone ? (
                    <span className="text-base font-bold text-green-500">✓</span>
                  ) : (
                    node.icon
                  )}
                  {isActive && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-blue-300/20" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] font-semibold transition-colors duration-300 sm:text-xs ${
                    isActive ? "text-blue-600" : isDone ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {node.label}
                </span>
                {/* Micro-output */}
                <div className="h-7 flex items-start justify-center">
                  {(isActive || isDone) && (
                    <p
                      className={`max-w-[80px] text-center text-[9px] leading-tight transition-all duration-300 sm:max-w-[100px] ${
                        isActive ? "text-blue-500 animate-pulse" : "text-gray-400"
                      }`}
                    >
                      {scenario.outputs[i]}
                    </p>
                  )}
                </div>
              </div>
              {/* Connector */}
              {i < PIPELINE_NODES.length - 1 && (
                <div
                  className="mx-0.5 h-0.5 w-4 overflow-hidden rounded-full sm:mx-1 sm:w-6 md:w-12 lg:w-20"
                  style={{ marginTop: -16 }}
                >
                  <div
                    className={`h-full w-full rounded-full transition-all duration-700 ${
                      isDone ? "bg-green-300" : isActive ? "bg-blue-300" : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Safety Guardian bar ── */}
      <div
        className={`mt-6 flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 transition-all duration-500 ${
          safetyChecking
            ? "border-green-200 bg-green-50"
            : activeAgent >= 0
              ? "border-blue-100 bg-blue-50/50"
              : "border-gray-100 bg-gray-50"
        }`}
      >
        <span className="text-base">🛡️</span>
        <span
          className={`text-xs font-medium transition-colors duration-300 ${
            safetyChecking
              ? "text-green-600"
              : activeAgent >= 0
                ? "text-blue-500"
                : "text-gray-400"
          }`}
        >
          {safetyChecking
            ? `✓ Safety Guardian — ${safetyLabel} validated`
            : activeAgent >= 0
              ? `Safety Guardian — Checking ${PIPELINE_NODES[activeAgent].label}…`
              : resultVisible
                ? "✓ All stages validated — Report approved"
                : "Safety Guardian — Ready"}
        </span>
        {activeAgent >= 0 && !safetyChecking && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        )}
        {safetyChecking && <span className="text-sm text-green-500">✓</span>}
      </div>

      {/* ── Triage result card ── */}
      <div
        className={`mt-6 transition-all duration-700 ${
          resultVisible
            ? "opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-6"
        }`}
      >
        <div className={`flex items-center gap-4 rounded-xl border p-4 ${ts.border} ${ts.bg}`}>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-md ${ts.badge}`}
          >
            {scenario.triageColor === "red"
              ? "🚨"
              : scenario.triageColor === "yellow"
                ? "⚡"
                : "💚"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${ts.text}`}>{scenario.triageLabel}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${ts.badge}`}
              >
                {scenario.triageColor}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{scenario.triageDesc}</p>
          </div>
          <div className="ml-auto text-xs text-gray-400">✓ Report ready</div>
        </div>
      </div>

      {/* ── Scenario indicator dots ── */}
      <div className="mt-6 flex justify-center gap-2">
        {SCENARIOS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === scenarioIdx ? "w-6 bg-blue-500" : "w-1.5 bg-gray-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const HomePage = ({
  hasActiveSession,
  onStartConsultation,
  onResumeConsultation,
}: HomePageProps) => {
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏥</span>
            <span className="text-lg font-bold text-gray-900">AI Health Guide</span>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveSession && (
              <Button variant="secondary" size="sm" onClick={onResumeConsultation}>
                Resume Consultation
              </Button>
            )}
            <Button size="sm" onClick={onStartConsultation}>
              Start Consultation
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-4xl shadow-lg shadow-blue-200">
            🏥
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Your AI-Powered<br />
            <span className="text-blue-600">Health Guide</span>
          </h1>
          <p className="mb-8 max-w-xl text-lg text-gray-500">
            Describe your symptoms in any language and receive a clinically-informed triage assessment
            with nearby hospital recommendations — all in minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={onStartConsultation} className="px-8 shadow-md shadow-blue-200">
              Start Free Consultation
            </Button>
            <Button variant="secondary" size="lg" onClick={scrollToFeatures}>
              Learn More ↓
            </Button>
          </div>

          {/* Language pills */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {LANGUAGES.map((lang) => (
              <span
                key={lang}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-gray-100"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Features</p>
            <h2 className="text-3xl font-bold text-gray-900">Everything you need, nothing you don&apos;t</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="text-center transition-shadow hover:shadow-md">
                <CardBody className="flex flex-col items-center gap-4 py-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-3xl">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.description}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">How It Works</p>
            <h2 className="text-3xl font-bold text-gray-900">Four simple steps to better care</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative flex flex-col items-center text-center">
                {/* Connector line (desktop only) */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+32px)] top-7 hidden h-0.5 w-[calc(100%-64px)] bg-blue-200 lg:block" />
                )}
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-md shadow-blue-200">
                  {s.icon}
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600 ring-2 ring-blue-600">
                    {s.number}
                  </span>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">{s.title}</h3>
                <p className="text-xs text-gray-500">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Under the Hood — Agent Orchestration ─────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-white py-20">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%233b82f6' stroke-width='.3'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
              Under the Hood
            </p>
            <h2 className="text-3xl font-bold text-gray-900">
              7 Specialized AI Agents Working Together
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-500">
              Watch how a real consultation flows through our coordinated team
              of AI agents — each with a specific clinical role and a Safety
              Guardian validating every step.
            </p>
          </div>

          {/* Live Simulation Panel */}
          <div className="mb-16 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <p className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Live Simulation
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                <span className="text-[10px] font-medium text-green-600">Running</span>
              </div>
            </div>
            <AgentPipeline />
          </div>

          {/* Agent Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {AGENTS.map((agent) => (
              <div
                key={agent.id}
                className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
              >
                {agent.id === "safety" && (
                  <div className="absolute -top-px left-0 right-0 h-0.5 bg-gradient-to-r from-red-400 via-amber-400 to-red-400" />
                )}
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${agent.color} text-xl shadow-md`}
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {agent.name}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                      {agent.role}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">
                  {agent.description}
                </p>
              </div>
            ))}
          </div>

          {/* Architecture callouts */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className="text-xl">🔄</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Safety Retries</p>
                <p className="text-xs text-gray-500">
                  Each agent output is validated. Up to 2 retries with
                  corrective feedback if safety rules are violated.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Parallel Reports
                </p>
                <p className="text-xs text-gray-500">
                  Patient and clinician reports generate simultaneously —
                  cutting wait time in half.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className="text-xl">🚨</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Crisis Detection
                </p>
                <p className="text-xs text-gray-500">
                  Every patient message is screened for crisis signals before
                  any clinical processing begins.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">Testimonials</p>
            <h2 className="text-3xl font-bold text-gray-900">Trusted by users worldwide</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="transition-shadow hover:shadow-md">
                <CardBody className="flex flex-col gap-4 py-6">
                  <div className="flex gap-1 text-yellow-400">★★★★★</div>
                  <p className="text-sm italic text-gray-600">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-auto flex items-center gap-3 border-t border-gray-100 pt-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">
                      {t.avatar}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / Trust ───────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mb-8 flex justify-center gap-6 text-4xl">
            <span>🔒</span>
            <span>🩺</span>
            <span>🌐</span>
          </div>
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Built with care & safety first</h2>
          <p className="mb-6 text-gray-500">
            AI Health Guide uses clinically-validated triage protocols (ABCDE & ESI-5) to assess symptom urgency.
            Your data is processed in-session and never stored beyond your consultation.
            Available in 6 languages with full right-to-left support.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Important:</strong> This tool does <strong>not</strong> replace professional medical advice,
              diagnosis, or treatment. In an emergency, call your local emergency services immediately.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏥</span>
              <span className="font-bold text-gray-900">AI Health Guide</span>
            </div>
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} AI Health Guide. For informational purposes only — not a substitute for professional medical care.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Resume Banner (floating) ────────────────────────────── */}
      {hasActiveSession && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-full border border-blue-200 bg-white px-5 py-3 shadow-lg shadow-blue-100/50">
            <div className="flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">You have an active consultation</p>
            <button
              onClick={onResumeConsultation}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Resume →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
