"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { LatreouCycle, Rehearsal } from "../lib/types";
import { newId } from "../lib/empty-cycle";
import { generateRehearsalSchedule } from "../lib/auto-rehearsals";
import { RehearsalRow } from "./RehearsalRow";

interface StepRehearsalsProps {
  cycle: LatreouCycle;
  onPatch: (patch: Partial<LatreouCycle>) => void;
}

export function StepRehearsals({ cycle, onPatch }: StepRehearsalsProps) {
  const { toast } = useToast();
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  const setRehearsals = (rehearsals: Rehearsal[]) => onPatch({ rehearsals });

  const addRehearsal = () => {
    setRehearsals([
      ...cycle.rehearsals,
      {
        id: newId(),
        date: "",
        time: "",
        location: "",
        coordinator: "",
        focus: "",
      },
    ]);
  };

  const runAutoGenerate = () => {
    if (!cycle.firstSunday.date || !cycle.secondSunday.date) {
      toast({
        title: "Set both Sunday dates first",
        description:
          "The auto-schedule needs the First and Second Sunday dates from steps 2 and 3.",
        variant: "destructive",
      });
      return;
    }
    const generated = generateRehearsalSchedule(
      cycle.firstSunday.date,
      cycle.secondSunday.date
    );
    setRehearsals(generated);
    toast({
      title: "Schedule generated",
      description: `${generated.length} rehearsals added based on your Sunday dates.`,
    });
  };

  const handleAutoClick = () => {
    if (cycle.rehearsals.length > 0) {
      setConfirmReplaceOpen(true);
    } else {
      runAutoGenerate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rehearsal schedule</CardTitle>
        <p className="text-sm text-clay-500">
          Add rehearsals one by one, or auto-generate a standard 11-rehearsal
          schedule from the two Sunday dates.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addRehearsal}>
            <Plus className="mr-1 h-4 w-4" />
            Add rehearsal
          </Button>
          <Button type="button" variant="gold" onClick={handleAutoClick}>
            <Sparkles className="mr-1 h-4 w-4" />
            Auto-generate schedule
          </Button>
        </div>

        {cycle.rehearsals.length === 0 ? (
          <div className="rounded-md border border-dashed border-clay-200 bg-clay-50 p-6 text-center text-sm text-clay-500">
            No rehearsals yet. Add one manually or auto-generate the standard
            schedule.
          </div>
        ) : (
          <div className="space-y-3">
            {cycle.rehearsals.map((rehearsal, idx) => (
              <RehearsalRow
                key={rehearsal.id}
                rehearsal={rehearsal}
                index={idx}
                onChange={(next) =>
                  setRehearsals(
                    cycle.rehearsals.map((r) =>
                      r.id === rehearsal.id ? next : r
                    )
                  )
                }
                onDelete={() =>
                  setRehearsals(
                    cycle.rehearsals.filter((r) => r.id !== rehearsal.id)
                  )
                }
              />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing rehearsals?</DialogTitle>
            <DialogDescription>
              You already have {cycle.rehearsals.length} rehearsal
              {cycle.rehearsals.length === 1 ? "" : "s"}. Auto-generating will
              replace them with the standard 11-rehearsal schedule.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReplaceOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                setConfirmReplaceOpen(false);
                runAutoGenerate();
              }}
            >
              Replace schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
