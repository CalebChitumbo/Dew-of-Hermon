import 'package:flutter_test/flutter_test.dart';

import 'package:dew_of_hermon/core/camp/camp_meals.dart';
import 'package:dew_of_hermon/data/models/enums.dart';

/// The meal line is the part of the app that runs on a bad network in front of
/// a queue of hungry campers. Its code handling and its scan id are the two
/// things that must not drift.
void main() {
  const campId = 'rops-x-2026';

  group('normalizeMealCode', () {
    test('accepts a bare code, a dashed code and a badge URL alike', () {
      const expected = 'ABCDEFGH';
      expect(normalizeMealCode('abcdefgh'), expected);
      expect(normalizeMealCode('ABCD-EFGH'), expected);
      expect(normalizeMealCode('  abcd efgh  '), expected);
      expect(
        normalizeMealCode('https://example.com/rops-camp/track?code=abcd-efgh'),
        expected,
      );
    });

    test('refuses an exit-pass QR', () {
      // An approved pass to leave camp is not a meal card. Quietly accepting
      // one would tick the wrong camper off the register.
      expect(
        normalizeMealCode('https://example.com/rops-camp/track?pass=XYZ123'),
        '',
      );
      expect(
        looksLikeExitPassQr(
            'https://example.com/rops-camp/track?pass=XYZ123'),
        isTrue,
      );
      expect(
        looksLikeExitPassQr(
            'https://example.com/rops-camp/track?code=ABCDEFGH'),
        isFalse,
      );
      expect(looksLikeExitPassQr('ABCDEFGH'), isFalse);
    });
  });

  group('normalizePassCode', () {
    test('pulls the pass out of an exit-pass QR', () {
      expect(
        normalizePassCode('https://example.com/rops-camp/track?pass=xy-z123'),
        'XYZ123',
      );
    });

    test('refuses a camper badge', () {
      expect(
        normalizePassCode(
            'https://example.com/rops-camp/track?code=ABCDEFGH'),
        '',
      );
    });
  });

  test('formatMealCode groups in fours for reading aloud', () {
    expect(formatMealCode('ABCDEFGHJKMN'), 'ABCD-EFGH-JKMN');
    expect(formatMealCode('ABC'), 'ABC');
    expect(formatMealCode(''), '');
  });

  group('scan id', () {
    test('is deterministic, which is what makes offline replay safe', () {
      // The server creates rather than sets on this id, so a replayed scan
      // collides instead of serving a second meal.
      final a = buildMealScanId('sitting-1', 'reg-9');
      final b = buildMealScanId('sitting-1', 'reg-9');
      expect(a, b);
      expect(a, 'sitting-1_reg-9');
      expect(buildMealScanId('sitting-1', 'reg-8'), isNot(a));
    });
  });

  group('sittings', () {
    test('the camp has a sitting plan and every id round-trips', () {
      final sittings = getCampSittings(campId);
      expect(sittings, isNotEmpty);

      for (final sitting in sittings) {
        expect(getSitting(sitting.id)?.id, sitting.id);
        expect(sittingBelongsToCamp(sitting.id, campId), isTrue);
        expect(sittingBelongsToCamp(sitting.id, 'another-camp'), isFalse);
      }
    });

    test('sittings are in chronological order', () {
      final sittings = getCampSittings(campId);
      for (var i = 1; i < sittings.length; i++) {
        final previous = sittings[i - 1];
        final current = sittings[i];
        final ordered = previous.date.compareTo(current.date) < 0 ||
            (previous.date == current.date &&
                previous.opensAt.compareTo(current.opensAt) <= 0);
        expect(ordered, isTrue,
            reason: '${previous.id} should precede ${current.id}');
      }
    });

    test('an unknown sitting id resolves to nothing', () {
      expect(getSitting('not-a-sitting'), isNull);
      expect(sittingBelongsToCamp('not-a-sitting', campId), isFalse);
    });
  });

  group('resolveCurrentSitting', () {
    late CampMealSitting first;

    setUp(() => first = getCampSittings(campId).first);

    test('picks the sitting that is open right now', () {
      final parts = first.opensAt.split(':');
      final date = DateTime.parse('${first.date}T00:00:00');
      final duringService = DateTime(
        date.year,
        date.month,
        date.day,
        int.parse(parts[0]),
        int.parse(parts[1]) + 1,
      );
      expect(resolveCurrentSitting(campId, duringService)?.id, first.id);
    });

    test('before camp starts, points at the first sitting', () {
      final wayBefore = DateTime.parse('${first.date}T00:00:00')
          .subtract(const Duration(days: 30));
      expect(resolveCurrentSitting(campId, wayBefore)?.id, first.id);
    });

    test('after camp ends, points at the last sitting rather than nothing', () {
      final sittings = getCampSittings(campId);
      final wayAfter = DateTime.parse('${sittings.last.date}T00:00:00')
          .add(const Duration(days: 30));
      expect(resolveCurrentSitting(campId, wayAfter)?.id, sittings.last.id);
    });

    test('an unknown camp has no sitting', () {
      expect(resolveCurrentSitting('no-such-camp', DateTime.now()), isNull);
    });
  });

  group('meal slots', () {
    test('every slot has a sane open/close window', () {
      for (final slot in CampMealSlot.values) {
        expect(slot.opensAt, matches(RegExp(r'^\d{2}:\d{2}$')));
        expect(slot.closesAt, matches(RegExp(r'^\d{2}:\d{2}$')));
        expect(slot.opensAt.compareTo(slot.closesAt), lessThan(0),
            reason: '${slot.wire} closes before it opens');
      }
    });
  });
}
