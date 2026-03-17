"use client";

import { useSessionStore, useUIStore } from "@/store";
import type { Stage } from "@/types/session";
import { cn } from "@/lib/utils";

const STAGES: { key: Stage; label: string; icon: string }[] = [
  { key: "intake", label: "Intake", icon: "1" },
  { key: "questioning", label: "Assessment", icon: "2" },
  { key: "triage", label: "Triage", icon: "3" },
  { key: "report", label: "Report", icon: "4" },
  { key: "complete", label: "Done", icon: "✓" },
];

const STAGE_ORDER: Stage[] = STAGES.map((s) => s.key);

function stageIndex(stage: Stage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

interface StageProgressBarProps {
  currentStage: Stage | string;
}

export const StageProgressBar = ({ currentStage }: StageProgressBarProps) => {
  const session = useSessionStore((s) => s.session);
  const setViewStage = useUIStore((s) => s.setViewStage);
  const currentIdx = stageIndex(currentStage as Stage);

  const questioningTurns = session?.questioning_turns ?? 0;
  const maxQuestions = 10; // matches backend MAX_QUESTIONS
  const isQuestioning = currentStage === "questioning";

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-2">
      <div className="mx-auto flex max-w-2xl items-start gap-1">
        {STAGES.map((s, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const canClick = isCompleted;

          return (
            <div key={s.key} className="flex flex-1 items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <button
                  disabled={!canClick}
                  onClick={() => canClick && setViewStage(s.key)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    isCompleted && "bg-blue-600 text-white cursor-pointer hover:bg-blue-700",
                    isCurrent && "bg-blue-100 text-blue-700 ring-2 ring-blue-400",
                    isFuture && "bg-gray-100 text-gray-400",
                  )}
                  title={canClick ? `View ${s.label}` : s.label}
                >
                  {isCompleted ? "✓" : s.icon}
                </button>
                <span
                  className={cn(
                    "mt-1 text-[10px] font-medium leading-tight",
                    isCompleted && "text-blue-600",
                    isCurrent && "text-blue-700",
                    isFuture && "text-gray-400",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {/* Connector line — aligned with circle center */}
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "mx-1 mt-3.5 h-0.5 flex-1 rounded-full",
                    i < currentIdx ? "bg-blue-500" : "bg-gray-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Question progress indicator */}
      {isQuestioning && (
        <div className="mx-auto mt-2 max-w-2xl">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Question {questioningTurns} of {maxQuestions}</span>
            <span>{Math.round((questioningTurns / maxQuestions) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min((questioningTurns / maxQuestions) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
