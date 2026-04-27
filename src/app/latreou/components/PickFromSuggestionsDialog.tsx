"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { Song, SongSuggestion } from "../lib/types";
import { newId } from "../lib/empty-cycle";
import {
  archiveSuggestion,
  fetchSuggestions,
} from "../lib/song-suggestions";

interface PickFromSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleName: string;
  targetLabel: string;
  onPicked: (songs: Song[]) => void;
}

export function PickFromSuggestionsDialog({
  open,
  onOpenChange,
  cycleName,
  targetLabel,
  onPicked,
}: PickFromSuggestionsDialogProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SongSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    let cancelled = false;
    fetchSuggestions("open")
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        console.error("Failed to load song suggestions", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedRows.length === 0) return;
    setWorking(true);
    try {
      const songs: Song[] = selectedRows.map((s) => ({
        id: newId(),
        title: s.title,
        leader: "",
        youtubeLink: s.youtubeLink,
      }));
      await Promise.all(
        selectedRows.map((s) =>
          archiveSuggestion(s.id, cycleName || "Untitled cycle")
        )
      );
      onPicked(songs);
      toast({
        title: `${songs.length} song${songs.length === 1 ? "" : "s"} added`,
        description: `Moved to ${targetLabel} and archived from suggestions.`,
      });
    } catch (err) {
      console.error("Failed to pick suggestions", err);
      toast({
        title: "Couldn't add suggestions",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick from suggestions</DialogTitle>
          <DialogDescription>
            Add songs to {targetLabel}. Picked songs are archived from the open
            list. You can assign a leader after they&apos;re added.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-clay-200 bg-clay-50 p-6 text-center text-sm text-clay-500">
            No open suggestions yet. Members can suggest songs from the Song
            Suggestions tab.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((s) => {
              const isSelected = selected.has(s.id);
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-md border border-clay-200 bg-white p-3"
                >
                  <Checkbox
                    id={`pick-${s.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggle(s.id)}
                    className="mt-1"
                  />
                  <label
                    htmlFor={`pick-${s.id}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="font-semibold text-clay-700">
                      {s.title || "Untitled"}
                    </p>
                    <p className="text-xs text-clay-500">
                      Suggested by {s.suggestedByName || "—"}
                    </p>
                    {s.youtubeLink ? (
                      <a
                        href={s.youtubeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open link
                      </a>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={working}
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={handleConfirm}
            disabled={selectedRows.length === 0 || working}
          >
            {working
              ? "Adding..."
              : `Add ${selectedRows.length} song${
                  selectedRows.length === 1 ? "" : "s"
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
