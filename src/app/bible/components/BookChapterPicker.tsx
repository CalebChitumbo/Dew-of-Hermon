"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BIBLE_BOOKS, getBook, type BibleBook } from "@/lib/bible/books";

interface BookChapterPickerProps {
  bookId: number;
  chapter: number;
  onSelect: (bookId: number, chapter: number) => void;
}

/**
 * A single control that opens a dialog to choose a book then a chapter. Shows
 * the current "Book Chapter" as its label.
 */
export function BookChapterPicker({ bookId, chapter, onSelect }: BookChapterPickerProps) {
  const [open, setOpen] = useState(false);
  const [draftBook, setDraftBook] = useState<BibleBook | null>(null);

  const current = getBook(bookId);
  const ot = BIBLE_BOOKS.filter((b) => b.testament === "OT");
  const nt = BIBLE_BOOKS.filter((b) => b.testament === "NT");
  const pickBook = draftBook ?? current ?? BIBLE_BOOKS[0];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Reset the in-dialog book selection to the active book each time it opens.
    if (next) setDraftBook(null);
  };

  const renderBooks = (books: BibleBook[]) => (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
      {books.map((b) => (
        <button
          key={b.id}
          onClick={() => setDraftBook(b)}
          className={cn(
            "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            pickBook.id === b.id
              ? "bg-gold/20 font-medium text-gold-dark"
              : "text-clay-600 hover:bg-clay-50"
          )}
        >
          {b.name}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 font-display text-base">
          {current ? `${current.name} ${chapter}` : "Select passage"}
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a passage</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clay-400">
              Old Testament
            </p>
            {renderBooks(ot)}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clay-400">
              New Testament
            </p>
            {renderBooks(nt)}
          </div>

          <div className="sticky bottom-0 -mx-6 border-t border-clay-200 bg-white px-6 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clay-400">
              {pickBook.name} — chapter
            </p>
            <div className="grid grid-cols-6 gap-1.5 pb-1 sm:grid-cols-10">
              {Array.from({ length: pickBook.chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  onClick={() => {
                    onSelect(pickBook.id, ch);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md py-1.5 text-sm transition-colors",
                    pickBook.id === bookId && ch === chapter
                      ? "bg-gold text-white"
                      : "bg-clay-50 text-clay-600 hover:bg-clay-100"
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
