"use client";

import { useState } from "react";
import { Search, BookOpen, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  parseReference,
  searchBible,
  type SearchHit,
} from "@/lib/bible/api";
import { bookName } from "@/lib/bible/books";

interface SearchPanelProps {
  translation: string;
  /** Open a passage in the reader (optionally focusing a verse). */
  onOpen: (bookId: number, chapter: number, verse?: number) => void;
}

export function SearchPanel({ translation, onOpen }: SearchPanelProps) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // A recognised reference (e.g. "John 3:16") offered as a quick jump.
  const [jump, setJump] = useState<ReturnType<typeof parseReference>>(null);

  const runSearch = async () => {
    const q = term.trim();
    if (!q) return;
    setJump(parseReference(q));
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setHits(await searchBible(translation, q));
    } catch {
      setError("Search is unavailable right now. Please try again in a moment.");
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-400" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a word, phrase, or reference (e.g. John 3:16)"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!term.trim() || loading}>
          Search
        </Button>
      </form>

      {jump && (
        <button
          onClick={() => onOpen(jump.bookId, jump.chapter, jump.verse)}
          className="flex w-full items-center gap-3 rounded-lg bg-gold/10 px-4 py-3 text-left transition-colors hover:bg-gold/20"
        >
          <BookOpen className="h-5 w-5 text-gold-dark" />
          <span className="flex-1 font-medium text-clay-700">
            Go to {bookName(jump.bookId)} {jump.chapter}
            {jump.verse ? `:${jump.verse}` : ""}
          </span>
          <ArrowRight className="h-4 w-4 text-gold-dark" />
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <EmptyState icon={Search} title="Couldn't search" description={error} tone="rose" />
      ) : searched && hits.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different word or phrase, or jump straight to a reference."
        />
      ) : hits.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-clay-400">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </p>
          {hits.map((h) => (
            <button
              key={`${h.bookId}-${h.chapter}-${h.verse}`}
              onClick={() => onOpen(h.bookId, h.chapter, h.verse)}
              className="block w-full rounded-lg bg-white p-4 text-left shadow-sm ring-1 ring-clay-100 transition-colors hover:ring-gold/40"
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                {h.bookName} {h.chapter}:{h.verse}
              </p>
              <p className="text-clay-700">{h.text}</p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Search the scriptures"
          description="Find verses by keyword, or type a reference like “Romans 8:28” to jump straight there."
        />
      )}
    </div>
  );
}
