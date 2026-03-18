"use client";

import { useUIStore } from "@/store";
import type { Stage } from "@/types/session";
import { Button } from "@/components/ui/Button";

const STAGE_LABELS: Record<Stage, string> = {
  intake: "Intake",
  questioning: "Assessment",
  visual: "Image Review",
  triage: "Triage",
  report: "Report",
  complete: "Complete",
};

interface HeaderProps {
  stage: Stage | string;
  onNewConsultation?: () => void;
  onGoHome?: () => void;
}

export const Header = ({ stage, onNewConsultation, onGoHome }: HeaderProps) => {
  const locale = useUIStore((s) => s.locale);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-70"
        >
          <span className="text-xl">🏥</span>
          <h1 className="text-lg font-bold text-gray-900">AI Health Guide</h1>
        </button>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {STAGE_LABELS[stage as Stage] ?? stage}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 uppercase">
          {locale}
        </span>
      </div>
      {onNewConsultation && (
        <Button variant="ghost" size="sm" onClick={onNewConsultation}>
          New consultation
        </Button>
      )}
    </header>
  );
};
