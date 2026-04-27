"use client";

import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { safeCollection, safeDoc } from "@/lib/firebase";
import type { SongSuggestion, SongSuggestionStatus } from "./types";

const COLLECTION = "worshipSongSuggestions";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function mapSnapshot(snapshot: QuerySnapshot<DocumentData>): SongSuggestion[] {
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? "",
      youtubeLink: data.youtubeLink ?? "",
      suggestedBy: data.suggestedBy ?? "",
      suggestedByName: data.suggestedByName ?? "",
      status: (data.status as SongSuggestionStatus) ?? "open",
      createdAt: toDate(data.createdAt),
      archivedAt: toDate(data.archivedAt),
      pickedForCycle: data.pickedForCycle ?? undefined,
    };
  });
}

export function subscribeSuggestions(
  status: SongSuggestionStatus,
  callback: (rows: SongSuggestion[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    safeCollection(COLLECTION),
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => callback(mapSnapshot(snap)),
    (err) => {
      console.error("Failed to subscribe to song suggestions", err);
      onError?.(err);
    }
  );
}

export async function createSuggestion(input: {
  title: string;
  youtubeLink: string;
  suggestedBy: string;
  suggestedByName: string;
}): Promise<void> {
  await addDoc(safeCollection(COLLECTION), {
    title: (input.title ?? "").trim(),
    youtubeLink: (input.youtubeLink ?? "").trim(),
    suggestedBy: input.suggestedBy ?? "",
    suggestedByName: input.suggestedByName ?? "",
    status: "open" as SongSuggestionStatus,
    createdAt: serverTimestamp(),
  });
}

export async function archiveSuggestion(
  id: string,
  cycleName: string
): Promise<void> {
  await updateDoc(safeDoc(COLLECTION, id), {
    status: "archived" as SongSuggestionStatus,
    archivedAt: serverTimestamp(),
    pickedForCycle: cycleName,
  });
}

export async function restoreSuggestion(id: string): Promise<void> {
  await updateDoc(safeDoc(COLLECTION, id), {
    status: "open" as SongSuggestionStatus,
    archivedAt: null,
    pickedForCycle: null,
  });
}

export async function deleteSuggestion(id: string): Promise<void> {
  await deleteDoc(safeDoc(COLLECTION, id));
}
