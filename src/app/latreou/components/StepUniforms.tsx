"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LatreouCycle, Uniforms } from "../lib/types";

interface StepUniformsProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
}

export function StepUniforms({ cycle, onPatch }: StepUniformsProps) {
  const update = (key: keyof Uniforms, val: string) => {
    onPatch({ uniforms: { ...cycle.uniforms, [key]: val } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uniforms</CardTitle>
        <p className="text-sm text-clay-500">
          What the team should wear on each Sunday.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-clay-700">First Sunday</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstSundayGents">Gents</Label>
              <Input
                id="firstSundayGents"
                value={cycle.uniforms.firstSundayGents}
                onChange={(e) => update("firstSundayGents", e.target.value)}
                placeholder="e.g. White shirt, black trousers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstSundayLadies">Ladies</Label>
              <Input
                id="firstSundayLadies"
                value={cycle.uniforms.firstSundayLadies}
                onChange={(e) => update("firstSundayLadies", e.target.value)}
                placeholder="e.g. White top, black skirt"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-clay-700">Second Sunday</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="secondSundayGents">Gents</Label>
              <Input
                id="secondSundayGents"
                value={cycle.uniforms.secondSundayGents}
                onChange={(e) => update("secondSundayGents", e.target.value)}
                placeholder="e.g. Cream linen shirt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secondSundayLadies">Ladies</Label>
              <Input
                id="secondSundayLadies"
                value={cycle.uniforms.secondSundayLadies}
                onChange={(e) => update("secondSundayLadies", e.target.value)}
                placeholder="e.g. Cream blouse, beige skirt"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="uniformNotes">Additional notes</Label>
          <Textarea
            id="uniformNotes"
            value={cycle.uniforms.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Footwear, jewellery, accessories, exceptions..."
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
