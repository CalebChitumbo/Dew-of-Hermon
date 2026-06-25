"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { fetchChapter, verseKey, type BibleVerse } from "@/lib/bible/api";
import { getBook } from "@/lib/bible/books";
import type { useBibleBookmarks } from "@/hooks/useBibleBookmarks";
import { BookChapterPicker } from "./BookChapterPicker";
import { VerseList } from "./VerseList";

interface ReaderProps {
  translation: string;
  bookId: number;
  chapter: number;
  focusVerse?: number;
  onNavigate: (bookId: number, chapter: number) => void;
  bookmarks: ReturnType<typeof useBibleBookmarks>;
}

/** Compute the previous/next (book, chapter), wrapping across book edges. */
function step(bookId: number, chapter: number, dir: 1 | -1): [number, number] | null {
  const book = getBook(bookId);
  if (!book) return null;
  if (dir === 1) {
    if (chapter < book.chapters) return [bookId, chapter + 1];
    const next = getBook(bookId + 1);
    return next ? [next.id, 1] : null;
  }
  if (chapter > 1) return [bookId, chapter - 1];
  const prev = getBook(bookId - 1);
  return prev ? [prev.id, prev.chapters] : null;
}

export function Reader({
  translation,
  bookId,
  chapter,
  focusVerse,
  onNavigate,
  bookmarks,
}: ReaderProps) {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const book = getBook(bookId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchChapter(translation, bookId, chapter)
      .then((data) => {
        if (!active) return;
        setVerses(data);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(() => {
        if (!active) return;
        setError("Couldn't load this chapter. Check your connection and try again.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [translation, bookId, chapter]);

  const prev = step(bookId, chapter, -1);
  const next = step(bookId, chapter, 1);

  const isSaved = (verse: number) =>
    bookmarks.byVerseKey.has(verseKey(translation, bookId, chapter, verse));
  const savedColor = (verse: number) =>
    bookmarks.byVerseKey.get(verseKey(translation, bookId, chapter, verse))?.color ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <BookChapterPicker bookId={bookId} chapter={chapter} onSelect={onNavigate} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!prev}
            onClick={() => prev && onNavigate(prev[0], prev[1])}
            aria-label="Previous chapter"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!next}
            onClick={() => next && onNavigate(next[0], next[1])}
            aria-label="Next chapter"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-clay-100 sm:p-7">
        <h2 className="mb-4 font-display text-2xl font-bold text-clay-700">
          {book?.name} {chapter}
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm text-clay-500">{error}</p>
            <Button variant="outline" size="sm" onClick={() => onNavigate(bookId, chapter)}>
              Retry
            </Button>
          </div>
        ) : (
          <VerseList
            verses={verses}
            context={{ translation, bookId, bookName: book?.name ?? "", chapter }}
            isSaved={isSaved}
            savedColor={savedColor}
            onSave={bookmarks.save}
            onRemove={bookmarks.remove}
            focusVerse={focusVerse}
          />
        )}
      </article>

      {!loading && !error && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            disabled={!prev}
            onClick={() => prev && onNavigate(prev[0], prev[1])}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            variant="ghost"
            disabled={!next}
            onClick={() => next && onNavigate(next[0], next[1])}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
