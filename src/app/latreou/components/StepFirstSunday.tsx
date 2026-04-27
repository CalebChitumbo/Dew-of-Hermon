"use client";

import type { LatreouCycle } from "../lib/types";
import { SundayEditor } from "./SundayEditor";

interface StepFirstSundayProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
  canPickSuggestions: boolean;
}

export function StepFirstSunday({
  cycle,
  onPatch,
  canPickSuggestions,
}: StepFirstSundayProps) {
  return (
    <SundayEditor
      title="First Sunday"
      description="Plan the songs and special song for the opening Sunday of the cycle."
      dateLabel="First Sunday date"
      value={cycle.firstSunday}
      onChange={(next) => onPatch({ firstSunday: next })}
      cycleName={cycle.cycleName}
      canPickSuggestions={canPickSuggestions}
      sundayKey="first"
    />
  );
}
