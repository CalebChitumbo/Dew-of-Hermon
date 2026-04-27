"use client";

import type { SongSuggestion, SongSuggestionStatus } from "./types";

interface ApiSuggestion {
  id: string;
  title: string;
  youtubeLink: string;
  suggestedBy: string;
  suggestedByName: string;
  status: SongSuggestionStatus;
  createdAt: string | null;
  archivedAt: string | null;
  pickedForCycle: string | null;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fromApi(s: ApiSuggestion): SongSuggestion {
  return {
    id: s.id,
    title: s.title ?? "",
    youtubeLink: s.youtubeLink ?? "",
    suggestedBy: s.suggestedBy ?? "",
    suggestedByName: s.suggestedByName ?? "",
    status: s.status ?? "open",
    createdAt: toDate(s.createdAt),
    archivedAt: toDate(s.archivedAt),
    pickedForCycle: s.pickedForCycle ?? undefined,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

export async function fetchSuggestions(
  status: SongSuggestionStatus
): Promise<SongSuggestion[]> {
  const res = await fetch(
    `/api/song-suggestions?status=${encodeURIComponent(status)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { suggestions: ApiSuggestion[] };
  return data.suggestions.map(fromApi);
}

export async function createSuggestion(input: {
  title: string;
  youtubeLink: string;
}): Promise<SongSuggestion> {
  const res = await fetch("/api/song-suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title ?? "",
      youtubeLink: input.youtubeLink ?? "",
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { suggestion: ApiSuggestion };
  return fromApi(data.suggestion);
}

export async function archiveSuggestion(
  id: string,
  cycleName: string
): Promise<void> {
  const res = await fetch(
    `/api/song-suggestions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived", pickedForCycle: cycleName }),
    }
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function restoreSuggestion(id: string): Promise<void> {
  const res = await fetch(
    `/api/song-suggestions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    }
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteSuggestion(id: string): Promise<void> {
  const res = await fetch(
    `/api/song-suggestions/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await readError(res));
}
