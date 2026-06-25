"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBibleBookmarks } from "@/hooks/useBibleBookmarks";
import { DEFAULT_TRANSLATION } from "@/lib/bible/api";
import { Reader } from "./components/Reader";
import { SearchPanel } from "./components/SearchPanel";
import { SavedPanel } from "./components/SavedPanel";
import { TranslationPicker } from "./components/TranslationPicker";

const STORAGE_KEY = "bible:last";

interface Position {
  translation: string;
  bookId: number;
  chapter: number;
}

const DEFAULT_POSITION: Position = {
  translation: DEFAULT_TRANSLATION,
  bookId: 43, // John
  chapter: 1,
};

function loadPosition(): Position {
  if (typeof window === "undefined") return DEFAULT_POSITION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const p = JSON.parse(raw);
    if (p && typeof p.bookId === "number" && typeof p.chapter === "number") {
      return { translation: p.translation ?? DEFAULT_TRANSLATION, bookId: p.bookId, chapter: p.chapter };
    }
  } catch {
    /* ignore malformed state */
  }
  return DEFAULT_POSITION;
}

export default function BiblePage() {
  const bookmarks = useBibleBookmarks();
  const [tab, setTab] = useState("read");
  const [pos, setPos] = useState<Position>(DEFAULT_POSITION);
  const [focusVerse, setFocusVerse] = useState<number | undefined>(undefined);

  // Restore the last read position after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    setPos(loadPosition());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [pos]);

  const navigate = (bookId: number, chapter: number, verse?: number) => {
    setPos((p) => ({ ...p, bookId, chapter }));
    setFocusVerse(verse);
  };

  const openFromOtherTab = (bookId: number, chapter: number, verse?: number) => {
    navigate(bookId, chapter, verse);
    setTab("read");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bible"
        description="Read, search, and save the scriptures."
        icon={BookOpenText}
        tone="gold"
        actions={
          <TranslationPicker
            value={pos.translation}
            onChange={(translation) => setPos((p) => ({ ...p, translation }))}
          />
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="read">Read</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="saved">
            Saved{bookmarks.bookmarks.length > 0 ? ` (${bookmarks.bookmarks.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="read" className="mt-5">
          <Reader
            translation={pos.translation}
            bookId={pos.bookId}
            chapter={pos.chapter}
            focusVerse={focusVerse}
            onNavigate={(bookId, chapter) => navigate(bookId, chapter)}
            bookmarks={bookmarks}
          />
        </TabsContent>

        <TabsContent value="search" className="mt-5">
          <SearchPanel translation={pos.translation} onOpen={openFromOtherTab} />
        </TabsContent>

        <TabsContent value="saved" className="mt-5">
          <SavedPanel bookmarks={bookmarks} onOpen={openFromOtherTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
