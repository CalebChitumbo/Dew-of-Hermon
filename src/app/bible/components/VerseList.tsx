"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { BibleVerse } from "@/lib/bible/api";
import type { BibleHighlightColor } from "@/types";
import type { VerseRef } from "@/hooks/useBibleBookmarks";
import {
  HIGHLIGHT_COLORS,
  highlightSwatch,
  highlightTint,
} from "./highlight-colors";

export interface ReaderContext {
  translation: string;
  bookId: number;
  bookName: string;
  chapter: number;
}

interface VerseListProps {
  verses: BibleVerse[];
  context: ReaderContext;
  isSaved: (verse: number) => boolean;
  savedColor: (verse: number) => BibleHighlightColor | null;
  onSave: (ref: VerseRef, color: BibleHighlightColor | null) => void;
  onRemove: (ref: VerseRef) => void;
  /** Verse number to scroll to and briefly flash (e.g. from a reference jump). */
  focusVerse?: number;
}

/**
 * The chapter body: tappable verses with an inline action bar for
 * highlighting, bookmarking, and copying. Highlighted verses keep their tint
 * even when not selected.
 */
export function VerseList({
  verses,
  context,
  isSaved,
  savedColor,
  onSave,
  onRemove,
  focusVerse,
}: VerseListProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Jump to (and momentarily select) a verse requested from elsewhere.
  useEffect(() => {
    if (!focusVerse) return;
    setSelected(focusVerse);
    const el = containerRef.current?.querySelector(`[data-verse="${focusVerse}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusVerse, verses]);

  const refFor = (v: BibleVerse): VerseRef => ({
    translation: context.translation,
    bookId: context.bookId,
    bookName: context.bookName,
    chapter: context.chapter,
    verse: v.verse,
    text: v.text,
  });

  const copyVerse = (v: BibleVerse) => {
    const label = `${context.bookName} ${context.chapter}:${v.verse}`;
    navigator.clipboard
      ?.writeText(`"${v.text}" — ${label} (${context.translation})`)
      .then(() => toast({ title: "Copied", description: label }))
      .catch(() => {});
  };

  return (
    <div ref={containerRef} className="space-y-1 leading-relaxed">
      {verses.map((v) => {
        const saved = isSaved(v.verse);
        const color = savedColor(v.verse);
        const isOpen = selected === v.verse;
        return (
          <div key={v.verse} data-verse={v.verse}>
            <p
              onClick={() => setSelected(isOpen ? null : v.verse)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[1.05rem] text-clay-700 transition-colors",
                color ? highlightTint[color] : "hover:bg-clay-50",
                isOpen && "ring-1 ring-gold/40"
              )}
            >
              <sup className="mr-1.5 select-none text-xs font-semibold text-gold-dark">
                {v.verse}
              </sup>
              {v.text}
              {saved && !color && (
                <BookmarkCheck className="ml-1 inline h-3.5 w-3.5 align-middle text-gold-dark" />
              )}
            </p>

            {isOpen && (
              <div className="mt-1 mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-clay-200">
                <span className="text-xs font-medium text-clay-400">Highlight</span>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={`Highlight ${c}`}
                    onClick={() => {
                      onSave(refFor(v), c);
                      setSelected(null);
                    }}
                    className={cn(
                      "h-5 w-5 rounded-full ring-offset-1 transition hover:scale-110",
                      highlightSwatch[c],
                      color === c && "ring-2 ring-clay-500"
                    )}
                  />
                ))}
                <span className="mx-1 h-4 w-px bg-clay-200" />
                {saved ? (
                  <button
                    onClick={() => {
                      onRemove(refFor(v));
                      setSelected(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onSave(refFor(v), null);
                      setSelected(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-clay-500 hover:text-clay-700"
                  >
                    <Bookmark className="h-3.5 w-3.5" /> Save
                  </button>
                )}
                <button
                  onClick={() => copyVerse(v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-clay-500 hover:text-clay-700"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
