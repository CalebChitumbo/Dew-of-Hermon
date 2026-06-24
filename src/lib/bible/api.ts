/**
 * Bible text provider.
 *
 * Verse text and keyword search are fetched on demand from bolls.life — a free,
 * key-less API that serves a range of public-domain translations. Navigation
 * metadata (which books/chapters exist) lives in ./books.ts and never hits the
 * network, so the picker always works even when offline.
 *
 * The fetch shapes are normalised here so the rest of the app only deals with
 * the small, stable `BibleVerse` / `SearchHit` types below. Responses are
 * cached in-memory for the life of the page to keep re-reads instant.
 */

import { bookName, findBook, getBook } from "./books";

/** Public-domain translations offered by bolls.life that we expose. */
export interface Translation {
  /** bolls.life short code, used in request URLs. */
  id: string;
  name: string;
}

export const TRANSLATIONS: Translation[] = [
  { id: "WEB", name: "World English Bible" },
  { id: "KJV", name: "King James Version" },
  { id: "ASV", name: "American Standard Version" },
  { id: "YLT", name: "Young's Literal Translation" },
  { id: "BBE", name: "Bible in Basic English" },
];

export const DEFAULT_TRANSLATION = "WEB";

export interface BibleVerse {
  verse: number;
  text: string;
}

export interface SearchHit {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ParsedReference {
  bookId: number;
  chapter: number;
  /** Optional specific verse the user asked for (used to scroll/highlight). */
  verse?: number;
}

const BASE = "https://bolls.life";

/**
 * Strip the markup bolls.life can embed in verse text — Strong's number tags,
 * footnote/translation-note markers, and inline formatting — leaving clean,
 * readable prose. Also collapses the whitespace those tags leave behind.
 */
function cleanText(raw: string): string {
  return String(raw ?? "")
    .replace(/<S>.*?<\/S>/g, "") // Strong's numbers
    .replace(/<sup>.*?<\/sup>/g, "")
    .replace(/<f>.*?<\/f>/g, "") // footnotes
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "") // any remaining tags
    .replace(/\s+/g, " ")
    .trim();
}

const chapterCache = new Map<string, BibleVerse[]>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Bible service responded ${res.status}`);
  }
  return res.json();
}

/**
 * Load every verse of a chapter. `translation` is a bolls.life code, `bookId`
 * is the canonical 1–66 order (see books.ts), `chapter` is 1-based.
 */
export async function fetchChapter(
  translation: string,
  bookId: number,
  chapter: number
): Promise<BibleVerse[]> {
  const key = `${translation}:${bookId}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;

  const data = await getJson(`${BASE}/get-text/${translation}/${bookId}/${chapter}/`);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected response from Bible service");
  }

  const verses: BibleVerse[] = data
    .map((row: Record<string, unknown>) => ({
      verse: Number(row.verse),
      text: cleanText(String(row.text ?? "")),
    }))
    .filter((v) => Number.isFinite(v.verse) && v.text.length > 0)
    .sort((a, b) => a.verse - b.verse);

  chapterCache.set(key, verses);
  return verses;
}

/**
 * Full-text keyword search across the chosen translation. Returns up to
 * `limit` hits ordered canonically by the service.
 */
export async function searchBible(
  translation: string,
  queryText: string,
  limit = 100
): Promise<SearchHit[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];

  const url =
    `${BASE}/v2/find/${translation}?search=${encodeURIComponent(trimmed)}` +
    `&match_case=false&match_whole=false&limit=${limit}`;
  const data = await getJson(url);

  // The endpoint has returned either a bare array or a { results } envelope
  // across versions — accept both.
  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray((data as { results?: unknown }).results)
    ? ((data as { results: Record<string, unknown>[] }).results)
    : [];

  return rows
    .map((row): SearchHit | null => {
      const bookId = Number(row.book ?? row.bookid ?? row.book_id);
      const chapter = Number(row.chapter);
      const verse = Number(row.verse);
      if (!Number.isFinite(bookId) || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
        return null;
      }
      return {
        bookId,
        bookName: bookName(bookId),
        chapter,
        verse,
        text: cleanText(String(row.text ?? "")),
      };
    })
    .filter((h): h is SearchHit => h !== null && h.text.length > 0);
}

/**
 * Try to read a scripture reference like "John 3:16", "1 Cor 13", or
 * "psalm 23:1-6" out of a query string. Returns null when it isn't a
 * recognisable reference (so the caller can fall back to keyword search).
 */
export function parseReference(input: string): ParsedReference | null {
  const m = input
    .trim()
    .match(/^([1-3]?\s?[a-z][a-z.\s]*?)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?\b/i);
  if (!m) return null;

  const book = findBook(m[1].replace(/\./g, "").trim());
  if (!book) return null;

  const chapter = Number(m[2]);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;

  const verse = m[3] ? Number(m[3]) : undefined;
  return { bookId: book.id, chapter, verse };
}

/** Stable id for a single verse, used as the bookmark document key. */
export function verseKey(translation: string, bookId: number, chapter: number, verse: number) {
  return `${translation}_${bookId}_${chapter}_${verse}`;
}

export { bookName, getBook };
