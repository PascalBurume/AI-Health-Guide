"use client";

import { Header } from "@/components/shell/Header";
import { StageProgressBar } from "@/components/shell/StageProgressBar";
import { HomePage } from "@/components/home/HomePage";
import { WelcomeScreen } from "@/components/stages/WelcomeScreen";
import { ImageUploadScreen } from "@/components/stages/ImageUploadScreen";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { TriageCard } from "@/components/triage/TriageCard";
import { ReportView } from "@/components/report/ReportView";
import { AgentActivityPanel } from "@/components/shell/AgentActivityPanel";
import { Spinner } from "@/components/ui/Spinner";
import { useSessionStore, useUIStore } from "@/store";
import { useCreateSession } from "@/hooks/useCreateSession";
import { useSessionPolling } from "@/hooks/useSessionPolling";
import { useEffect, useRef } from "react";

export default function Home() {
  const session    = useSessionStore((s) => s.session);
  const sessionId  = useSessionStore((s) => s.sessionId);
  const isLoading  = useSessionStore((s) => s.isLoading);
  const error      = useSessionStore((s) => s.error);
  const setSession = useSessionStore((s) => s.setSession);
  const isRtl      = useUIStore((s) => s.isRtl);
  const viewStage  = useUIStore((s) => s.viewStage);
  const setViewStage = useUIStore((s) => s.setViewStage);
  const showHome   = useUIStore((s) => s.showHome);
  const setShowHome = useUIStore((s) => s.setShowHome);

  const { createSession, isCreating } = useCreateSession();
  const clearSession = useSessionStore((s) => s.clearSession);

  const handleNewConsultation = () => {
    setViewStage(null);
    clearSession();
    setShowHome(true);
  };

  const handleGoHome = () => {
    setShowHome(true);
  };

  useSessionPolling(sessionId);

  const realStage = session?.current_stage ?? "intake";
  const stage     = viewStage ?? realStage;
  const history   = session?.conversation_history ?? [];

  // Reset viewStage when the real backend stage advances
  const prevRealStage = useRef(realStage);
  useEffect(() => {
    if (realStage !== prevRealStage.current) {
      prevRealStage.current = realStage;
      setViewStage(null);
    }
  }, [realStage, setViewStage]);

  const isAgentTyping =
    history.length > 0 &&
    history[history.length - 1].role === "patient" &&
    ["intake", "questioning"].includes(stage);

  const refreshSession = async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) setSession(await res.json());
  };

  // Show home page
  if (showHome) {
    return (
      <HomePage
        hasActiveSession={!!sessionId && !!session}
        onStartConsultation={() => setShowHome(false)}
        onResumeConsultation={() => setShowHome(false)}
      />
    );
  }

  // No session yet — show welcome / language selection
  if (!sessionId || !session) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"}>
        <Header stage="intake" onGoHome={handleGoHome} />
        <main className="mx-auto max-w-2xl p-4">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
          )}
          <WelcomeScreen onStart={createSession} isLoading={isCreating} />
        </main>
      </div>
    );
  }

  if (isLoading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-gray-50">
      <Header stage={stage} onNewConsultation={handleNewConsultation} onGoHome={handleGoHome} />
      <StageProgressBar currentStage={realStage} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        {/* Image upload prompt (only on real questioning stage) */}
        {stage === "questioning" && session.questioning_complete && !session.image_data && !viewStage && (
          <div className="px-4 pt-4">
            <ImageUploadScreen sessionId={sessionId} onUploaded={refreshSession} onSkip={refreshSession} />
          </div>
        )}
        {/* Triage card (visible when viewing triage/report stages) */}
        {session.triage && ["triage", "report", "complete"].includes(stage) && (
          <div className="px-4 pt-4">
            <TriageCard triage={session.triage} sessionId={sessionId} />
          </div>
        )}
        {/* Agent activity panel while triage/reports are generating */}
        {(["triage", "visual"].includes(realStage) && !session.triage && !viewStage) || 
         (realStage === "report" && !session.patient_report && !viewStage) ? (
          <AgentActivityPanel
            currentStage={realStage}
            hasTriage={!!session.triage}
            hasReport={!!session.patient_report}
            safetyChecks={session.safety_checks ?? []}
          />
        ) : null}
        {/* Full report (visible when viewing report/complete) */}
        {["report", "complete"].includes(stage) && session.patient_report && (
          <div className="overflow-y-auto px-4 pt-4 pb-4">
            <ReportView
              sessionId={sessionId}
              patientReport={session.patient_report}
              clinicianReport={session.clinician_report}
              triageColor={session.triage?.color ?? null}
              facilities={session.facilities ?? []}
              directions={session.directions ?? null}
              patientLocation={session.patient_location ?? null}
              onUpdated={refreshSession}
            />
          </div>
        )}
        {/* Chat + input for conversation stages */}
        {["intake", "questioning"].includes(stage) && (
          <ChatWindow messages={history} isTyping={isAgentTyping} />
        )}
        {["intake", "questioning"].includes(stage) && (
          <ChatInputBar
            sessionId={sessionId}
            onMessageSent={refreshSession}
            disabled={!!viewStage || realStage === "triage"}
          />
        )}
      </main>
    </div>
  );
}
