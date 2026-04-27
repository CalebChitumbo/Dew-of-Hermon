"use client";

import type { LatreouCycle } from "../lib/types";
import { SundayEditor } from "./SundayEditor";

interface StepSecondSundayProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
}

export function StepSecondSunday({ cycle, onPatch }: StepSecondSundayProps) {
  return (
    <SundayEditor
      title="Second Sunday"
      description="Plan the songs and special item for the closing Sunday of the cycle."
      dateLabel="Second Sunday date"
      value={cycle.secondSunday}
      onChange={(next) => onPatch({ secondSunday: next })}
    />
  );
}
