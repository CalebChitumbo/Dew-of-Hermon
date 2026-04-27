"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_LABELS, TOTAL_STEPS } from "../lib/types";

interface ProgressBarProps {
  currentStep: number;
  onSelect: (step: number) => void;
}

export function ProgressBar({ currentStep, onSelect }: ProgressBarProps) {
  const progressPct =
    TOTAL_STEPS <= 1 ? 100 : (currentStep / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative mb-3 h-2 w-full overflow-hidden rounded-full bg-clay-100">
        <div
          className="h-full rounded-full bg-gold transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <ol className="flex w-full items-start justify-between gap-2">
        {STEP_LABELS.map((label, idx) => {
          const isActive = idx === currentStep;
          const isComplete = idx < currentStep;
          return (
            <li key={label} className="flex flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-clay-700 focus:ring-offset-2",
                  isActive &&
                    "border-clay-700 bg-clay-700 text-cream",
                  isComplete &&
                    "border-gold bg-gold text-white hover:bg-gold-dark",
                  !isActive &&
                    !isComplete &&
                    "border-clay-200 bg-white text-clay-500 hover:border-clay-400"
                )}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${idx + 1}: ${label}`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </button>
              <span
                className={cn(
                  "mt-2 hidden text-center text-xs font-medium leading-tight sm:block",
                  isActive ? "text-clay-700" : "text-clay-500"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
