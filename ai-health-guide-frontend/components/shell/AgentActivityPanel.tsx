"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import type { Stage, SafetyCheckResult } from "@/types/session";

interface AgentStep {
  id: string;
  icon: string;
  name: string;
  activeLabel: string;
  doneLabel: string;
}

const AGENT_PIPELINE: AgentStep[] = [
  { id: "visual",  icon: "👁️", name: "Visual Agent",    activeLabel: "Analyzing image…",            doneLabel: "Image analyzed" },
  { id: "triage",  icon: "🚦", name: "Triage Agent",    activeLabel: "Classifying urgency…",        doneLabel: "Urgency classified" },
  { id: "report",  icon: "📋", name: "Report Agents",   activeLabel: "Generating reports…",         doneLabel: "Reports ready" },
];

interface AgentActivityPanelProps {
  currentStage: Stage;
  hasTriage: boolean;
  hasReport: boolean;
  safetyChecks: SafetyCheckResult[];
}

export const AgentActivityPanel = ({
  currentStage,
  hasTriage,
  hasReport,
  safetyChecks,
}: AgentActivityPanelProps) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getStepStatus = (step: AgentStep): "done" | "active" | "pending" => {
    if (step.id === "visual") {
      if (["triage", "report", "complete"].includes(currentStage)) return "done";
      if (currentStage === "visual") return "active";
      return "pending";
    }
    if (step.id === "triage") {
      if (hasTriage) return "done";
      if (currentStage === "triage") return "active";
      return "pending";
    }
    if (step.id === "report") {
      if (hasReport) return "done";
      if (currentStage === "report") return "active";
      return "pending";
    }
    return "pending";
  };

  const latestSafetyCheck = safetyChecks.length > 0 ? safetyChecks[safetyChecks.length - 1] : null;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="text-sm">🤖</span>
        <p className="text-xs font-semibold text-gray-700">Agent Pipeline</p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-0">
        {AGENT_PIPELINE.map((step) => {
          const status = getStepStatus(step);
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                status === "active" ? "bg-blue-50" : ""
              }`}
            >
              {/* Status indicator */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm">
                {status === "done" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
                ) : status === "active" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                    {step.icon}
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs">
                    {step.icon}
                  </span>
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${
                  status === "active" ? "text-blue-700" :
                  status === "done" ? "text-green-700" :
                  "text-gray-400"
                }`}>
                  {step.name}
                </p>
                <p className={`text-[10px] ${
                  status === "active" ? "text-blue-500" :
                  status === "done" ? "text-green-500" :
                  "text-gray-300"
                }`}>
                  {status === "active" ? step.activeLabel + dots :
                   status === "done" ? step.doneLabel :
                   "Waiting"}
                </p>
              </div>

              {/* Spinner for active */}
              {status === "active" && <Spinner size="sm" />}
            </div>
          );
        })}
      </div>

      {/* Safety Guardian status */}
      <div className={`flex items-center gap-2 px-4 py-2.5 ${
        latestSafetyCheck?.approved
          ? "bg-green-50 border-t border-green-100"
          : "bg-gray-50 border-t border-gray-100"
      }`}>
        <span className="text-sm">🛡️</span>
        <p className={`text-[10px] font-medium ${
          latestSafetyCheck?.approved ? "text-green-600" : "text-gray-500"
        }`}>
          {latestSafetyCheck
            ? latestSafetyCheck.approved
              ? `Safety Guardian — ${latestSafetyCheck.stage} validated`
              : `Safety Guardian — reviewing ${latestSafetyCheck.stage}`
            : "Safety Guardian — monitoring all stages"
          }
        </p>
      </div>
    </div>
  );
};
