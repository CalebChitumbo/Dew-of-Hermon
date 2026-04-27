"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LatreouCycle } from "../lib/types";

interface StepScripturePrayerProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
}

export function StepScripturePrayer({
  cycle,
  onPatch,
}: StepScripturePrayerProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Anchor scripture</CardTitle>
          <p className="text-sm text-clay-500">
            The verse the team will hold onto for this cycle.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scriptureRef">Reference</Label>
            <Input
              id="scriptureRef"
              value={cycle.scripture.reference}
              onChange={(e) =>
                onPatch({
                  scripture: {
                    ...cycle.scripture,
                    reference: e.target.value,
                  },
                })
              }
              placeholder="e.g. Psalm 34:1–3"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scriptureText">Full text</Label>
            <Textarea
              id="scriptureText"
              value={cycle.scripture.text}
              onChange={(e) =>
                onPatch({
                  scripture: { ...cycle.scripture, text: e.target.value },
                })
              }
              rows={5}
              placeholder="Paste the full scripture text..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prayer direction</CardTitle>
          <p className="text-sm text-clay-500">
            The spiritual focus and prayer emphasis for the cycle.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="prayerDirection" className="sr-only">
              Prayer direction
            </Label>
            <Textarea
              id="prayerDirection"
              value={cycle.prayerDirection}
              onChange={(e) => onPatch({ prayerDirection: e.target.value })}
              rows={6}
              placeholder="What should the team be praying for and meditating on during this cycle?"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
