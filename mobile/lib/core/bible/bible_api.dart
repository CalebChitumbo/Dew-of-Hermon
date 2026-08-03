import 'dart:convert';

import 'package:dio/dio.dart';

import 'bible_books.dart';

/// Bible text provider. Port of `src/lib/bible/api.ts`.
///
/// Verse text and keyword search come from bolls.life — a free, key-less API
/// serving public-domain translations. Navigation metadata (which books and
/// chapters exist) lives in bible_books.dart and never touches the network, so
/// the picker works offline even when the text does not.

class Translation {
  const Translation(this.id, this.name);

  /// bolls.life short code, used in request URLs.
  final String id;
  final String name;
}

const List<Translation> kTranslations = [
  Translation('WEB', 'World English Bible'),
  Translation('KJV', 'King James Version'),
  Translation('ASV', 'American Standard Version'),
  Translation('YLT', "Young's Literal Translation"),
  Translation('BBE', 'Bible in Basic English'),
];

const String kDefaultTranslation = 'WEB';

class BibleVerse {
  const BibleVerse({required this.verse, required this.text});

  final int verse;
  final String text;
}

class SearchHit {
  const SearchHit({
    required this.bookId,
    required this.bookName,
    required this.chapter,
    required this.verse,
    required this.text,
  });

  final int bookId;
  final String bookName;
  final int chapter;
  final int verse;
  final String text;

  String get reference => '$bookName $chapter:$verse';
}

class ParsedReference {
  const ParsedReference({
    required this.bookId,
    required this.chapter,
    this.verse,
  });

  final int bookId;
  final int chapter;

  /// The specific verse the user asked for, used to scroll to it.
  final int? verse;
}

class BibleException implements Exception {
  const BibleException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Strip the markup bolls.life embeds in verse text — Strong's numbers,
/// footnote markers, inline formatting — leaving readable prose.
String cleanVerseText(String raw) {
  return raw
      .replaceAll(RegExp(r'<S>.*?</S>'), '') // Strong's numbers
      .replaceAll(RegExp(r'<sup>.*?</sup>'), '')
      .replaceAll(RegExp(r'<f>.*?</f>'), '') // footnotes
      .replaceAll(RegExp(r'<br\s*/?>'), ' ')
      .replaceAll(RegExp(r'<[^>]+>'), '') // any remaining tags
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

class BibleApi {
  BibleApi({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: _base,
              connectTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 30),
              headers: const {'Accept': 'application/json'},
              // bolls.life sometimes returns JSON with a text/html content
              // type, which Dio would otherwise hand back as a String.
              responseType: ResponseType.plain,
            ));

  static const String _base = 'https://bolls.life';

  final Dio _dio;

  /// Chapters read in this session, so flicking back and forth is instant and
  /// costs nothing. Bounded because a long reading session should not grow
  /// without limit.
  final Map<String, List<BibleVerse>> _chapterCache = {};
  final List<String> _cacheOrder = [];
  static const int _maxCachedChapters = 60;

  dynamic _decode(Response<dynamic> response) {
    final status = response.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      throw BibleException('Bible service responded $status');
    }
    final data = response.data;
    if (data is String) {
      try {
        return jsonDecode(data);
      } catch (_) {
        throw const BibleException('Unexpected response from Bible service');
      }
    }
    return data;
  }

  void _remember(String key, List<BibleVerse> verses) {
    _chapterCache[key] = verses;
    _cacheOrder.remove(key);
    _cacheOrder.add(key);
    while (_cacheOrder.length > _maxCachedChapters) {
      _chapterCache.remove(_cacheOrder.removeAt(0));
    }
  }

  /// Every verse of a chapter. [bookId] is the canonical 1–66 order.
  Future<List<BibleVerse>> fetchChapter(
    String translation,
    int bookId,
    int chapter,
  ) async {
    final key = '$translation:$bookId:$chapter';
    final cached = _chapterCache[key];
    if (cached != null) return cached;

    final Response<dynamic> response;
    try {
      response = await _dio.get<dynamic>('/get-text/$translation/$bookId/$chapter/');
    } on DioException {
      throw const BibleException(
        'Could not reach the Bible service. Check your connection.',
      );
    }

    final data = _decode(response);
    if (data is! List) {
      throw const BibleException('Unexpected response from Bible service');
    }

    final verses = <BibleVerse>[];
    for (final row in data) {
      if (row is! Map) continue;
      final verse = int.tryParse('${row['verse']}');
      final text = cleanVerseText('${row['text'] ?? ''}');
      if (verse == null || text.isEmpty) continue;
      verses.add(BibleVerse(verse: verse, text: text));
    }
    verses.sort((a, b) => a.verse.compareTo(b.verse));

    _remember(key, verses);
    return verses;
  }

  /// Keyword search across the chosen translation.
  Future<List<SearchHit>> search(
    String translation,
    String queryText, {
    int limit = 100,
  }) async {
    final trimmed = queryText.trim();
    if (trimmed.isEmpty) return const [];

    final Response<dynamic> response;
    try {
      response = await _dio.get<dynamic>(
        '/v2/find/$translation',
        queryParameters: {
          'search': trimmed,
          'match_case': 'false',
          'match_whole': 'false',
          'limit': '$limit',
        },
      );
    } on DioException {
      throw const BibleException(
        'Could not reach the Bible service. Check your connection.',
      );
    }

    final data = _decode(response);
    // The endpoint has returned either a bare array or a { results } envelope
    // across versions — accept both.
    final rows = data is List
        ? data
        : (data is Map && data['results'] is List)
            ? data['results'] as List
            : const [];

    final hits = <SearchHit>[];
    for (final row in rows) {
      if (row is! Map) continue;
      final bookId = int.tryParse(
          '${row['book'] ?? row['bookid'] ?? row['book_id'] ?? ''}');
      final chapter = int.tryParse('${row['chapter']}');
      final verse = int.tryParse('${row['verse']}');
      if (bookId == null || chapter == null || verse == null) continue;
      final text = cleanVerseText('${row['text'] ?? ''}');
      if (text.isEmpty) continue;
      hits.add(SearchHit(
        bookId: bookId,
        bookName: bookName(bookId),
        chapter: chapter,
        verse: verse,
        text: text,
      ));
    }
    return hits;
  }
}

/// Read a scripture reference out of a query — "John 3:16", "1 Cor 13",
/// "psalm 23:1". Null when it is not one, so the caller falls back to search.
ParsedReference? parseReference(String input) {
  final match = RegExp(
    r'^([1-3]?\s?[a-z][a-z.\s]*?)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?\b',
    caseSensitive: false,
  ).firstMatch(input.trim());
  if (match == null) return null;

  final book = findBook(match.group(1)!.replaceAll('.', '').trim());
  if (book == null) return null;

  final chapter = int.tryParse(match.group(2) ?? '');
  if (chapter == null || chapter < 1 || chapter > book.chapters) return null;

  return ParsedReference(
    bookId: book.id,
    chapter: chapter,
    verse: match.group(3) == null ? null : int.tryParse(match.group(3)!),
  );
}

/// Stable id for a single verse — the bookmark document key.
String verseKey(String translation, int bookId, int chapter, int verse) =>
    '${translation}_${bookId}_${chapter}_$verse';
