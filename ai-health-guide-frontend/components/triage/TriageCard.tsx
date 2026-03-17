"use client";

import { useState } from "react";
import type { TriageResult } from "@/types/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TriageBadge } from "@/components/ui/TriageBadge";
import { Button } from "@/components/ui/Button";

interface TriageCardProps {
  triage: TriageResult;
  sessionId: string;
}

const URGENCY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  RED:    { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800",    icon: "🚨" },
  YELLOW: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", icon: "⚠️" },
  GREEN:  { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  icon: "✅" },
};

export const TriageCard = ({ triage, sessionId }: TriageCardProps) => {
  const [playing, setPlaying] = useState(false);
  const style = URGENCY_STYLES[triage.color] ?? URGENCY_STYLES.GREEN;

  const playTts = async () => {
    setPlaying(true);
    // Create Audio synchronously inside the click handler so the browser
    // considers the later .play() as user-initiated.
    const audio = new Audio();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report/tts`);
      if (!res.ok) throw new Error("TTS unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-700">Triage Result</p>
          <TriageBadge color={triage.color} />
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {/* Urgency — prominent color-coded banner */}
        <div className={`rounded-lg border p-3 ${style.bg} ${style.border}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Urgency</p>
          <p className={`text-sm font-bold ${style.text}`}>
            {style.icon} {triage.urgency_description}
          </p>
        </div>

        {/* Rationale */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rationale</p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-700">{triage.rationale}</p>
        </div>

        {/* Recommended facility type */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recommended care</p>
          <p className="mt-0.5 text-sm text-gray-700">
            {triage.facility_type_needed.replace(/_/g, " ")}
          </p>
        </div>

        {/* Listen button */}
        <div className="pt-1">
          <Button variant="secondary" size="sm" onClick={playTts} isLoading={playing}>
            🔊 Listen
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
