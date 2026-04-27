"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  ExternalLink,
  Lightbulb,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { SongSuggestion } from "../lib/types";
import {
  createSuggestion,
  deleteSuggestion,
  restoreSuggestion,
  subscribeSuggestions,
} from "../lib/song-suggestions";

interface SongSuggestionsTabProps {
  isLead: boolean;
}

function formatCreated(d: Date | null): string {
  if (!d) return "—";
  try {
    return format(d, "d MMM yyyy");
  } catch {
    return "—";
  }
}

export function SongSuggestionsTab({ isLead }: SongSuggestionsTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState<SongSuggestion[]>([]);
  const [archived, setArchived] = useState<SongSuggestion[]>([]);
  const [openLoading, setOpenLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(true);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SongSuggestion | null>(null);

  useEffect(() => {
    setOpenLoading(true);
    const unsub = subscribeSuggestions(
      "open",
      (rows) => {
        setOpen(rows);
        setOpenLoading(false);
      },
      () => setOpenLoading(false)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setArchivedLoading(true);
    const unsub = subscribeSuggestions(
      "archived",
      (rows) => {
        setArchived(rows);
        setArchivedLoading(false);
      },
      () => setArchivedLoading(false)
    );
    return () => unsub();
  }, []);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const handleSubmit = async () => {
    if (!userData || !canSubmit) return;
    setSubmitting(true);
    try {
      await createSuggestion({
        title,
        youtubeLink: link,
        suggestedBy: userData.id,
        suggestedByName: userData.name,
      });
      setTitle("");
      setLink("");
      setSubmitOpen(false);
      toast({
        title: "Song suggested",
        description: "Your suggestion has been added to the list.",
      });
    } catch (err) {
      console.error("Failed to submit song suggestion", err);
      toast({
        title: "Couldn't submit",
        description:
          "Something went wrong sending your suggestion. Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (s: SongSuggestion) => {
    try {
      await restoreSuggestion(s.id);
      toast({
        title: "Suggestion restored",
        description: `"${s.title}" is back in the open list.`,
      });
    } catch (err) {
      console.error("Failed to restore suggestion", err);
      toast({
        title: "Couldn't restore",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSuggestion(deleteTarget.id);
      toast({
        title: "Suggestion removed",
        description: `"${deleteTarget.title}" has been deleted.`,
      });
    } catch (err) {
      console.error("Failed to delete suggestion", err);
      toast({
        title: "Couldn't delete",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const renderRow = (s: SongSuggestion, archivedRow: boolean) => (
    <li
      key={s.id}
      className="flex flex-col gap-2 rounded-md border border-clay-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-clay-700">{s.title || "Untitled"}</p>
          {archivedRow && s.pickedForCycle ? (
            <Badge variant="secondary" className="text-xs">
              Picked for {s.pickedForCycle}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-clay-500">
          Suggested by {s.suggestedByName || "—"}
          {s.createdAt ? ` · ${formatCreated(s.createdAt)}` : ""}
        </p>
        {s.youtubeLink ? (
          <a
            href={s.youtubeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open link
          </a>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {archivedRow && isLead ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleRestore(s)}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Restore
          </Button>
        ) : null}
        {isLead ||
        (!archivedRow && userData && s.suggestedBy === userData.id) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(s)}
            className="text-clay-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-gold-dark">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Song suggestions</CardTitle>
              <p className="mt-1 text-sm text-clay-500">
                Suggest songs for the next worship cycle. The lead picks from
                the open list when preparing the document.
              </p>
            </div>
          </div>
          <Button type="button" variant="gold" onClick={() => setSubmitOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Suggest a song
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">
                Open
                {open.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-clay-100 px-1.5 py-0.5 text-xs text-clay-700">
                    {open.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="archived">
                <Archive className="mr-1 h-4 w-4" />
                Archive
                {archived.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-clay-100 px-1.5 py-0.5 text-xs text-clay-700">
                    {archived.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-4">
              {openLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : open.length === 0 ? (
                <div className="rounded-md border border-dashed border-clay-200 bg-clay-50 p-6 text-center text-sm text-clay-500">
                  No open suggestions yet. Be the first to suggest a song.
                </div>
              ) : (
                <ul className="space-y-2">
                  {open.map((s) => renderRow(s, false))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="archived" className="mt-4">
              {archivedLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : archived.length === 0 ? (
                <div className="rounded-md border border-dashed border-clay-200 bg-clay-50 p-6 text-center text-sm text-clay-500">
                  Nothing archived yet. Songs land here once the lead picks
                  them for a cycle.
                </div>
              ) : (
                <ul className="space-y-2">
                  {archived.map((s) => renderRow(s, true))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a song</DialogTitle>
            <DialogDescription>
              Share a song you&apos;d like the team to consider for the next
              cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-title">Song title</Label>
              <Input
                id="suggestion-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Goodness of God"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-link">Link (optional)</Label>
              <Input
                id="suggestion-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubmitOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this suggestion?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.title}" will be permanently removed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
