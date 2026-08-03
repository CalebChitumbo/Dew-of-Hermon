/// GENERATED FROM src/lib/bible/books.ts — keep the two in step.
///
/// Static canonical metadata for the 66 books of the Protestant Bible. This
/// powers all navigation — book picker, chapter grid, reference parsing —
/// entirely offline; only the verse text is fetched (see bible_api.dart).
///
/// `id` is the 1-based canonical order (Genesis = 1 … Revelation = 66). The
/// bolls.life API uses this exact numbering as its `bookid`, so the same value
/// doubles as the API book identifier.

enum Testament { ot, nt }

class BibleBook {
  const BibleBook({
    required this.id,
    required this.name,
    required this.aliases,
    required this.testament,
    required this.chapters,
  });

  /// 1-based canonical order, also the bolls.life book id.
  final int id;
  final String name;

  /// Lowercase aliases/abbreviations used for reference parsing.
  final List<String> aliases;
  final Testament testament;
  final int chapters;
}

const List<BibleBook> kBibleBooks = [
  BibleBook(id: 1, name: "Genesis", aliases: ["gen", "ge", "gn"], testament: Testament.ot, chapters: 50),
  BibleBook(id: 2, name: "Exodus", aliases: ["exo", "ex", "exod"], testament: Testament.ot, chapters: 40),
  BibleBook(id: 3, name: "Leviticus", aliases: ["lev", "le", "lv"], testament: Testament.ot, chapters: 27),
  BibleBook(id: 4, name: "Numbers", aliases: ["num", "nu", "nm", "nb"], testament: Testament.ot, chapters: 36),
  BibleBook(id: 5, name: "Deuteronomy", aliases: ["deut", "dt", "de"], testament: Testament.ot, chapters: 34),
  BibleBook(id: 6, name: "Joshua", aliases: ["josh", "jos", "jsh"], testament: Testament.ot, chapters: 24),
  BibleBook(id: 7, name: "Judges", aliases: ["judg", "jdg", "jg"], testament: Testament.ot, chapters: 21),
  BibleBook(id: 8, name: "Ruth", aliases: ["rth", "ru"], testament: Testament.ot, chapters: 4),
  BibleBook(id: 9, name: "1 Samuel", aliases: ["1 sam", "1sam", "1sa", "1 sa", "1samuel"], testament: Testament.ot, chapters: 31),
  BibleBook(id: 10, name: "2 Samuel", aliases: ["2 sam", "2sam", "2sa", "2 sa", "2samuel"], testament: Testament.ot, chapters: 24),
  BibleBook(id: 11, name: "1 Kings", aliases: ["1 kgs", "1kgs", "1ki", "1 ki", "1kings"], testament: Testament.ot, chapters: 22),
  BibleBook(id: 12, name: "2 Kings", aliases: ["2 kgs", "2kgs", "2ki", "2 ki", "2kings"], testament: Testament.ot, chapters: 25),
  BibleBook(id: 13, name: "1 Chronicles", aliases: ["1 chr", "1chr", "1ch", "1 ch", "1chronicles"], testament: Testament.ot, chapters: 29),
  BibleBook(id: 14, name: "2 Chronicles", aliases: ["2 chr", "2chr", "2ch", "2 ch", "2chronicles"], testament: Testament.ot, chapters: 36),
  BibleBook(id: 15, name: "Ezra", aliases: ["ezr", "ez"], testament: Testament.ot, chapters: 10),
  BibleBook(id: 16, name: "Nehemiah", aliases: ["neh", "ne"], testament: Testament.ot, chapters: 13),
  BibleBook(id: 17, name: "Esther", aliases: ["est", "es", "esth"], testament: Testament.ot, chapters: 10),
  BibleBook(id: 18, name: "Job", aliases: ["jb"], testament: Testament.ot, chapters: 42),
  BibleBook(id: 19, name: "Psalms", aliases: ["ps", "psalm", "psa", "pss", "pslm"], testament: Testament.ot, chapters: 150),
  BibleBook(id: 20, name: "Proverbs", aliases: ["prov", "pro", "prv", "pr"], testament: Testament.ot, chapters: 31),
  BibleBook(id: 21, name: "Ecclesiastes", aliases: ["eccl", "ecc", "ec", "qoh"], testament: Testament.ot, chapters: 12),
  BibleBook(id: 22, name: "Song of Solomon", aliases: ["song", "sos", "so", "song of songs", "canticles", "cant"], testament: Testament.ot, chapters: 8),
  BibleBook(id: 23, name: "Isaiah", aliases: ["isa", "is"], testament: Testament.ot, chapters: 66),
  BibleBook(id: 24, name: "Jeremiah", aliases: ["jer", "je", "jr"], testament: Testament.ot, chapters: 52),
  BibleBook(id: 25, name: "Lamentations", aliases: ["lam", "la"], testament: Testament.ot, chapters: 5),
  BibleBook(id: 26, name: "Ezekiel", aliases: ["ezek", "eze", "ezk"], testament: Testament.ot, chapters: 48),
  BibleBook(id: 27, name: "Daniel", aliases: ["dan", "da", "dn"], testament: Testament.ot, chapters: 12),
  BibleBook(id: 28, name: "Hosea", aliases: ["hos", "ho"], testament: Testament.ot, chapters: 14),
  BibleBook(id: 29, name: "Joel", aliases: ["jol", "joe", "jl"], testament: Testament.ot, chapters: 3),
  BibleBook(id: 30, name: "Amos", aliases: ["am", "amo"], testament: Testament.ot, chapters: 9),
  BibleBook(id: 31, name: "Obadiah", aliases: ["obad", "ob"], testament: Testament.ot, chapters: 1),
  BibleBook(id: 32, name: "Jonah", aliases: ["jon", "jnh"], testament: Testament.ot, chapters: 4),
  BibleBook(id: 33, name: "Micah", aliases: ["mic", "mc"], testament: Testament.ot, chapters: 7),
  BibleBook(id: 34, name: "Nahum", aliases: ["nah", "na"], testament: Testament.ot, chapters: 3),
  BibleBook(id: 35, name: "Habakkuk", aliases: ["hab", "hb"], testament: Testament.ot, chapters: 3),
  BibleBook(id: 36, name: "Zephaniah", aliases: ["zeph", "zep", "zp"], testament: Testament.ot, chapters: 3),
  BibleBook(id: 37, name: "Haggai", aliases: ["hag", "hg"], testament: Testament.ot, chapters: 2),
  BibleBook(id: 38, name: "Zechariah", aliases: ["zech", "zec", "zc"], testament: Testament.ot, chapters: 14),
  BibleBook(id: 39, name: "Malachi", aliases: ["mal", "ml"], testament: Testament.ot, chapters: 4),
  BibleBook(id: 40, name: "Matthew", aliases: ["matt", "mat", "mt"], testament: Testament.nt, chapters: 28),
  BibleBook(id: 41, name: "Mark", aliases: ["mrk", "mar", "mk", "mr"], testament: Testament.nt, chapters: 16),
  BibleBook(id: 42, name: "Luke", aliases: ["luk", "lk"], testament: Testament.nt, chapters: 24),
  BibleBook(id: 43, name: "John", aliases: ["jhn", "jn", "joh"], testament: Testament.nt, chapters: 21),
  BibleBook(id: 44, name: "Acts", aliases: ["act", "ac"], testament: Testament.nt, chapters: 28),
  BibleBook(id: 45, name: "Romans", aliases: ["rom", "ro", "rm"], testament: Testament.nt, chapters: 16),
  BibleBook(id: 46, name: "1 Corinthians", aliases: ["1 cor", "1cor", "1co", "1 co", "1corinthians"], testament: Testament.nt, chapters: 16),
  BibleBook(id: 47, name: "2 Corinthians", aliases: ["2 cor", "2cor", "2co", "2 co", "2corinthians"], testament: Testament.nt, chapters: 13),
  BibleBook(id: 48, name: "Galatians", aliases: ["gal", "ga"], testament: Testament.nt, chapters: 6),
  BibleBook(id: 49, name: "Ephesians", aliases: ["eph", "ephes"], testament: Testament.nt, chapters: 6),
  BibleBook(id: 50, name: "Philippians", aliases: ["phil", "php", "pp"], testament: Testament.nt, chapters: 4),
  BibleBook(id: 51, name: "Colossians", aliases: ["col", "co"], testament: Testament.nt, chapters: 4),
  BibleBook(id: 52, name: "1 Thessalonians", aliases: ["1 thess", "1thess", "1th", "1 th", "1thessalonians"], testament: Testament.nt, chapters: 5),
  BibleBook(id: 53, name: "2 Thessalonians", aliases: ["2 thess", "2thess", "2th", "2 th", "2thessalonians"], testament: Testament.nt, chapters: 3),
  BibleBook(id: 54, name: "1 Timothy", aliases: ["1 tim", "1tim", "1ti", "1 ti", "1timothy"], testament: Testament.nt, chapters: 6),
  BibleBook(id: 55, name: "2 Timothy", aliases: ["2 tim", "2tim", "2ti", "2 ti", "2timothy"], testament: Testament.nt, chapters: 4),
  BibleBook(id: 56, name: "Titus", aliases: ["tit", "ti"], testament: Testament.nt, chapters: 3),
  BibleBook(id: 57, name: "Philemon", aliases: ["philem", "phlm", "phm", "pm"], testament: Testament.nt, chapters: 1),
  BibleBook(id: 58, name: "Hebrews", aliases: ["heb"], testament: Testament.nt, chapters: 13),
  BibleBook(id: 59, name: "James", aliases: ["jas", "jm"], testament: Testament.nt, chapters: 5),
  BibleBook(id: 60, name: "1 Peter", aliases: ["1 pet", "1pet", "1pe", "1 pe", "1peter"], testament: Testament.nt, chapters: 5),
  BibleBook(id: 61, name: "2 Peter", aliases: ["2 pet", "2pet", "2pe", "2 pe", "2peter"], testament: Testament.nt, chapters: 3),
  BibleBook(id: 62, name: "1 John", aliases: ["1 jn", "1jn", "1jo", "1 jo", "1john"], testament: Testament.nt, chapters: 5),
  BibleBook(id: 63, name: "2 John", aliases: ["2 jn", "2jn", "2jo", "2 jo", "2john"], testament: Testament.nt, chapters: 1),
  BibleBook(id: 64, name: "3 John", aliases: ["3 jn", "3jn", "3jo", "3 jo", "3john"], testament: Testament.nt, chapters: 1),
  BibleBook(id: 65, name: "Jude", aliases: ["jud", "jd"], testament: Testament.nt, chapters: 1),
  BibleBook(id: 66, name: "Revelation", aliases: ["rev", "re", "rv", "apocalypse", "apoc"], testament: Testament.nt, chapters: 22),
];

final Map<int, BibleBook> _byId = {for (final b in kBibleBooks) b.id: b};

BibleBook? getBook(int id) => _byId[id];

String bookName(int id) => _byId[id]?.name ?? 'Book $id';

String _normalize(String s) =>
    s.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();

/// Resolve free-text to a book. Accepts the full name ("First John"/"1 John"),
/// the canonical name, or any registered alias ("1jn", "jn", "psalm").
BibleBook? findBook(String raw) {
  final q = _normalize(raw)
      // Ordinal words to digits, so "first john" finds "1 John".
      .replaceFirst(RegExp(r'^first\s+'), '1 ')
      .replaceFirst(RegExp(r'^second\s+'), '2 ')
      .replaceFirst(RegExp(r'^third\s+'), '3 ');

  for (final book in kBibleBooks) {
    if (_normalize(book.name) == q) return book;
    if (book.aliases.contains(q)) return book;
  }
  // Fall back to a prefix match on the canonical name (e.g. "philipp").
  if (q.length >= 3) {
    for (final book in kBibleBooks) {
      if (_normalize(book.name).startsWith(q)) return book;
    }
  }
  return null;
}

List<BibleBook> booksIn(Testament testament) =>
    kBibleBooks.where((b) => b.testament == testament).toList();
