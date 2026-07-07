"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { verseKey } from "@/lib/bible/api";
import type { BibleBookmark, BibleHighlightColor } from "@/types";

export interface VerseRef {
  translation: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

/**
 * Live per-user Bible bookmarks/highlights. Documents are keyed by a stable
 * `{uid}__{verseKey}` id so toggling a verse is idempotent and a verse can be
 * looked up in O(1) while reading.
 */
export function useBibleBookmarks() {
  const { firebaseUser } = useAuth();
  const [bookmarks, setBookmarks] = useState<BibleBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setBookmarks([]);
      setLoading(false);
      return;
    }
    // Deliberately no orderBy: filtering + ordering would need a composite
    // index to be live in the Firebase project, and when it isn't the
    // listener fails and every bookmark silently disappears. A user's own
    // bookmarks are few, so sort them here instead.
    const q = query(
      safeCollection("bibleBookmarks"),
      where("userId", "==", firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as BibleBookmark;
        });
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setBookmarks(rows);
        setLoading(false);
      },
      (err) => {
        console.error("bibleBookmarks listener", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [firebaseUser]);

  /** Map from verseKey → bookmark for the verses currently saved. */
  const byVerseKey = useMemo(() => {
    const map = new Map<string, BibleBookmark>();
    for (const b of bookmarks) {
      map.set(verseKey(b.translation, b.bookId, b.chapter, b.verse), b);
    }
    return map;
  }, [bookmarks]);

  const docIdFor = useCallback(
    (ref: VerseRef) =>
      `${firebaseUser?.uid}__${verseKey(ref.translation, ref.bookId, ref.chapter, ref.verse)}`,
    [firebaseUser]
  );

  /**
   * Save or update a verse. Passing the same verse again with a different
   * colour updates it; this never removes — use `remove` for that.
   */
  const save = useCallback(
    async (ref: VerseRef, color: BibleHighlightColor | null = null) => {
      // Throw rather than silently no-op so callers can show an error toast.
      if (!firebaseUser) throw new Error("You must be signed in to save verses");
      const id = docIdFor(ref);
      const existing = byVerseKey.get(
        verseKey(ref.translation, ref.bookId, ref.chapter, ref.verse)
      );
      await setDoc(safeDoc("bibleBookmarks", id), {
        userId: firebaseUser.uid,
        translation: ref.translation,
        bookId: ref.bookId,
        bookName: ref.bookName,
        chapter: ref.chapter,
        verse: ref.verse,
        text: ref.text,
        color,
        note: existing?.note ?? null,
        // Keep the original save time when re-colouring an existing bookmark.
        createdAt: existing ? existing.createdAt : serverTimestamp(),
      });
    },
    [firebaseUser, docIdFor, byVerseKey]
  );

  const remove = useCallback(
    async (ref: VerseRef) => {
      if (!firebaseUser) throw new Error("You must be signed in to save verses");
      await deleteDoc(safeDoc("bibleBookmarks", docIdFor(ref)));
    },
    [firebaseUser, docIdFor]
  );

  /** Toggle a plain bookmark on/off for a verse. */
  const toggle = useCallback(
    async (ref: VerseRef) => {
      const key = verseKey(ref.translation, ref.bookId, ref.chapter, ref.verse);
      if (byVerseKey.has(key)) {
        await remove(ref);
      } else {
        await save(ref, null);
      }
    },
    [byVerseKey, remove, save]
  );

  return { bookmarks, byVerseKey, loading, save, remove, toggle };
}
