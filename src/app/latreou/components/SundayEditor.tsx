"use client";

import { useState } from "react";
import { ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Song, SundayPlan } from "../lib/types";
import { emptySong } from "../lib/empty-cycle";
import { SongRow } from "./SongRow";
import { PickFromSuggestionsDialog } from "./PickFromSuggestionsDialog";

interface SundayEditorProps {
  title: string;
  description?: string;
  value: SundayPlan;
  onChange: (next: SundayPlan) => void;
  dateLabel: string;
  cycleName: string;
  canPickSuggestions: boolean;
  sundayKey: "first" | "second";
}

export function SundayEditor({
  title,
  description,
  value,
  onChange,
  dateLabel,
  cycleName,
  canPickSuggestions,
  sundayKey,
}: SundayEditorProps) {
  const [pickerSession, setPickerSession] = useState<
    "praise" | "worship" | null
  >(null);

  const updateSession = (
    key: "praise" | "worship",
    next: Song[]
  ) => {
    onChange({ ...value, [key]: next });
  };

  const addSong = (key: "praise" | "worship") => {
    updateSession(key, [...value[key], emptySong()]);
  };

  const renderSession = (
    key: "praise" | "worship",
    label: string,
    helper: string
  ) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-clay-700">{label}</h3>
          <p className="text-xs text-clay-500">{helper}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPickSuggestions ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerSession(key)}
            >
              <ListPlus className="mr-1 h-4 w-4" />
              Pick from suggestions
            </Button>
          ) : null}
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
          "praise",
          "Praise",
          "The praise / opening set"
        )}
        {renderSession(
          "worship",
          "Worship",
          "The worship / response set"
        )}

        <div className="space-y-3 rounded-md border border-clay-100 bg-clay-50 p-4">
          <h3 className="text-base font-semibold text-clay-700">Special Song</h3>
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
                placeholder="Who's leading the special song"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${title}-special-link`}>
                Link (optional)
              </Label>
              <Input
                id={`${title}-special-link`}
                type="url"
                value={value.specialItem.link}
                onChange={(e) =>
                  onChange({
                    ...value,
                    specialItem: {
                      ...value.specialItem,
                      link: e.target.value,
                    },
                  })
                }
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>
        </div>
      </CardContent>

      {canPickSuggestions ? (
        <PickFromSuggestionsDialog
          open={pickerSession !== null}
          onOpenChange={(open) => !open && setPickerSession(null)}
          cycleName={cycleName}
          targetLabel={`${title} · ${
            pickerSession === "praise" ? "Praise" : "Worship"
          }`}
          onPicked={(songs) => {
            if (pickerSession) {
              updateSession(pickerSession, [...value[pickerSession], ...songs]);
            }
            setPickerSession(null);
          }}
        />
      ) : null}
    </Card>
  );
}
