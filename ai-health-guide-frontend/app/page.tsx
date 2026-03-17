"use client";

import { Header } from "@/components/shell/Header";
import { StageProgressBar } from "@/components/shell/StageProgressBar";
import { WelcomeScreen } from "@/components/stages/WelcomeScreen";
import { ImageUploadScreen } from "@/components/stages/ImageUploadScreen";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { TriageCard } from "@/components/triage/TriageCard";
import { ReportView } from "@/components/report/ReportView";
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

  const { createSession, isCreating } = useCreateSession();
  const clearSession = useSessionStore((s) => s.clearSession);

  const handleNewConsultation = () => {
    setViewStage(null);
    clearSession();
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

  if (!sessionId || !session) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"}>
        <Header stage="intake" />
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
      <Header stage={stage} onNewConsultation={handleNewConsultation} />
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
        {/* Processing spinner while triage/reports are generating */}
        {["triage", "visual"].includes(realStage) && !session.triage && !viewStage && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-8 mx-4 mt-4 text-center">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-blue-700">Analyzing your symptoms and generating assessment…</p>
            <p className="text-xs text-blue-500">This may take up to 30 seconds</p>
          </div>
        )}
        {/* Report generation spinner */}
        {realStage === "report" && !session.patient_report && !viewStage && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-8 mx-4 mt-4 text-center">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-blue-700">Generating your health report…</p>
            <p className="text-xs text-blue-500">Almost done</p>
          </div>
        )}
        {/* Full report (visible when viewing report/complete) */}
        {["report", "complete"].includes(stage) && session.patient_report && (
          <div className="overflow-y-auto px-4 pt-4 pb-4">
            <ReportView
              sessionId={sessionId}
              patientReport={session.patient_report}
              clinicianReport={session.clinician_report}
              triageColor={session.triage?.color ?? null}
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
