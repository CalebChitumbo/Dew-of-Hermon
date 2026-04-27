"use client";

import type { LatreouCycle } from "../lib/types";
import { SundayEditor } from "./SundayEditor";

interface StepSecondSundayProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
  canPickSuggestions: boolean;
}

export function StepSecondSunday({
  cycle,
  onPatch,
  canPickSuggestions,
}: StepSecondSundayProps) {
  return (
    <SundayEditor
      title="Second Sunday"
      description="Plan the songs and special song for the closing Sunday of the cycle."
      dateLabel="Second Sunday date"
      value={cycle.secondSunday}
      onChange={(next) => onPatch({ secondSunday: next })}
      cycleName={cycle.cycleName}
      canPickSuggestions={canPickSuggestions}
      sundayKey="second"
    />
  );
}
