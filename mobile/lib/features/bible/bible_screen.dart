import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/bible/bible_api.dart';
import '../../core/bible/bible_books.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/firestore_parse.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/firestore/streams.dart';
import '../../data/models/bible.dart';
import '../../data/models/enums.dart';

final bibleApiProvider = Provider<BibleApi>((ref) => BibleApi());

/// The signed-in user's highlights and notes, live.
final bookmarksProvider = StreamProvider<List<BibleBookmark>>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(const <BibleBookmark>[]);
  return collectionStream(
    db.collection('bibleBookmarks').where('userId', isEqualTo: user.id),
    BibleBookmark.fromMap,
    sort: (a, b) => b.createdAt.compareTo(a.createdAt),
  ).handleError((_) => <BibleBookmark>[]);
});

/// The Bible reader.
///
/// Navigation is entirely offline — the 66 books and their chapter counts are
/// a static table — so the picker always works. Only the verse text is
/// fetched, and chapters read this session are cached, so flicking back and
/// forth costs nothing.
class BibleScreen extends ConsumerStatefulWidget {
  const BibleScreen({super.key});

  @override
  ConsumerState<BibleScreen> createState() => _BibleScreenState();
}

class _BibleScreenState extends ConsumerState<BibleScreen> {
  static const _prefsBook = 'bible-last-book';
  static const _prefsChapter = 'bible-last-chapter';
  static const _prefsTranslation = 'bible-translation';

  int _bookId = 43; // John — a reasonable place to open
  int _chapter = 1;
  String _translation = kDefaultTranslation;

  List<BibleVerse>? _verses;
  bool _loading = true;
  String? _error;
  int? _scrollToVerse;

  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    unawaited(_restore());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final book = prefs.getInt(_prefsBook);
      final chapter = prefs.getInt(_prefsChapter);
      final translation = prefs.getString(_prefsTranslation);
      if (mounted) {
        setState(() {
          if (book != null && getBook(book) != null) _bookId = book;
          if (chapter != null && chapter > 0) _chapter = chapter;
          if (translation != null) _translation = translation;
        });
      }
    } catch (_) {
      // Falling back to John 1 is fine.
    }
    await _load();
  }

  Future<void> _remember() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_prefsBook, _bookId);
      await prefs.setInt(_prefsChapter, _chapter);
      await prefs.setString(_prefsTranslation, _translation);
    } catch (_) {
      // Losing the place is survivable.
    }
  }

  Future<void> _load({int? scrollTo}) async {
    setState(() {
      _loading = true;
      _error = null;
      _scrollToVerse = scrollTo;
    });
    try {
      final verses = await ref
          .read(bibleApiProvider)
          .fetchChapter(_translation, _bookId, _chapter);
      if (!mounted) return;
      setState(() {
        _verses = verses;
        _loading = false;
      });
      unawaited(_remember());
      if (scrollTo != null) _scrollToVerseIndex(scrollTo, verses);
    } on BibleException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.message;
        });
      }
    }
  }

  void _scrollToVerseIndex(int verse, List<BibleVerse> verses) {
    final index = verses.indexWhere((v) => v.verse == verse);
    if (index < 0) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      // Rough estimate: verses average about three lines on a phone. Close
      // enough to land the verse on screen, which is all that matters.
      _scrollController.animateTo(
        (index * 92).toDouble().clamp(
              0,
              _scrollController.position.maxScrollExtent,
            ),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _goTo(int bookId, int chapter, {int? verse}) {
    setState(() {
      _bookId = bookId;
      _chapter = chapter;
    });
    unawaited(_load(scrollTo: verse));
  }

  void _step(int delta) {
    final book = getBook(_bookId);
    if (book == null) return;
    var chapter = _chapter + delta;
    var bookId = _bookId;

    if (chapter < 1) {
      // Walking back past chapter 1 lands on the end of the previous book,
      // which is what a reader flicking backwards expects.
      bookId = _bookId - 1;
      final previous = getBook(bookId);
      if (previous == null) return;
      chapter = previous.chapters;
    } else if (chapter > book.chapters) {
      bookId = _bookId + 1;
      if (getBook(bookId) == null) return;
      chapter = 1;
    }
    _goTo(bookId, chapter);
  }

  @override
  Widget build(BuildContext context) {
    final book = getBook(_bookId);
    final bookmarks = ref.watch(bookmarksProvider).valueOrNull ?? const [];
    final byKey = {
      for (final b in bookmarks)
        verseKey(b.translation, b.bookId, b.chapter, b.verse): b,
    };

    return AppScaffold(
      title: book?.name ?? 'Bible',
      subtitle: 'Chapter $_chapter · $_translation',
      padded: false,
      actions: [
        IconButton(
          icon: const Icon(AppIcons.search),
          tooltip: 'Search',
          onPressed: _openSearch,
        ),
        IconButton(
          icon: const Icon(AppIcons.bookmark),
          tooltip: 'Saved verses',
          onPressed: _openBookmarks,
        ),
      ],
      body: Column(
        children: [
          _ReaderBar(
            bookName: book?.name ?? '',
            chapter: _chapter,
            translation: _translation,
            onPickBook: _openBookPicker,
            onPickTranslation: _pickTranslation,
          ),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading the chapter…')
                : _error != null
                    ? ErrorView(
                        title: 'Could not load the chapter',
                        message: _error!,
                        onRetry: _load,
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(18, 12, 18, 90),
                        itemCount: (_verses?.length ?? 0) + 1,
                        itemBuilder: (context, i) {
                          if (i == _verses!.length) {
                            return _ChapterNav(
                              onPrevious: () => _step(-1),
                              onNext: () => _step(1),
                            );
                          }
                          final verse = _verses![i];
                          final key = verseKey(
                              _translation, _bookId, _chapter, verse.verse);
                          return _VerseRow(
                            verse: verse,
                            bookmark: byKey[key],
                            highlighted: _scrollToVerse == verse.verse,
                            onTap: () => _verseActions(verse, byKey[key]),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Future<void> _openBookPicker() async {
    final result = await showModalBottomSheet<(int, int)>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BookPicker(currentBookId: _bookId),
    );
    if (result != null) _goTo(result.$1, result.$2);
  }

  Future<void> _pickTranslation() async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final t in kTranslations)
              LuxTile(
                title: t.name,
                subtitle: t.id,
                icon: AppIcons.bible,
                tone: t.id == _translation ? IconTone.gold : IconTone.clay,
                dense: true,
                trailing: t.id == _translation
                    ? const Icon(AppIcons.check,
                        size: 17, color: AppColors.goldDark)
                    : null,
                onTap: () => Navigator.of(context).pop(t.id),
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (chosen != null && chosen != _translation) {
      setState(() => _translation = chosen);
      unawaited(_load());
    }
  }

  Future<void> _openSearch() async {
    final result = await showModalBottomSheet<ParsedReference>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _SearchSheet(translation: _translation),
    );
    if (result != null) {
      _goTo(result.bookId, result.chapter, verse: result.verse);
    }
  }

  Future<void> _openBookmarks() async {
    final result = await showModalBottomSheet<ParsedReference>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _BookmarksSheet(),
    );
    if (result != null) {
      _goTo(result.bookId, result.chapter, verse: result.verse);
    }
  }

  Future<void> _verseActions(BibleVerse verse, BibleBookmark? existing) async {
    final user = ref.read(userOrNullProvider);
    if (user == null) return;

    final book = getBook(_bookId);
    final reference = '${book?.name ?? ''} $_chapter:${verse.verse}';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _VerseActionsSheet(
        reference: reference,
        text: verse.text,
        existing: existing,
        onHighlight: (colour) => _saveBookmark(verse, colour),
        onRemove: existing == null ? null : () => _removeBookmark(verse),
        onNote: () => _editNote(verse, existing),
        onCopy: () async {
          await Clipboard.setData(
              ClipboardData(text: '"${verse.text}" — $reference'));
          if (sheetContext.mounted) Navigator.of(sheetContext).pop();
          if (mounted) context.showSuccess('Copied.');
        },
      ),
    );
  }

  /// Document id matches the web's: `{uid}__{verseKey}`, so a verse saved on
  /// either client is the same row rather than a duplicate.
  String _docId(String uid, int verse) =>
      '${uid}__${verseKey(_translation, _bookId, _chapter, verse)}';

  Future<void> _saveBookmark(
    BibleVerse verse,
    BibleHighlightColor? colour,
  ) async {
    final user = ref.read(userOrNullProvider);
    if (user == null) return;
    final book = getBook(_bookId);
    final existing = firstWhereOrNull(
      ref.read(bookmarksProvider).valueOrNull ?? const <BibleBookmark>[],
      (b) =>
          b.translation == _translation &&
          b.bookId == _bookId &&
          b.chapter == _chapter &&
          b.verse == verse.verse,
    );

    try {
      await db.collection('bibleBookmarks').doc(_docId(user.id, verse.verse)).set({
        'userId': user.id,
        'translation': _translation,
        'bookId': _bookId,
        'bookName': book?.name ?? '',
        'chapter': _chapter,
        'verse': verse.verse,
        'text': verse.text,
        'color': colour?.wire,
        'note': existing?.note,
        // Keep the original save time when re-colouring.
        'createdAt': existing?.createdAt ?? DateTime.now(),
      });
      if (mounted) context.showSuccess('Saved.');
    } catch (e) {
      if (mounted) context.showError('Could not save: $e');
    }
  }

  Future<void> _removeBookmark(BibleVerse verse) async {
    final user = ref.read(userOrNullProvider);
    if (user == null) return;
    try {
      await db
          .collection('bibleBookmarks')
          .doc(_docId(user.id, verse.verse))
          .delete();
      if (mounted) context.showSuccess('Removed.');
    } catch (e) {
      if (mounted) context.showError('Could not remove: $e');
    }
  }

  Future<void> _editNote(BibleVerse verse, BibleBookmark? existing) async {
    final note = await promptForText(
      context,
      title: 'Your note',
      hint: 'What this verse says to you',
      confirmLabel: 'Save note',
    );
    if (note == null) return;

    final user = ref.read(userOrNullProvider);
    if (user == null) return;
    final book = getBook(_bookId);

    try {
      await db.collection('bibleBookmarks').doc(_docId(user.id, verse.verse)).set({
        'userId': user.id,
        'translation': _translation,
        'bookId': _bookId,
        'bookName': book?.name ?? '',
        'chapter': _chapter,
        'verse': verse.verse,
        'text': verse.text,
        'color': existing?.color?.wire,
        'note': note.isEmpty ? null : note,
        'createdAt': existing?.createdAt ?? DateTime.now(),
      });
      if (mounted) context.showSuccess('Note saved.');
    } catch (e) {
      if (mounted) context.showError('Could not save: $e');
    }
  }
}

class _ReaderBar extends StatelessWidget {
  const _ReaderBar({
    required this.bookName,
    required this.chapter,
    required this.translation,
    required this.onPickBook,
    required this.onPickTranslation,
  });

  final String bookName;
  final int chapter;
  final String translation;
  final VoidCallback onPickBook;
  final VoidCallback onPickTranslation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: onPickBook,
              icon: const Icon(AppIcons.bible, size: 16),
              label: Text(
                '$bookName $chapter',
                overflow: TextOverflow.ellipsis,
              ),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
            ),
          ),
          const SizedBox(width: 10),
          OutlinedButton(
            onPressed: onPickTranslation,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 42),
              padding: const EdgeInsets.symmetric(horizontal: 14),
            ),
            child: Text(translation),
          ),
        ],
      ),
    );
  }
}

class _VerseRow extends StatelessWidget {
  const _VerseRow({
    required this.verse,
    required this.onTap,
    this.bookmark,
    this.highlighted = false,
  });

  final BibleVerse verse;
  final BibleBookmark? bookmark;
  final bool highlighted;
  final VoidCallback onTap;

  static Color? _colour(BibleHighlightColor? c) => switch (c) {
        BibleHighlightColor.gold => const Color(0x33C8963E),
        BibleHighlightColor.sage => const Color(0x336E8A6C),
        BibleHighlightColor.blue => const Color(0x336E74B8),
        BibleHighlightColor.rose => const Color(0x33BC7488),
        BibleHighlightColor.lavender => const Color(0x338A6CB0),
        null => null,
      };

  @override
  Widget build(BuildContext context) {
    final background = _colour(bookmark?.color) ??
        (highlighted ? AppColors.gold.withValues(alpha: 0.12) : null);

    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 7),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '${verse.verse} ',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gold,
                    ),
                  ),
                  TextSpan(
                    text: verse.text,
                    style: AppFonts.body(const TextStyle(
                      fontSize: 16.5,
                      height: 1.75,
                      color: AppColors.foreground,
                    )),
                  ),
                ],
              ),
            ),
            if ((bookmark?.note ?? '').isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 11, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.cream,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.clay100),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(AppIcons.noteText,
                        size: 13, color: AppColors.clay400),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        bookmark!.note!,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          fontStyle: FontStyle.italic,
                          color: AppColors.clay600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChapterNav extends StatelessWidget {
  const _ChapterNav({required this.onPrevious, required this.onNext});

  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: onPrevious,
              icon: const Icon(AppIcons.chevronLeft, size: 16),
              label: const Text('Previous'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(AppIcons.chevronRight, size: 16),
              label: const Text('Next'),
            ),
          ),
        ],
      ),
    );
  }
}

class _BookPicker extends StatefulWidget {
  const _BookPicker({required this.currentBookId});

  final int currentBookId;

  @override
  State<_BookPicker> createState() => _BookPickerState();
}

class _BookPickerState extends State<_BookPicker> {
  String _query = '';
  BibleBook? _chosen;

  @override
  Widget build(BuildContext context) {
    if (_chosen != null) {
      return _ChapterGrid(
        book: _chosen!,
        onPick: (chapter) =>
            Navigator.of(context).pop((_chosen!.id, chapter)),
        onBack: () => setState(() => _chosen = null),
      );
    }

    final q = _query.trim().toLowerCase();
    final matches = q.isEmpty
        ? kBibleBooks
        : kBibleBooks
            .where((b) =>
                b.name.toLowerCase().contains(q) ||
                b.aliases.any((a) => a.startsWith(q)))
            .toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.92,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Find a book',
                prefixIcon:
                    Icon(AppIcons.search, size: 18, color: AppColors.clay300),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                for (final testament in Testament.values) ...[
                  if (matches.any((b) => b.testament == testament)) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 10),
                      child: Builder(
                        builder: (context) => Text(
                          testament == Testament.ot
                              ? 'OLD TESTAMENT'
                              : 'NEW TESTAMENT',
                          style: context.eyebrow,
                        ),
                      ),
                    ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final book
                            in matches.where((b) => b.testament == testament))
                          _BookChip(
                            book: book,
                            selected: book.id == widget.currentBookId,
                            onTap: () => setState(() => _chosen = book),
                          ),
                      ],
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BookChip extends StatelessWidget {
  const _BookChip({
    required this.book,
    required this.selected,
    required this.onTap,
  });

  final BibleBook book;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.gold.withValues(alpha: 0.16)
              : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.gold : AppColors.border,
          ),
        ),
        child: Text(
          book.name,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.goldDark : AppColors.clay600,
          ),
        ),
      ),
    );
  }
}

class _ChapterGrid extends StatelessWidget {
  const _ChapterGrid({
    required this.book,
    required this.onPick,
    required this.onBack,
  });

  final BibleBook book;
  final ValueChanged<int> onPick;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 20, 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(AppIcons.back, size: 19),
                  color: AppColors.clay500,
                  onPressed: onBack,
                ),
                Expanded(
                  child: Text(
                    book.name,
                    style: AppFonts.display(const TextStyle(
                        fontSize: 20, color: AppColors.clay700)),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: GridView.count(
              controller: controller,
              crossAxisCount: 6,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                for (var i = 1; i <= book.chapters; i++)
                  InkWell(
                    onTap: () => onPick(i),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$i',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.clay600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchSheet extends ConsumerStatefulWidget {
  const _SearchSheet({required this.translation});

  final String translation;

  @override
  ConsumerState<_SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends ConsumerState<_SearchSheet> {
  final _controller = TextEditingController();
  List<SearchHit> _hits = const [];
  bool _searching = false;
  String? _error;
  bool _searched = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    final query = _controller.text.trim();
    if (query.isEmpty) return;

    // A reference goes straight there rather than through a text search —
    // typing "John 3:16" almost always means "take me to it".
    final reference = parseReference(query);
    if (reference != null) {
      Navigator.of(context).pop(reference);
      return;
    }

    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final hits =
          await ref.read(bibleApiProvider).search(widget.translation, query);
      if (mounted) {
        setState(() {
          _hits = hits;
          _searching = false;
          _searched = true;
        });
      }
    } on BibleException catch (e) {
      if (mounted) {
        setState(() {
          _searching = false;
          _error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: TextField(
              controller: _controller,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _run(),
              decoration: InputDecoration(
                hintText: 'A word, or a reference like John 3:16',
                prefixIcon: const Icon(AppIcons.search,
                    size: 18, color: AppColors.clay300),
                suffixIcon: IconButton(
                  icon: const Icon(AppIcons.forward, size: 18),
                  onPressed: _run,
                ),
              ),
            ),
          ),
          Expanded(
            child: _searching
                ? const LoadingView(message: 'Searching…')
                : _error != null
                    ? ErrorView(message: _error!, onRetry: _run)
                    : _hits.isEmpty
                        ? EmptyStateLux(
                            icon: AppIcons.search,
                            tone: IconTone.periwinkle,
                            title: _searched
                                ? 'Nothing found'
                                : 'Search the Bible',
                            description: _searched
                                ? 'Try a different word.'
                                : 'Type a word to search, or a reference to '
                                    'go straight there.',
                          )
                        : ListView.separated(
                            controller: controller,
                            padding:
                                const EdgeInsets.fromLTRB(20, 0, 20, 24),
                            itemCount: _hits.length,
                            separatorBuilder: (_, __) =>
                                const LuxDivider(indent: 0),
                            itemBuilder: (context, i) => InkWell(
                              onTap: () => Navigator.of(context).pop(
                                ParsedReference(
                                  bookId: _hits[i].bookId,
                                  chapter: _hits[i].chapter,
                                  verse: _hits[i].verse,
                                ),
                              ),
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _hits[i].reference,
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.goldDark,
                                      ),
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      _hits[i].text,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        height: 1.55,
                                        color: AppColors.clay600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _BookmarksSheet extends ConsumerWidget {
  const _BookmarksSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookmarks = ref.watch(bookmarksProvider).valueOrNull ?? const [];

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      builder: (context, controller) => bookmarks.isEmpty
          ? const EmptyStateLux(
              icon: AppIcons.bookmark,
              tone: IconTone.gold,
              title: 'Nothing saved yet',
              description: 'Tap a verse to highlight it or add a note. Saved '
                  'verses are kept here.',
            )
          : ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                Text(
                  'Saved verses',
                  style: AppFonts.display(const TextStyle(
                      fontSize: 21, color: AppColors.clay700)),
                ),
                const SizedBox(height: 4),
                Text(
                  '${bookmarks.length} '
                  '${bookmarks.length == 1 ? 'verse' : 'verses'}',
                  style:
                      const TextStyle(fontSize: 13, color: AppColors.clay400),
                ),
                const SizedBox(height: 16),
                for (final b in bookmarks)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: LuxCard(
                      onTap: () => Navigator.of(context).pop(
                        ParsedReference(
                          bookId: b.bookId,
                          chapter: b.chapter,
                          verse: b.verse,
                        ),
                      ),
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (b.color != null)
                                Container(
                                  height: 10,
                                  width: 10,
                                  margin: const EdgeInsets.only(right: 8),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: _dot(b.color!),
                                  ),
                                ),
                              Text(
                                '${b.bookName} ${b.chapter}:${b.verse}',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.goldDark,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                b.translation,
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.clay300),
                              ),
                            ],
                          ),
                          const SizedBox(height: 7),
                          Text(
                            b.text,
                            style: const TextStyle(
                                fontSize: 14,
                                height: 1.55,
                                color: AppColors.clay600),
                          ),
                          if ((b.note ?? '').isNotEmpty) ...[
                            const SizedBox(height: 9),
                            Text(
                              b.note!,
                              style: const TextStyle(
                                fontSize: 12.5,
                                height: 1.5,
                                fontStyle: FontStyle.italic,
                                color: AppColors.clay400,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  static Color _dot(BibleHighlightColor c) => switch (c) {
        BibleHighlightColor.gold => AppColors.gold,
        BibleHighlightColor.sage => const Color(0xFF6E8A6C),
        BibleHighlightColor.blue => const Color(0xFF6E74B8),
        BibleHighlightColor.rose => const Color(0xFFBC7488),
        BibleHighlightColor.lavender => const Color(0xFF8A6CB0),
      };
}

class _VerseActionsSheet extends StatelessWidget {
  const _VerseActionsSheet({
    required this.reference,
    required this.text,
    required this.onHighlight,
    required this.onNote,
    required this.onCopy,
    this.existing,
    this.onRemove,
  });

  final String reference;
  final String text;
  final BibleBookmark? existing;
  final void Function(BibleHighlightColor?) onHighlight;
  final VoidCallback onNote;
  final VoidCallback onCopy;
  final VoidCallback? onRemove;

  static Color _swatch(BibleHighlightColor c) => switch (c) {
        BibleHighlightColor.gold => AppColors.gold,
        BibleHighlightColor.sage => const Color(0xFF6E8A6C),
        BibleHighlightColor.blue => const Color(0xFF6E74B8),
        BibleHighlightColor.rose => const Color(0xFFBC7488),
        BibleHighlightColor.lavender => const Color(0xFF8A6CB0),
      };

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              reference,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.goldDark,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              text,
              style: const TextStyle(
                  fontSize: 14.5, height: 1.6, color: AppColors.clay600),
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 20),
            const FieldLabel('Highlight'),
            Row(
              children: [
                for (final colour in BibleHighlightColor.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: InkWell(
                      onTap: () {
                        onHighlight(colour);
                        Navigator.of(context).pop();
                      },
                      customBorder: const CircleBorder(),
                      child: Container(
                        height: 40,
                        width: 40,
                        decoration: BoxDecoration(
                          color: _swatch(colour).withValues(alpha: 0.28),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: existing?.color == colour
                                ? _swatch(colour)
                                : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: existing?.color == colour
                            ? Icon(AppIcons.check,
                                size: 17, color: _swatch(colour))
                            : null,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).pop();
                      onNote();
                    },
                    icon: const Icon(AppIcons.noteText, size: 15),
                    label: Text(
                        (existing?.note ?? '').isEmpty ? 'Add note' : 'Note'),
                    style:
                        OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onCopy,
                    icon: const Icon(AppIcons.copy, size: 15),
                    label: const Text('Copy'),
                    style:
                        OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                  ),
                ),
              ],
            ),
            if (onRemove != null) ...[
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  onRemove!();
                },
                icon: const Icon(AppIcons.trash, size: 15),
                label: const Text('Remove from saved'),
                style:
                    TextButton.styleFrom(foregroundColor: AppColors.destructive),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
