import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dew_of_hermon/core/theme/app_icons.dart';
import 'package:dew_of_hermon/core/theme/app_theme.dart';
import 'package:dew_of_hermon/core/theme/icon_tones.dart';
import 'package:dew_of_hermon/core/widgets/common.dart';
import 'package:dew_of_hermon/core/widgets/lux.dart';
import 'package:dew_of_hermon/data/models/enums.dart';

/// Widget-level cover for the shared design-system pieces.
///
/// The app itself cannot be pumped in a test — `main()` initialises Firebase
/// first — so this exercises the primitives every screen is built from
/// instead. It also occupies the filename `flutter create` would otherwise
/// fill with a stub referencing a `MyApp` that does not exist here.
void main() {
  /// Every widget under test needs the real theme; several read
  /// `AppFonts`/`AppRadius` through it.
  Widget wrap(Widget child) => MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: SingleChildScrollView(child: child)),
      );

  testWidgets('StatusBadge renders its label', (tester) async {
    await tester.pumpWidget(wrap(
      const StatusBadge('Awaiting review', tone: IconTone.amber),
    ));
    expect(find.text('Awaiting review'), findsOneWidget);
  });

  testWidgets('StatusBadge.forStatus humanises a wire value', (tester) async {
    await tester.pumpWidget(wrap(
      StatusBadge.forStatus('PENDING_LEAD_APPROVAL'),
    ));
    expect(find.text('Pending lead approval'), findsOneWidget);
  });

  test('the humanised fallback matches how the enums label themselves', () {
    // A raw wire with no enum behind it still has to read like its
    // neighbours — sentence case, not title case.
    expect(StatusBadge.humanise('NO_RESPONSE'), AssignmentStatus.noResponse.label);
    expect(StatusBadge.humanise('CHANGES_REQUESTED'),
        EventApprovalStatus.changesRequested.label);
    expect(StatusBadge.humanise('CONFIRMED'), AssignmentStatus.confirmed.label);
    expect(StatusBadge.humanise(''), '');
  });

  testWidgets('EmptyStateLux shows its title, body and action',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      EmptyStateLux(
        icon: AppIcons.inbox,
        tone: IconTone.gold,
        title: 'Nothing here',
        description: 'Come back later.',
        action: PrimaryButton(
          label: 'Do the thing',
          expand: false,
          onPressed: () => tapped = true,
        ),
      ),
    ));

    expect(find.text('Nothing here'), findsOneWidget);
    expect(find.text('Come back later.'), findsOneWidget);

    await tester.tap(find.text('Do the thing'));
    expect(tapped, isTrue);
  });

  testWidgets('PrimaryButton swaps its label for a spinner while loading',
      (tester) async {
    await tester.pumpWidget(wrap(
      const PrimaryButton(label: 'Save', loading: true),
    ));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('a loading PrimaryButton cannot be pressed', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      PrimaryButton(
        label: 'Save',
        loading: true,
        onPressed: () => tapped = true,
      ),
    ));
    await tester.tap(find.byType(PrimaryButton), warnIfMissed: false);
    await tester.pump();
    expect(tapped, isFalse,
        reason: 'a button mid-request must not fire a second write');
  });

  testWidgets('SegmentedTabs reports the tab that was tapped', (tester) async {
    var selected = 0;
    await tester.pumpWidget(wrap(
      StatefulBuilder(
        builder: (context, setState) => SegmentedTabs(
          tabs: const ['Review', 'Pool', 'Closed'],
          selected: selected,
          counts: const {0: 2},
          onSelect: (i) => setState(() => selected = i),
        ),
      ),
    ));

    expect(find.text('Review'), findsOneWidget);
    await tester.tap(find.text('Closed'));
    await tester.pump();
    expect(selected, 2);
  });

  testWidgets('DetailRow shows its label and value', (tester) async {
    await tester.pumpWidget(wrap(
      const DetailRow(label: 'Venue', value: 'Main Auditorium'),
    ));
    expect(find.text('Venue'), findsOneWidget);
    expect(find.text('Main Auditorium'), findsOneWidget);
  });

  testWidgets('MemberAvatar falls back to initials without a photo',
      (tester) async {
    await tester.pumpWidget(wrap(const MemberAvatar(initials: 'JD')));
    expect(find.text('JD'), findsOneWidget);
  });

  testWidgets('LuxCard passes taps through', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      LuxCard(
        onTap: () => tapped = true,
        child: const Text('Tap me'),
      ),
    ));
    await tester.tap(find.text('Tap me'));
    expect(tapped, isTrue);
  });

  testWidgets('FieldLabel takes no space when it has no text', (tester) async {
    await tester.pumpWidget(wrap(const FieldLabel('')));
    expect(tester.getSize(find.byType(FieldLabel)).height, 0);
  });
}
