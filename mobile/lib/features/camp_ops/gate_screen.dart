import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../core/widgets/scanner_view.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

/// The camp gate.
///
/// A pass ticket is scanned exactly twice — once out, once back in — and any
/// scan after that is refused, so a forwarded screenshot or a photocopy is
/// worthless. The guard sees who they are looking at before they commit, then
/// taps the one direction the pass is actually in.
class CampGateScreen extends ConsumerStatefulWidget {
  const CampGateScreen({super.key});

  @override
  ConsumerState<CampGateScreen> createState() => _CampGateScreenState();
}

class _CampGateScreenState extends ConsumerState<CampGateScreen> {
  PassLookup? _lookup;
  String? _scannedCode;
  String? _error;
  bool _looking = false;
  bool _recording = false;

  /// The last few scans this shift, so the guard can see what just happened
  /// without leaving the camera.
  final List<_GateEvent> _log = [];

  Future<void> _resolve(String raw) async {
    if (_looking) return;

    final code = normalizePassCode(raw);
    if (code.isEmpty) {
      setState(() {
        _lookup = null;
        _error = "That QR code isn't an exit pass. A camper's arrival badge "
            'is not a gate pass.';
      });
      return;
    }

    setState(() {
      _looking = true;
      _error = null;
    });
    try {
      final result = await ref.read(campRepositoryProvider).lookupPass(code);
      if (!mounted) return;
      setState(() {
        _lookup = result;
        _scannedCode = code;
        _looking = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _lookup = null;
        _error = e.message;
        _looking = false;
      });
    }
  }

  Future<void> _record(String expect) async {
    final code = _scannedCode;
    if (code == null) return;

    setState(() => _recording = true);
    try {
      final result =
          await ref.read(campRepositoryProvider).scanPass(code: code, expect: expect);
      if (!mounted) return;

      final pass = result.pass;
      final name = pass?.camperName ?? 'Camper';
      final out = result.action == 'CHECK_OUT';

      setState(() {
        _recording = false;
        _lookup = null;
        _scannedCode = null;
        _log.insert(
          0,
          _GateEvent(
            name: name,
            out: out,
            late: result.late,
            at: DateTime.now(),
          ),
        );
        if (_log.length > 12) _log.removeLast();
      });

      context.showSuccess(out
          ? '$name signed out of camp.'
          : result.late
              ? '$name back in — returned late.'
              : '$name back in camp.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _recording = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can('scan_camp_passes')) {
      return const AppScaffold(
        title: 'Camp gate',
        body: NoAccessView(
          message: 'The gate scanner needs the Scan Camp Passes permission. '
              'Ask the Camp Manager.',
        ),
      );
    }

    final lookup = _lookup;

    return AppScaffold(
      title: 'Camp gate',
      subtitle: getCamp(kDefaultCampId)?.name,
      showBottomNav: false,
      padded: false,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          if (_error != null) ...[
            NoticeCard(
              message: _error!,
              tone: IconTone.rose,
              icon: AppIcons.xCircle,
            ),
            const SizedBox(height: 14),
          ],

          if (lookup?.pass != null) ...[
            _PassCard(
              lookup: lookup!,
              recording: _recording,
              onRecord: _record,
              onClear: () => setState(() {
                _lookup = null;
                _scannedCode = null;
                _error = null;
              }),
            ),
            const SizedBox(height: 16),
          ],

          ScannerView(
            onDetect: _resolve,
            paused: _looking || lookup?.pass != null,
            overlayLabel: 'Scan the exit pass ticket',
            height: 300,
          ),
          const SizedBox(height: 16),
          ManualCodeEntry(
            onSubmit: _resolve,
            busy: _looking,
            label: 'Or type the pass code',
          ),

          if (_log.isNotEmpty) ...[
            const SizedBox(height: 24),
            const SectionHeading(
              title: 'This shift',
              icon: AppIcons.history,
              tone: IconTone.clay,
            ),
            const SizedBox(height: 12),
            LuxCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (var i = 0; i < _log.length; i++) ...[
                    if (i > 0) const LuxDivider(),
                    LuxTile(
                      title: _log[i].name,
                      subtitle: '${_log[i].out ? 'Out' : 'Back in'} · '
                          '${D.time(_log[i].at)}'
                          '${_log[i].late ? ' · late' : ''}',
                      icon: _log[i].out
                          ? AppIcons.doorOpen
                          : AppIcons.checkCircle,
                      tone: _log[i].late
                          ? IconTone.amber
                          : _log[i].out
                              ? IconTone.blue
                              : IconTone.emerald,
                      dense: true,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _GateEvent {
  const _GateEvent({
    required this.name,
    required this.out,
    required this.late,
    required this.at,
  });

  final String name;
  final bool out;
  final bool late;
  final DateTime at;
}

class _PassCard extends StatelessWidget {
  const _PassCard({
    required this.lookup,
    required this.recording,
    required this.onRecord,
    required this.onClear,
  });

  final PassLookup lookup;
  final bool recording;
  final void Function(String expect) onRecord;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final pass = lookup.pass!;
    final verdict = lookup.verdict;
    final reg = lookup.registration;

    // What the guard should do next. The server already worked this out and
    // said so in `verdict.action`; falling back to the pass status keeps the
    // screen useful if an older deploy omits it.
    final action = verdict?.action ??
        switch (pass.status) {
          CampPassStatus.approved => 'CHECK_OUT',
          CampPassStatus.out => 'CHECK_IN',
          _ => null,
        };
    final allowed = action != null && (verdict?.ok ?? action.isNotEmpty);

    final tone = !allowed
        ? IconTone.rose
        : action == 'CHECK_OUT'
            ? IconTone.blue
            : IconTone.emerald;
    final colors = toneColors(tone);

    return LuxCard(
      border: colors.foreground.withValues(alpha: 0.32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                allowed ? AppIcons.ticket : AppIcons.xCircle,
                tone: tone,
                size: 50,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      pass.camperName,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 23,
                        height: 1.12,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 5),
                    StatusBadge(pass.status.label, tone: tone),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(AppIcons.close, size: 18),
                color: AppColors.clay300,
                tooltip: 'Clear',
                onPressed: onClear,
              ),
            ],
          ),

          if (verdict != null && verdict.message.isNotEmpty) ...[
            const SizedBox(height: 14),
            NoticeCard(
              tone: tone,
              icon: allowed ? AppIcons.info : AppIcons.alert,
              title: verdict.title.isEmpty ? null : verdict.title,
              message: verdict.message,
            ),
          ],

          const SizedBox(height: 14),
          DetailRow(label: 'Reason', value: pass.reason, icon: AppIcons.info),
          if ((pass.destination ?? '').isNotEmpty)
            DetailRow(
              label: 'Destination',
              value: pass.destination!,
              icon: AppIcons.mapPin,
            ),
          DetailRow(
            label: 'Back by',
            value: '${D.dateTime(pass.expectedReturnAt)} · '
                '${D.relative(pass.expectedReturnAt)}',
            icon: AppIcons.clock,
          ),
          if ((pass.escortName ?? '').isNotEmpty)
            DetailRow(
              label: 'Escort',
              value: '${pass.escortName}'
                  '${(pass.escortPhone ?? '').isEmpty ? '' : ' · ${Phone.pretty(pass.escortPhone!)}'}',
              icon: AppIcons.user,
            ),
          if (reg != null && reg['emergencyContactPhone'] != null)
            DetailRow(
              label: 'Emergency',
              value: '${reg['emergencyContactName'] ?? ''} · '
                  '${Phone.pretty('${reg['emergencyContactPhone']}')}',
              icon: AppIcons.phone,
            ),
          if (pass.checkedOutAt != null)
            DetailRow(
              label: 'Signed out',
              value: '${D.dateTime(pass.checkedOutAt)}'
                  '${pass.checkedOutByName == null ? '' : ' · ${pass.checkedOutByName}'}',
              icon: AppIcons.doorOpen,
            ),

          if (pass.isOverdue) ...[
            const SizedBox(height: 12),
            const NoticeCard(
              tone: IconTone.amber,
              icon: AppIcons.alert,
              title: 'Overdue',
              message: 'This camper is past their expected return time. Sign '
                  'them back in and tell the Camp Manager.',
            ),
          ],

          const SizedBox(height: 18),
          if (allowed)
            PrimaryButton(
              label: action == 'CHECK_OUT'
                  ? 'Sign out of camp'
                  : 'Sign back into camp',
              icon: action == 'CHECK_OUT'
                  ? AppIcons.doorOpen
                  : AppIcons.checkCircle,
              loading: recording,
              onPressed: () => onRecord(action),
            )
          else
            OutlinedButton.icon(
              onPressed: onClear,
              icon: const Icon(AppIcons.close, size: 16),
              label: const Text('Dismiss'),
            ),
        ],
      ),
    );
  }
}
