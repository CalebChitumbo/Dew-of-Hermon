"use client";

import { BookmarkX, Bookmark } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { useBibleBookmarks, VerseRef } from "@/hooks/useBibleBookmarks";
import { highlightTint } from "./highlight-colors";

interface SavedPanelProps {
  bookmarks: ReturnType<typeof useBibleBookmarks>;
  onOpen: (bookId: number, chapter: number, verse?: number) => void;
}

export function SavedPanel({ bookmarks, onOpen }: SavedPanelProps) {
  const { bookmarks: items, loading, remove } = bookmarks;
  const { toast } = useToast();

  const removeBookmark = async (ref: VerseRef) => {
    try {
      await remove(ref);
      toast({
        title: "Removed",
        description: `${ref.bookName} ${ref.chapter}:${ref.verse}`,
      });
    } catch (err) {
      console.error("bible: remove bookmark failed", err);
      toast({
        title: "Couldn't remove",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved verses yet"
        description="Tap any verse while reading to highlight it or save a bookmark. They'll collect here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((b) => {
        const ref: VerseRef = {
          translation: b.translation,
          bookId: b.bookId,
          bookName: b.bookName,
          chapter: b.chapter,
          verse: b.verse,
          text: b.text,
        };
        return (
          <div
            key={b.id}
            className={cn(
              "flex items-start gap-3 rounded-lg p-4 shadow-sm ring-1 ring-clay-100",
              b.color ? highlightTint[b.color] : "bg-white"
            )}
          >
            <button
              onClick={() => onOpen(b.bookId, b.chapter, b.verse)}
              className="flex-1 text-left"
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                {b.bookName} {b.chapter}:{b.verse}
                <span className="ml-2 font-normal normal-case text-clay-400">
                  {b.translation}
                </span>
              </p>
              <p className="text-clay-700">{b.text}</p>
            </button>
            <button
              onClick={() => removeBookmark(ref)}
              aria-label="Remove bookmark"
              className="shrink-0 text-clay-300 transition-colors hover:text-rose-500"
            >
              <BookmarkX className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
