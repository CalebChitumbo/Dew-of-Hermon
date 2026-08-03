import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// A verse a user has saved or highlighted. Stored per-user in the
/// `bibleBookmarks` collection, with a document id of `{uid}__{verseKey}` —
/// the same scheme the web uses, so a verse saved on either client is one row
/// rather than two.
class BibleBookmark {
  const BibleBookmark({
    required this.id,
    required this.userId,
    required this.translation,
    required this.bookId,
    required this.bookName,
    required this.chapter,
    required this.verse,
    required this.text,
    required this.createdAt,
    this.color,
    this.note,
  });

  factory BibleBookmark.fromMap(Map<String, dynamic> map) => BibleBookmark(
        id: parseStringOr(map['id']),
        userId: parseStringOr(map['userId']),
        translation: parseStringOr(map['translation'], 'WEB'),
        bookId: parseIntOr(map['bookId'], 1),
        bookName: parseStringOr(map['bookName']),
        chapter: parseIntOr(map['chapter'], 1),
        verse: parseIntOr(map['verse'], 1),
        text: parseStringOr(map['text']),
        color: BibleHighlightColor.fromWireOrNull(map['color']),
        note: parseString(map['note']),
        createdAt: parseDateOr(map['createdAt'], DateTime.now()),
      );

  final String id;
  final String userId;
  final String translation;
  final int bookId;
  final String bookName;
  final int chapter;
  final int verse;

  /// Snapshot of the verse text at save time, so the saved list renders
  /// without fetching the chapter again.
  final String text;

  /// A highlight colour, or null for a plain (uncoloured) bookmark.
  final BibleHighlightColor? color;

  final String? note;
  final DateTime createdAt;

  String get reference => '$bookName $chapter:$verse';
}
