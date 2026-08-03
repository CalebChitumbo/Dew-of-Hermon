import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/utils/dates.dart';

/// Port of `src/app/latreou/lib/types.ts`.
///
/// The Latreuo planner walks the worship team through one two-Sunday cycle:
/// the songs, who leads them, what everyone wears, when they rehearse, and the
/// scripture the cycle sits on. It ends in a document the team can carry.

class Song {
  const Song({
    required this.id,
    this.title = '',
    this.leader = '',
    this.youtubeLink = '',
  });

  factory Song.fromMap(Map<String, dynamic> map) => Song(
        id: '${map['id'] ?? ''}',
        title: '${map['title'] ?? ''}',
        leader: '${map['leader'] ?? ''}',
        youtubeLink: '${map['youtubeLink'] ?? ''}',
      );

  final String id;
  final String title;
  final String leader;
  final String youtubeLink;

  bool get isEmpty => title.trim().isEmpty;

  Song copyWith({String? title, String? leader, String? youtubeLink}) => Song(
        id: id,
        title: title ?? this.title,
        leader: leader ?? this.leader,
        youtubeLink: youtubeLink ?? this.youtubeLink,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'leader': leader,
        'youtubeLink': youtubeLink,
      };
}

class SpecialItem {
  const SpecialItem({
    this.title = '',
    this.responsible = '',
    this.link = '',
  });

  factory SpecialItem.fromMap(Map<String, dynamic> map) => SpecialItem(
        title: '${map['title'] ?? ''}',
        responsible: '${map['responsible'] ?? ''}',
        link: '${map['link'] ?? ''}',
      );

  final String title;
  final String responsible;
  final String link;

  bool get isEmpty => title.trim().isEmpty;

  SpecialItem copyWith({String? title, String? responsible, String? link}) =>
      SpecialItem(
        title: title ?? this.title,
        responsible: responsible ?? this.responsible,
        link: link ?? this.link,
      );

  Map<String, dynamic> toMap() =>
      {'title': title, 'responsible': responsible, 'link': link};
}

class SundayPlan {
  const SundayPlan({
    this.date = '',
    this.praise = const [],
    this.worship = const [],
    this.specialItem = const SpecialItem(),
  });

  factory SundayPlan.fromMap(Map<String, dynamic> map) => SundayPlan(
        date: '${map['date'] ?? ''}',
        praise: _songs(map['praise']),
        worship: _songs(map['worship']),
        specialItem: SpecialItem.fromMap(
            map['specialItem'] is Map
                ? Map<String, dynamic>.from(map['specialItem'] as Map)
                : const {}),
      );

  static List<Song> _songs(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((m) => Song.fromMap(Map<String, dynamic>.from(m)))
        .toList();
  }

  /// yyyy-MM-dd.
  final String date;
  final List<Song> praise;
  final List<Song> worship;
  final SpecialItem specialItem;

  int get songCount =>
      praise.where((s) => !s.isEmpty).length +
      worship.where((s) => !s.isEmpty).length;

  SundayPlan copyWith({
    String? date,
    List<Song>? praise,
    List<Song>? worship,
    SpecialItem? specialItem,
  }) =>
      SundayPlan(
        date: date ?? this.date,
        praise: praise ?? this.praise,
        worship: worship ?? this.worship,
        specialItem: specialItem ?? this.specialItem,
      );

  Map<String, dynamic> toMap() => {
        'date': date,
        'praise': praise.map((s) => s.toMap()).toList(),
        'worship': worship.map((s) => s.toMap()).toList(),
        'specialItem': specialItem.toMap(),
      };
}

class Uniforms {
  const Uniforms({
    this.firstSundayGents = '',
    this.firstSundayLadies = '',
    this.secondSundayGents = '',
    this.secondSundayLadies = '',
    this.notes = '',
  });

  factory Uniforms.fromMap(Map<String, dynamic> map) => Uniforms(
        firstSundayGents: '${map['firstSundayGents'] ?? ''}',
        firstSundayLadies: '${map['firstSundayLadies'] ?? ''}',
        secondSundayGents: '${map['secondSundayGents'] ?? ''}',
        secondSundayLadies: '${map['secondSundayLadies'] ?? ''}',
        notes: '${map['notes'] ?? ''}',
      );

  final String firstSundayGents;
  final String firstSundayLadies;
  final String secondSundayGents;
  final String secondSundayLadies;
  final String notes;

  Uniforms copyWith({
    String? firstSundayGents,
    String? firstSundayLadies,
    String? secondSundayGents,
    String? secondSundayLadies,
    String? notes,
  }) =>
      Uniforms(
        firstSundayGents: firstSundayGents ?? this.firstSundayGents,
        firstSundayLadies: firstSundayLadies ?? this.firstSundayLadies,
        secondSundayGents: secondSundayGents ?? this.secondSundayGents,
        secondSundayLadies: secondSundayLadies ?? this.secondSundayLadies,
        notes: notes ?? this.notes,
      );

  Map<String, dynamic> toMap() => {
        'firstSundayGents': firstSundayGents,
        'firstSundayLadies': firstSundayLadies,
        'secondSundayGents': secondSundayGents,
        'secondSundayLadies': secondSundayLadies,
        'notes': notes,
      };
}

class Rehearsal {
  const Rehearsal({
    required this.id,
    this.date = '',
    this.time = '',
    this.location = '',
    this.coordinator = '',
    this.focus = '',
  });

  factory Rehearsal.fromMap(Map<String, dynamic> map) => Rehearsal(
        id: '${map['id'] ?? ''}',
        date: '${map['date'] ?? ''}',
        time: '${map['time'] ?? ''}',
        location: '${map['location'] ?? ''}',
        coordinator: '${map['coordinator'] ?? ''}',
        focus: '${map['focus'] ?? ''}',
      );

  final String id;
  final String date;
  final String time;
  final String location;
  final String coordinator;
  final String focus;

  Rehearsal copyWith({
    String? date,
    String? time,
    String? location,
    String? coordinator,
    String? focus,
  }) =>
      Rehearsal(
        id: id,
        date: date ?? this.date,
        time: time ?? this.time,
        location: location ?? this.location,
        coordinator: coordinator ?? this.coordinator,
        focus: focus ?? this.focus,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'date': date,
        'time': time,
        'location': location,
        'coordinator': coordinator,
        'focus': focus,
      };
}

class LatreuoCycle {
  const LatreuoCycle({
    this.cycleName = '',
    this.preparedBy = '',
    this.firstSunday = const SundayPlan(),
    this.secondSunday = const SundayPlan(),
    this.uniforms = const Uniforms(),
    this.rehearsals = const [],
    this.scriptureReference = '',
    this.scriptureText = '',
    this.prayerDirection = '',
  });

  factory LatreuoCycle.fromMap(Map<String, dynamic> map) {
    final scripture = map['scripture'] is Map
        ? Map<String, dynamic>.from(map['scripture'] as Map)
        : const <String, dynamic>{};
    return LatreuoCycle(
      cycleName: '${map['cycleName'] ?? ''}',
      preparedBy: '${map['preparedBy'] ?? ''}',
      firstSunday: SundayPlan.fromMap(map['firstSunday'] is Map
          ? Map<String, dynamic>.from(map['firstSunday'] as Map)
          : const {}),
      secondSunday: SundayPlan.fromMap(map['secondSunday'] is Map
          ? Map<String, dynamic>.from(map['secondSunday'] as Map)
          : const {}),
      uniforms: Uniforms.fromMap(map['uniforms'] is Map
          ? Map<String, dynamic>.from(map['uniforms'] as Map)
          : const {}),
      rehearsals: (map['rehearsals'] is List)
          ? (map['rehearsals'] as List)
              .whereType<Map>()
              .map((m) => Rehearsal.fromMap(Map<String, dynamic>.from(m)))
              .toList()
          : const [],
      scriptureReference: '${scripture['reference'] ?? ''}',
      scriptureText: '${scripture['text'] ?? ''}',
      prayerDirection: '${map['prayerDirection'] ?? ''}',
    );
  }

  /// A fresh cycle with the next two Sundays already filled in, and four
  /// blank song rows each — the shape a planner actually starts from.
  factory LatreuoCycle.empty({String preparedBy = ''}) {
    final firstSunday = D.nextSunday(DateTime.now());
    final secondSunday = firstSunday.add(const Duration(days: 7));
    List<Song> blanks(String prefix) =>
        [for (var i = 0; i < 4; i++) Song(id: '$prefix-$i')];

    return LatreuoCycle(
      cycleName: '${D.monthYear(firstSunday)} cycle',
      preparedBy: preparedBy,
      firstSunday: SundayPlan(
        date: D.iso(firstSunday),
        praise: blanks('s1-praise'),
        worship: blanks('s1-worship'),
      ),
      secondSunday: SundayPlan(
        date: D.iso(secondSunday),
        praise: blanks('s2-praise'),
        worship: blanks('s2-worship'),
      ),
      // Rehearsals default to the Friday before each Sunday, which is when
      // the team actually meets.
      rehearsals: [
        Rehearsal(
          id: 'r1',
          date: D.iso(firstSunday.subtract(const Duration(days: 2))),
          time: '18:00',
          location: 'Church',
        ),
        Rehearsal(
          id: 'r2',
          date: D.iso(secondSunday.subtract(const Duration(days: 2))),
          time: '18:00',
          location: 'Church',
        ),
      ],
    );
  }

  final String cycleName;
  final String preparedBy;
  final SundayPlan firstSunday;
  final SundayPlan secondSunday;
  final Uniforms uniforms;
  final List<Rehearsal> rehearsals;
  final String scriptureReference;
  final String scriptureText;
  final String prayerDirection;

  LatreuoCycle copyWith({
    String? cycleName,
    String? preparedBy,
    SundayPlan? firstSunday,
    SundayPlan? secondSunday,
    Uniforms? uniforms,
    List<Rehearsal>? rehearsals,
    String? scriptureReference,
    String? scriptureText,
    String? prayerDirection,
  }) =>
      LatreuoCycle(
        cycleName: cycleName ?? this.cycleName,
        preparedBy: preparedBy ?? this.preparedBy,
        firstSunday: firstSunday ?? this.firstSunday,
        secondSunday: secondSunday ?? this.secondSunday,
        uniforms: uniforms ?? this.uniforms,
        rehearsals: rehearsals ?? this.rehearsals,
        scriptureReference: scriptureReference ?? this.scriptureReference,
        scriptureText: scriptureText ?? this.scriptureText,
        prayerDirection: prayerDirection ?? this.prayerDirection,
      );

  Map<String, dynamic> toMap() => {
        'version': 1,
        'cycleName': cycleName,
        'preparedBy': preparedBy,
        'firstSunday': firstSunday.toMap(),
        'secondSunday': secondSunday.toMap(),
        'uniforms': uniforms.toMap(),
        'rehearsals': rehearsals.map((r) => r.toMap()).toList(),
        'scripture': {
          'reference': scriptureReference,
          'text': scriptureText,
        },
        'prayerDirection': prayerDirection,
      };
}

const List<String> kLatreuoSteps = [
  'Cycle',
  'First Sunday',
  'Second Sunday',
  'Uniforms',
  'Rehearsals',
  'Scripture',
  'Preview',
];

/// Autosaved draft, so a planner interrupted mid-cycle does not lose an hour
/// of work. Kept on the device rather than the server: an unfinished cycle is
/// nobody else's business until it is exported.
class LatreuoDraftStore {
  LatreuoDraftStore(this._prefs);

  static const String _key = 'latreuo-draft-v1';

  final SharedPreferences _prefs;

  static Future<LatreuoDraftStore> open() async =>
      LatreuoDraftStore(await SharedPreferences.getInstance());

  LatreuoCycle? load() {
    final raw = _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return LatreuoCycle.fromMap(Map<String, dynamic>.from(decoded));
    } catch (_) {
      return null;
    }
  }

  Future<void> save(LatreuoCycle cycle) async {
    try {
      await _prefs.setString(_key, jsonEncode(cycle.toMap()));
    } catch (_) {
      // Losing the draft is bad but not worth crashing the planner over.
    }
  }

  Future<void> clear() async {
    try {
      await _prefs.remove(_key);
    } catch (_) {
      // Nothing sensible to do.
    }
  }
}
