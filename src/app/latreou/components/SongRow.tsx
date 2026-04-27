"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Song } from "../lib/types";

interface SongRowProps {
  index: number;
  song: Song;
  onChange: (next: Song) => void;
  onDelete: () => void;
}

export function SongRow({ index, song, onChange, onDelete }: SongRowProps) {
  const idBase = `song-${song.id}`;
  return (
    <div className="rounded-md border border-clay-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-clay-700">
          Song {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Remove song"
          className="text-clay-500 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-title`}>Title</Label>
          <Input
            id={`${idBase}-title`}
            value={song.title}
            onChange={(e) => onChange({ ...song, title: e.target.value })}
            placeholder="e.g. Goodness of God"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idBase}-leader`}>Leader</Label>
          <Input
            id={`${idBase}-leader`}
            value={song.leader}
            onChange={(e) => onChange({ ...song, leader: e.target.value })}
            placeholder="Who's leading this song"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`${idBase}-link`}>YouTube link (optional)</Label>
          <Input
            id={`${idBase}-link`}
            type="url"
            value={song.youtubeLink}
            onChange={(e) =>
              onChange({ ...song, youtubeLink: e.target.value })
            }
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>
      </div>
    </div>
  );
}
