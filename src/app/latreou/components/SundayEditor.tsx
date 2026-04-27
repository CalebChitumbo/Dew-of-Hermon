"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Song, SundayPlan } from "../lib/types";
import { emptySong } from "../lib/empty-cycle";
import { SongRow } from "./SongRow";

interface SundayEditorProps {
  title: string;
  description?: string;
  value: SundayPlan;
  onChange: (next: SundayPlan) => void;
  dateLabel: string;
}

export function SundayEditor({
  title,
  description,
  value,
  onChange,
  dateLabel,
}: SundayEditorProps) {
  const updateSession = (
    key: "session1" | "session2",
    next: Song[]
  ) => {
    onChange({ ...value, [key]: next });
  };

  const addSong = (key: "session1" | "session2") => {
    updateSession(key, [...value[key], emptySong()]);
  };

  const renderSession = (
    key: "session1" | "session2",
    label: string,
    helper: string
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-clay-700">{label}</h3>
          <p className="text-xs text-clay-500">{helper}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addSong(key)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add song
        </Button>
      </div>
      {value[key].length === 0 ? (
        <div className="rounded-md border border-dashed border-clay-200 bg-clay-50 p-6 text-center text-sm text-clay-500">
          No songs yet. Click &ldquo;Add song&rdquo; to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {value[key].map((song, idx) => (
            <SongRow
              key={song.id}
              index={idx}
              song={song}
              onChange={(next) =>
                updateSession(
                  key,
                  value[key].map((s) => (s.id === song.id ? next : s))
                )
              }
              onDelete={() =>
                updateSession(
                  key,
                  value[key].filter((s) => s.id !== song.id)
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className="text-sm text-clay-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor={`${title}-date`}>{dateLabel}</Label>
          <Input
            id={`${title}-date`}
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            className="max-w-xs"
          />
        </div>

        {renderSession(
          "session1",
          "Session 1",
          "Typically the praise / opening set"
        )}
        {renderSession(
          "session2",
          "Session 2",
          "Typically the worship / response set"
        )}

        <div className="space-y-3 rounded-md border border-clay-100 bg-clay-50 p-4">
          <h3 className="text-base font-semibold text-clay-700">Special item</h3>
          <p className="text-xs text-clay-500">
            Performance, item, or piece outside the regular session flow.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${title}-special-title`}>Title</Label>
              <Input
                id={`${title}-special-title`}
                value={value.specialItem.title}
                onChange={(e) =>
                  onChange({
                    ...value,
                    specialItem: {
                      ...value.specialItem,
                      title: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Worship medley"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${title}-special-resp`}>Responsible</Label>
              <Input
                id={`${title}-special-resp`}
                value={value.specialItem.responsible}
                onChange={(e) =>
                  onChange({
                    ...value,
                    specialItem: {
                      ...value.specialItem,
                      responsible: e.target.value,
                    },
                  })
                }
                placeholder="Who's leading the special item"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
