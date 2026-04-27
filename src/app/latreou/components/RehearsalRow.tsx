"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Rehearsal } from "../lib/types";

interface RehearsalRowProps {
  rehearsal: Rehearsal;
  index: number;
  onChange: (next: Rehearsal) => void;
  onDelete: () => void;
}

export function RehearsalRow({
  rehearsal,
  index,
  onChange,
  onDelete,
}: RehearsalRowProps) {
  const idBase = `rehearsal-${rehearsal.id}`;
  return (
    <div className="rounded-md border border-clay-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-clay-700">
          Rehearsal {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Remove rehearsal"
          className="text-clay-500 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-date`}>Date</Label>
          <Input
            id={`${idBase}-date`}
            type="date"
            value={rehearsal.date}
            onChange={(e) => onChange({ ...rehearsal, date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-time`}>Time</Label>
          <Input
            id={`${idBase}-time`}
            type="time"
            value={rehearsal.time}
            onChange={(e) => onChange({ ...rehearsal, time: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-location`}>Location</Label>
          <Input
            id={`${idBase}-location`}
            value={rehearsal.location}
            onChange={(e) =>
              onChange({ ...rehearsal, location: e.target.value })
            }
            placeholder="e.g. Sanctuary"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-coordinator`}>Coordinator</Label>
          <Input
            id={`${idBase}-coordinator`}
            value={rehearsal.coordinator}
            onChange={(e) =>
              onChange({ ...rehearsal, coordinator: e.target.value })
            }
            placeholder="Who's running this rehearsal"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`${idBase}-focus`}>Focus</Label>
          <Input
            id={`${idBase}-focus`}
            value={rehearsal.focus}
            onChange={(e) => onChange({ ...rehearsal, focus: e.target.value })}
            placeholder="e.g. Vocals & harmonies"
          />
        </div>
      </div>
    </div>
  );
}
