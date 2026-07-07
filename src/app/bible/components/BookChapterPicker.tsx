"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
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
 * A single control that opens a dialog to choose a passage in two steps:
 * first the book, then the chapter. Each step gets the whole dialog to
 * itself with its own scroll area — long books like Psalms (150 chapters)
 * can't crowd out the book list, and the back button always returns to the
 * books. Shows the current "Book Chapter" as its label.
 */
export function BookChapterPicker({ bookId, chapter, onSelect }: BookChapterPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"books" | "chapters">("books");
  const [draftBook, setDraftBook] = useState<BibleBook | null>(null);

  const current = getBook(bookId);
  const ot = BIBLE_BOOKS.filter((b) => b.testament === "OT");
  const nt = BIBLE_BOOKS.filter((b) => b.testament === "NT");
  const pickBook = draftBook ?? current ?? BIBLE_BOOKS[0];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Start from the book list each time the picker opens.
    if (next) {
      setDraftBook(null);
      setView("books");
    }
  };

  const renderBooks = (books: BibleBook[]) => (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
      {books.map((b) => (
        <button
          key={b.id}
          onClick={() => {
            setDraftBook(b);
            setView("chapters");
          }}
          className={cn(
            "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            b.id === bookId
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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {view === "books" ? "Choose a book" : `${pickBook.name} — choose a chapter`}
          </DialogTitle>
        </DialogHeader>

        {view === "chapters" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("books")}
            className="-mt-1 h-8 gap-1.5 self-start px-2 text-clay-500 hover:text-clay-700"
          >
            <ArrowLeft className="h-4 w-4" /> All books
          </Button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {view === "books" ? (
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
            </div>
          ) : (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
