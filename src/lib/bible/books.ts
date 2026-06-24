/**
 * Static canonical metadata for the 66 books of the Protestant Bible.
 *
 * This powers all navigation (book picker, chapter grid, reference parsing)
 * entirely offline — no network needed to know what books/chapters exist.
 * Only the verse *text* is fetched on demand (see ./api.ts).
 *
 * `id` is the 1-based canonical order (Genesis = 1 … Revelation = 66). The
 * bolls.life API uses this exact numbering as its `bookid`, so the same value
 * doubles as the API book identifier.
 */

export type Testament = "OT" | "NT";

export interface BibleBook {
  /** 1-based canonical order, also the bolls.life book id. */
  id: number;
  name: string;
  /** Lowercase aliases/abbreviations used for reference parsing. */
  aliases: string[];
  testament: Testament;
  /** Number of chapters in the book. */
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { id: 1, name: "Genesis", aliases: ["gen", "ge", "gn"], testament: "OT", chapters: 50 },
  { id: 2, name: "Exodus", aliases: ["exo", "ex", "exod"], testament: "OT", chapters: 40 },
  { id: 3, name: "Leviticus", aliases: ["lev", "le", "lv"], testament: "OT", chapters: 27 },
  { id: 4, name: "Numbers", aliases: ["num", "nu", "nm", "nb"], testament: "OT", chapters: 36 },
  { id: 5, name: "Deuteronomy", aliases: ["deut", "dt", "de"], testament: "OT", chapters: 34 },
  { id: 6, name: "Joshua", aliases: ["josh", "jos", "jsh"], testament: "OT", chapters: 24 },
  { id: 7, name: "Judges", aliases: ["judg", "jdg", "jg"], testament: "OT", chapters: 21 },
  { id: 8, name: "Ruth", aliases: ["rth", "ru"], testament: "OT", chapters: 4 },
  { id: 9, name: "1 Samuel", aliases: ["1 sam", "1sam", "1sa", "1 sa", "1samuel"], testament: "OT", chapters: 31 },
  { id: 10, name: "2 Samuel", aliases: ["2 sam", "2sam", "2sa", "2 sa", "2samuel"], testament: "OT", chapters: 24 },
  { id: 11, name: "1 Kings", aliases: ["1 kgs", "1kgs", "1ki", "1 ki", "1kings"], testament: "OT", chapters: 22 },
  { id: 12, name: "2 Kings", aliases: ["2 kgs", "2kgs", "2ki", "2 ki", "2kings"], testament: "OT", chapters: 25 },
  { id: 13, name: "1 Chronicles", aliases: ["1 chr", "1chr", "1ch", "1 ch", "1chronicles"], testament: "OT", chapters: 29 },
  { id: 14, name: "2 Chronicles", aliases: ["2 chr", "2chr", "2ch", "2 ch", "2chronicles"], testament: "OT", chapters: 36 },
  { id: 15, name: "Ezra", aliases: ["ezr", "ez"], testament: "OT", chapters: 10 },
  { id: 16, name: "Nehemiah", aliases: ["neh", "ne"], testament: "OT", chapters: 13 },
  { id: 17, name: "Esther", aliases: ["est", "es", "esth"], testament: "OT", chapters: 10 },
  { id: 18, name: "Job", aliases: ["jb"], testament: "OT", chapters: 42 },
  { id: 19, name: "Psalms", aliases: ["ps", "psalm", "psa", "pss", "pslm"], testament: "OT", chapters: 150 },
  { id: 20, name: "Proverbs", aliases: ["prov", "pro", "prv", "pr"], testament: "OT", chapters: 31 },
  { id: 21, name: "Ecclesiastes", aliases: ["eccl", "ecc", "ec", "qoh"], testament: "OT", chapters: 12 },
  { id: 22, name: "Song of Solomon", aliases: ["song", "sos", "so", "song of songs", "canticles", "cant"], testament: "OT", chapters: 8 },
  { id: 23, name: "Isaiah", aliases: ["isa", "is"], testament: "OT", chapters: 66 },
  { id: 24, name: "Jeremiah", aliases: ["jer", "je", "jr"], testament: "OT", chapters: 52 },
  { id: 25, name: "Lamentations", aliases: ["lam", "la"], testament: "OT", chapters: 5 },
  { id: 26, name: "Ezekiel", aliases: ["ezek", "eze", "ezk"], testament: "OT", chapters: 48 },
  { id: 27, name: "Daniel", aliases: ["dan", "da", "dn"], testament: "OT", chapters: 12 },
  { id: 28, name: "Hosea", aliases: ["hos", "ho"], testament: "OT", chapters: 14 },
  { id: 29, name: "Joel", aliases: ["jol", "joe", "jl"], testament: "OT", chapters: 3 },
  { id: 30, name: "Amos", aliases: ["am", "amo"], testament: "OT", chapters: 9 },
  { id: 31, name: "Obadiah", aliases: ["obad", "ob"], testament: "OT", chapters: 1 },
  { id: 32, name: "Jonah", aliases: ["jon", "jnh"], testament: "OT", chapters: 4 },
  { id: 33, name: "Micah", aliases: ["mic", "mc"], testament: "OT", chapters: 7 },
  { id: 34, name: "Nahum", aliases: ["nah", "na"], testament: "OT", chapters: 3 },
  { id: 35, name: "Habakkuk", aliases: ["hab", "hb"], testament: "OT", chapters: 3 },
  { id: 36, name: "Zephaniah", aliases: ["zeph", "zep", "zp"], testament: "OT", chapters: 3 },
  { id: 37, name: "Haggai", aliases: ["hag", "hg"], testament: "OT", chapters: 2 },
  { id: 38, name: "Zechariah", aliases: ["zech", "zec", "zc"], testament: "OT", chapters: 14 },
  { id: 39, name: "Malachi", aliases: ["mal", "ml"], testament: "OT", chapters: 4 },
  { id: 40, name: "Matthew", aliases: ["matt", "mat", "mt"], testament: "NT", chapters: 28 },
  { id: 41, name: "Mark", aliases: ["mrk", "mar", "mk", "mr"], testament: "NT", chapters: 16 },
  { id: 42, name: "Luke", aliases: ["luk", "lk"], testament: "NT", chapters: 24 },
  { id: 43, name: "John", aliases: ["jhn", "jn", "joh"], testament: "NT", chapters: 21 },
  { id: 44, name: "Acts", aliases: ["act", "ac"], testament: "NT", chapters: 28 },
  { id: 45, name: "Romans", aliases: ["rom", "ro", "rm"], testament: "NT", chapters: 16 },
  { id: 46, name: "1 Corinthians", aliases: ["1 cor", "1cor", "1co", "1 co", "1corinthians"], testament: "NT", chapters: 16 },
  { id: 47, name: "2 Corinthians", aliases: ["2 cor", "2cor", "2co", "2 co", "2corinthians"], testament: "NT", chapters: 13 },
  { id: 48, name: "Galatians", aliases: ["gal", "ga"], testament: "NT", chapters: 6 },
  { id: 49, name: "Ephesians", aliases: ["eph", "ephes"], testament: "NT", chapters: 6 },
  { id: 50, name: "Philippians", aliases: ["phil", "php", "pp"], testament: "NT", chapters: 4 },
  { id: 51, name: "Colossians", aliases: ["col", "co"], testament: "NT", chapters: 4 },
  { id: 52, name: "1 Thessalonians", aliases: ["1 thess", "1thess", "1th", "1 th", "1thessalonians"], testament: "NT", chapters: 5 },
  { id: 53, name: "2 Thessalonians", aliases: ["2 thess", "2thess", "2th", "2 th", "2thessalonians"], testament: "NT", chapters: 3 },
  { id: 54, name: "1 Timothy", aliases: ["1 tim", "1tim", "1ti", "1 ti", "1timothy"], testament: "NT", chapters: 6 },
  { id: 55, name: "2 Timothy", aliases: ["2 tim", "2tim", "2ti", "2 ti", "2timothy"], testament: "NT", chapters: 4 },
  { id: 56, name: "Titus", aliases: ["tit", "ti"], testament: "NT", chapters: 3 },
  { id: 57, name: "Philemon", aliases: ["philem", "phlm", "phm", "pm"], testament: "NT", chapters: 1 },
  { id: 58, name: "Hebrews", aliases: ["heb"], testament: "NT", chapters: 13 },
  { id: 59, name: "James", aliases: ["jas", "jm"], testament: "NT", chapters: 5 },
  { id: 60, name: "1 Peter", aliases: ["1 pet", "1pet", "1pe", "1 pe", "1peter"], testament: "NT", chapters: 5 },
  { id: 61, name: "2 Peter", aliases: ["2 pet", "2pet", "2pe", "2 pe", "2peter"], testament: "NT", chapters: 3 },
  { id: 62, name: "1 John", aliases: ["1 jn", "1jn", "1jo", "1 jo", "1john"], testament: "NT", chapters: 5 },
  { id: 63, name: "2 John", aliases: ["2 jn", "2jn", "2jo", "2 jo", "2john"], testament: "NT", chapters: 1 },
  { id: 64, name: "3 John", aliases: ["3 jn", "3jn", "3jo", "3 jo", "3john"], testament: "NT", chapters: 1 },
  { id: 65, name: "Jude", aliases: ["jud", "jd"], testament: "NT", chapters: 1 },
  { id: 66, name: "Revelation", aliases: ["rev", "re", "rv", "apocalypse", "apoc"], testament: "NT", chapters: 22 },
];

const BOOKS_BY_ID = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));

export function getBook(id: number): BibleBook | undefined {
  return BOOKS_BY_ID.get(id);
}

export function bookName(id: number): string {
  return BOOKS_BY_ID.get(id)?.name ?? `Book ${id}`;
}

const NORMALIZE = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Resolve a free-text book name or abbreviation to a book.
 * Accepts the full name ("First John"/"1 John"), the canonical name, or any
 * registered alias ("1jn", "jn", "psalm").
 */
export function findBook(raw: string): BibleBook | undefined {
  const q = NORMALIZE(raw)
    // Normalise ordinal words to digits so "first john" → "1 john".
    .replace(/^first\s+/, "1 ")
    .replace(/^second\s+/, "2 ")
    .replace(/^third\s+/, "3 ");
  for (const book of BIBLE_BOOKS) {
    if (NORMALIZE(book.name) === q) return book;
    if (book.aliases.some((a) => a === q)) return book;
  }
  // Fall back to a prefix match on the canonical name (e.g. "philipp").
  return BIBLE_BOOKS.find((book) => NORMALIZE(book.name).startsWith(q) && q.length >= 3);
}
