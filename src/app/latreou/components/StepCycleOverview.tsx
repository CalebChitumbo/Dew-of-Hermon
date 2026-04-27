"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LatreouCycle } from "../lib/types";

interface StepCycleOverviewProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
}

export function StepCycleOverview({ cycle, onPatch }: StepCycleOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle overview</CardTitle>
        <p className="text-sm text-clay-500">
          The title-page details for the document your team will receive.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cycleName">Cycle period</Label>
          <Input
            id="cycleName"
            value={cycle.cycleName}
            onChange={(e) => onPatch({ cycleName: e.target.value })}
            placeholder="e.g. March – April 2026"
          />
          <p className="text-xs text-clay-500">
            How the cycle should be labelled on the cover page.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preparedBy">Prepared by</Label>
          <Input
            id="preparedBy"
            value={cycle.preparedBy}
            onChange={(e) => onPatch({ preparedBy: e.target.value })}
            placeholder="Your full name"
          />
        </div>
      </CardContent>
    </Card>
  );
}
