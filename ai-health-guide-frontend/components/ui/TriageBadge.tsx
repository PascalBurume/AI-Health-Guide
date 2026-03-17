import * as React from "react";
import { TriageColor } from "@/types/session";
import { cn } from "@/lib/utils";

const colorMap: Record<TriageColor, { bg: string; text: string; ring: string; label: string }> = {
  RED: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-300",
    label: "Emergency",
  },
  YELLOW: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-300",
    label: "Urgent",
  },
  GREEN: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-300",
    label: "Non-urgent",
  },
};

interface TriageBadgeProps {
  color: TriageColor;
  showLabel?: boolean;
  className?: string;
}

export const TriageBadge = ({
  color,
  showLabel = true,
  className,
}: TriageBadgeProps) => {
  const c = colorMap[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1",
        c.bg,
        c.text,
        c.ring,
        className
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          color === "RED"
            ? "bg-red-500 animate-pulse"
            : color === "YELLOW"
            ? "bg-amber-500"
            : "bg-emerald-500"
        )}
      />
      {showLabel ? c.label : color}
    </span>
  );
};
