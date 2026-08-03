import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/camp/meal_queue.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../core/widgets/scanner_view.dart';
import '../../data/models/camp.dart';
import '../../data/repositories/camp_repository.dart';

/// The meal serving line.
///
/// Built for a venue where the network comes and goes and eighty teenagers are
/// waiting: the scan is validated against a cached roster and answered
/// instantly, then queued. Nothing at the line ever blocks on a round trip.
class MealScannerScreen extends ConsumerStatefulWidget {
  const MealScannerScreen({super.key});

  @override
  ConsumerState<MealScannerScreen> createState() => _MealScannerScreenState();
}

/// What the line just did, shown as a big coloured card above the camera.
enum _Verdict { served, alreadyServed, unknown, wrongQr, queued }

class _MealScannerScreenState extends ConsumerState<MealScannerScreen> {
  MealQueueStore? _store;
  List<QueuedMealScan> _queue = const [];
  CachedRoster? _roster;
  CampMealSitting? _sitting;

  bool _loadingRoster = true;
  bool _flushing = false;
  bool _online = true;
  String? _rosterError;

  _Verdict? _verdict;
  String _verdictName = '';
  String _verdictDetail = '';
  CachedCamper? _verdictCamper;
  Timer? _verdictTimer;

  Timer? _flushTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  @override
  void initState() {
    super.initState();
    _sitting = resolveCurrentSitting(kDefaultCampId, DateTime.now());
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    _verdictTimer?.cancel();
    _flushTimer?.cancel();
    unawaited(_connectivitySub?.cancel());
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final store = await MealQueueStore.open();
    if (!mounted) return;
    setState(() {
      _store = store;
      _queue = store.loadQueue();
      _roster = _sitting == null ? null : store.loadRoster(_sitting!.id);
    });

    // Flush whenever signal returns, and on a slow timer as a backstop for
    // the case where connectivity claims to be up but the request still fails.
    _connectivitySub =
        Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (mounted) setState(() => _online = online);
      if (online) unawaited(_flush());
    });
    _flushTimer = Timer.periodic(
        AppConfig.mealQueueFlushInterval, (_) => unawaited(_flush()));

    final results = await Connectivity().checkConnectivity();
    if (mounted) {
      setState(() =>
          _online = results.any((r) => r != ConnectivityResult.none));
    }

    await _refreshRoster();
    unawaited(_flush());
  }

  Future<void> _refreshRoster() async {
    final sitting = _sitting;
    if (sitting == null) {
      setState(() => _loadingRoster = false);
      return;
    }
    setState(() {
      _loadingRoster = true;
      _rosterError = null;
    });
    try {
      final roster = await ref
          .read(campRepositoryProvider)
          .mealRoster(campId: sitting.campId, sittingId: sitting.id);
      final cached = CachedRoster(
        sittingId: sitting.id,
        campers: roster.campers.map(CachedCamper.fromMap).toList(),
        servedIds: roster.servedIds,
        cachedAt: DateTime.now().toIso8601String(),
      );
      await _store?.saveRoster(cached);
      if (!mounted) return;
      setState(() {
        _roster = cached;
        _loadingRoster = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingRoster = false;
        // A cached roster from earlier is far more useful at the line than an
        // error, so only surface the failure when we have nothing at all.
        _rosterError = _roster == null ? e.message : null;
      });
    }
  }

  // ── Scanning ──

  void _onPayload(String raw) {
    final sitting = _sitting;
    if (sitting == null) return;

    if (looksLikeExitPassQr(raw)) {
      _showVerdict(
        _Verdict.wrongQr,
        name: 'Exit pass, not a meal badge',
        detail: "Scan the camper's camp badge instead.",
      );
      return;
    }

    final code = normalizeMealCode(raw);
    if (code.isEmpty) {
      _showVerdict(
        _Verdict.wrongQr,
        name: "That isn't a camper badge",
        detail: 'Try again, or type the code in below.',
      );
      return;
    }

    unawaited(_serve(code, sitting));
  }

  Future<void> _serve(String code, CampMealSitting sitting) async {
    final roster = _roster;
    final camper = roster?.byCode(code);

    // ── Answer from the cache, immediately ──
    if (camper == null) {
      // We may simply have a stale roster — a camper who registered after the
      // last refresh. Say so honestly rather than turning them away.
      _showVerdict(
        _Verdict.unknown,
        name: 'No camper matches that badge',
        detail: roster == null
            ? 'The roster has not loaded yet. Reconnect and pull to refresh.'
            : 'If they registered today, refresh the roster and try again.',
      );
      return;
    }

    if (roster!.servedIds.contains(camper.id)) {
      _showVerdict(
        _Verdict.alreadyServed,
        name: camper.fullName,
        detail: 'Already had ${sitting.label.toLowerCase()}.',
        camper: camper,
      );
      return;
    }

    // ── Record it locally, then queue the write ──
    final servedAt = DateTime.now();
    final updatedRoster = roster.withServed(camper.id);
    await _store?.saveRoster(updatedRoster);

    final queue = await _store?.enqueue(
          _queue,
          sittingId: sitting.id,
          registrationId: camper.id,
          code: code,
          camperName: camper.fullName,
          servedAt: servedAt,
          offline: !_online,
        ) ??
        _queue;

    if (!mounted) return;
    setState(() {
      _roster = updatedRoster;
      _queue = queue;
    });

    _showVerdict(
      _online ? _Verdict.served : _Verdict.queued,
      name: camper.fullName,
      detail: _foodNote(camper) ??
          (_online
              ? 'Served · ${sitting.label.toLowerCase()}'
              : 'Saved offline — will sync when signal returns'),
      camper: camper,
    );

    unawaited(_flush());
  }

  static String? _foodNote(CachedCamper camper) {
    final parts = <String>[
      if ((camper.allergies ?? '').isNotEmpty) 'Allergy: ${camper.allergies}',
      if ((camper.dietaryPreference ?? '').isNotEmpty)
        'Diet: ${camper.dietaryPreference}',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  void _showVerdict(
    _Verdict verdict, {
    required String name,
    required String detail,
    CachedCamper? camper,
  }) {
    _verdictTimer?.cancel();
    setState(() {
      _verdict = verdict;
      _verdictName = name;
      _verdictDetail = detail;
      _verdictCamper = camper;
    });
    _verdictTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) setState(() => _verdict = null);
    });
  }

  // ── Flushing ──

  Future<void> _flush() async {
    if (_flushing || _queue.isEmpty || _store == null) return;
    setState(() => _flushing = true);

    final repo = ref.read(campRepositoryProvider);
    var queue = _queue;

    for (final item in List<QueuedMealScan>.from(queue)) {
      try {
        final result = await repo.scanMeal(
          code: item.code,
          sittingId: item.sittingId,
          servedAt: DateTime.tryParse(item.servedAt),
          queuedOffline: item.offline,
        );
        // Both outcomes mean the camper is on the register: a fresh create,
        // or the collision that proves a previous attempt already landed.
        if (result.success || result.alreadyServed) {
          queue = await _store!.remove(queue, item.key);
        } else {
          queue = await _store!.bumpAttempts(queue, item.key);
        }
      } on ApiException catch (e) {
        if (e.isNetwork) {
          // Still offline — stop here and keep the rest of the queue intact.
          break;
        }
        if (e.isConflict) {
          // Already served: the write we were retrying landed earlier.
          queue = await _store!.remove(queue, item.key);
          continue;
        }
        if (e.isNotFound || e.statusCode == 400) {
          // The server will never accept this item — a badge that no longer
          // resolves, or a sitting outside the plan. Drop it rather than
          // retrying forever, and tell the server-side register keeper.
          queue = await _store!.remove(queue, item.key);
          if (mounted) {
            context.showError('${item.camperName}: ${e.message}');
          }
          continue;
        }
        queue = await _store!.bumpAttempts(queue, item.key);
      } catch (_) {
        queue = await _store!.bumpAttempts(queue, item.key);
      }
    }

    if (!mounted) return;
    setState(() {
      _queue = queue;
      _flushing = false;
    });
  }

  Future<void> _undo(CachedCamper camper) async {
    final sitting = _sitting;
    if (sitting == null) return;
    final ok = await confirmAction(
      context,
      title: 'Undo ${camper.firstName}?',
      message:
          'This takes ${camper.fullName} back off the ${sitting.label.toLowerCase()} '
          'register so they can be served again.',
      confirmLabel: 'Undo',
      destructive: true,
    );
    if (!ok) return;

    // Clear any pending write first — otherwise the flush would immediately
    // re-serve the camper we just took off.
    final queue = await _store?.remove(
            _queue, buildMealScanId(sitting.id, camper.id)) ??
        _queue;
    final roster = _roster?.withoutServed(camper.id);
    if (roster != null) await _store?.saveRoster(roster);
    if (mounted) {
      setState(() {
        _queue = queue;
        _roster = roster;
      });
    }

    try {
      await ref.read(campRepositoryProvider).undoMeal(
            sittingId: sitting.id,
            registrationId: camper.id,
          );
      if (mounted) context.showSuccess('${camper.firstName} taken off.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    }
  }

  // ── UI ──

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.can(kMealFeatureServe)) {
      return const AppScaffold(
        title: 'Meals',
        body: NoAccessView(
          message: 'Serving the meal line needs the Serve Camp Meals '
              'permission. Ask the Camp Manager.',
        ),
      );
    }

    final sitting = _sitting;
    final roster = _roster;
    final servedCount = roster?.servedIds.length ?? 0;
    final total = roster?.campers.length ?? 0;

    return AppScaffold(
      title: 'Meal line',
      subtitle: sitting?.label,
      showBottomNav: false,
      padded: false,
      actions: [
        IconButton(
          icon: const Icon(AppIcons.refresh),
          tooltip: 'Refresh roster',
          onPressed: _loadingRoster ? null : _refreshRoster,
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _StatusStrip(
            online: _online,
            pending: _queue.length,
            flushing: _flushing,
            onFlush: _flush,
          ),
          const SizedBox(height: 14),

          if (sitting == null)
            const NoticeCard(
              tone: IconTone.rose,
              icon: AppIcons.alert,
              title: 'No sitting for today',
              message: 'The camp meal plan does not cover today. Pick a '
                  'sitting below if you are testing before camp.',
            )
          else
            _SittingPicker(
              sitting: sitting,
              onChanged: (next) async {
                setState(() {
                  _sitting = next;
                  _roster = _store?.loadRoster(next.id);
                  _verdict = null;
                });
                await _refreshRoster();
              },
            ),
          const SizedBox(height: 14),

          if (_verdict != null) ...[
            _VerdictCard(
              verdict: _verdict!,
              name: _verdictName,
              detail: _verdictDetail,
              onUndo: _verdict == _Verdict.served ||
                      _verdict == _Verdict.queued
                  ? () {
                      final camper = _verdictCamper;
                      if (camper != null) unawaited(_undo(camper));
                    }
                  : null,
            ),
            const SizedBox(height: 14),
          ],

          if (sitting != null)
            ScannerView(
              onDetect: _onPayload,
              overlayLabel: "Scan the camper's badge",
              height: 300,
            ),
          const SizedBox(height: 16),

          if (sitting != null)
            ManualCodeEntry(
              onSubmit: (code) => _onPayload(code),
              label: 'Or type the badge code',
            ),
          const SizedBox(height: 22),

          if (_loadingRoster && roster == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: LoadingView(message: 'Loading the roster…'),
            )
          else if (_rosterError != null)
            NoticeCard(
              tone: IconTone.rose,
              icon: AppIcons.alert,
              title: 'Roster unavailable',
              message: _rosterError!,
            )
          else if (roster != null) ...[
            SectionHeading(
              title: 'Served',
              icon: AppIcons.utensils,
              tone: IconTone.emerald,
              subtitle: '$servedCount of $total campers',
            ),
            const SizedBox(height: 12),
            _ServedList(roster: roster, onUndo: _undo),
          ],
        ],
      ),
    );
  }
}

class _StatusStrip extends StatelessWidget {
  const _StatusStrip({
    required this.online,
    required this.pending,
    required this.flushing,
    required this.onFlush,
  });

  final bool online;
  final int pending;
  final bool flushing;
  final VoidCallback onFlush;

  @override
  Widget build(BuildContext context) {
    final tone = !online
        ? IconTone.amber
        : pending > 0
            ? IconTone.blue
            : IconTone.emerald;
    final colors = toneColors(tone);

    final message = !online
        ? pending > 0
            ? 'Offline · $pending scan${pending == 1 ? '' : 's'} waiting to sync'
            : 'Offline · scans will be saved and synced later'
        : pending > 0
            ? flushing
                ? 'Syncing $pending scan${pending == 1 ? '' : 's'}…'
                : '$pending scan${pending == 1 ? '' : 's'} waiting to sync'
            : 'Online · everything synced';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: colors.foreground.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Icon(
            online ? AppIcons.online : AppIcons.offline,
            size: 17,
            color: colors.foreground,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: colors.foreground,
              ),
            ),
          ),
          if (pending > 0 && online && !flushing)
            TextButton(
              onPressed: onFlush,
              style: TextButton.styleFrom(
                foregroundColor: colors.foreground,
                minimumSize: const Size(0, 30),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: const Text('Sync now'),
            ),
          if (flushing)
            SizedBox(
              height: 15,
              width: 15,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: colors.foreground),
            ),
        ],
      ),
    );
  }
}

class _SittingPicker extends StatelessWidget {
  const _SittingPicker({required this.sitting, required this.onChanged});

  final CampMealSitting sitting;
  final ValueChanged<CampMealSitting> onChanged;

  @override
  Widget build(BuildContext context) {
    final sittings = getCampSittings(sitting.campId);
    return LuxCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Row(
        children: [
          const IconChip(AppIcons.utensils, tone: IconTone.gold, size: 40),
          const SizedBox(width: 13),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: sitting.id,
                isExpanded: true,
                icon: const Icon(AppIcons.chevronDown,
                    size: 16, color: AppColors.clay400),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.clay700,
                ),
                items: [
                  for (final s in sittings)
                    DropdownMenuItem(
                      value: s.id,
                      child: Text(
                        _titleCase(s.label),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (id) {
                  for (final s in sittings) {
                    if (s.id == id) {
                      onChanged(s);
                      return;
                    }
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _titleCase(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

class _VerdictCard extends StatelessWidget {
  const _VerdictCard({
    required this.verdict,
    required this.name,
    required this.detail,
    this.onUndo,
  });

  final _Verdict verdict;
  final String name;
  final String detail;
  final VoidCallback? onUndo;

  @override
  Widget build(BuildContext context) {
    final (icon, tone) = switch (verdict) {
      _Verdict.served => (AppIcons.checkCircle, IconTone.emerald),
      _Verdict.queued => (AppIcons.cloudUpload, IconTone.blue),
      _Verdict.alreadyServed => (AppIcons.alert, IconTone.amber),
      _Verdict.unknown => (AppIcons.xCircle, IconTone.rose),
      _Verdict.wrongQr => (AppIcons.xCircle, IconTone.rose),
    };
    final colors = toneColors(tone);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(AppRadius.lux),
        border: Border.all(color: colors.foreground.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, size: 30, color: colors.foreground),
              const SizedBox(width: 13),
              Expanded(
                child: Text(
                  name,
                  style: AppFonts.display(TextStyle(
                    fontSize: 21,
                    height: 1.15,
                    color: colors.foreground,
                  )),
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            detail,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.45,
              fontWeight: FontWeight.w600,
              color: colors.foreground.withValues(alpha: 0.9),
            ),
          ),
          if (onUndo != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onUndo,
              icon: const Icon(AppIcons.refresh, size: 15),
              label: const Text('Undo'),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.foreground,
                side: BorderSide(
                    color: colors.foreground.withValues(alpha: 0.35)),
                minimumSize: const Size(0, 40),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServedList extends StatelessWidget {
  const _ServedList({required this.roster, required this.onUndo});

  final CachedRoster roster;
  final Future<void> Function(CachedCamper) onUndo;

  @override
  Widget build(BuildContext context) {
    final servedSet = roster.servedIds.toSet();
    final served =
        roster.campers.where((c) => servedSet.contains(c.id)).toList();

    if (served.isEmpty) {
      return const LuxCard(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text(
            'Nobody served yet at this sitting.',
            style: TextStyle(fontSize: 13.5, color: AppColors.clay400),
          ),
        ),
      );
    }

    return LuxCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          for (var i = 0; i < served.length; i++) ...[
            if (i > 0) const LuxDivider(),
            LuxTile(
              title: served[i].fullName,
              subtitle: served[i].churchOrSchool,
              icon: AppIcons.checkCircle,
              tone: served[i].isPaymentFlagged
                  ? IconTone.amber
                  : IconTone.emerald,
              dense: true,
              trailing: IconButton(
                icon: const Icon(AppIcons.refresh, size: 16),
                color: AppColors.clay400,
                tooltip: 'Undo',
                onPressed: () => onUndo(served[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The kitchen's view of a sitting: how many served, and the food notes that
/// matter at the moment of serving.
class MealSummaryTile extends StatelessWidget {
  const MealSummaryTile({
    super.key,
    required this.sitting,
    required this.served,
    required this.total,
  });

  final CampMealSitting sitting;
  final int served;
  final int total;

  @override
  Widget build(BuildContext context) {
    return LuxTile(
      title: _titleCase(sitting.label),
      subtitle:
          '$served of $total served · ${D.medium(DateTime.tryParse(sitting.date))}',
      icon: AppIcons.utensils,
      tone: served >= total && total > 0 ? IconTone.emerald : IconTone.clay,
      dense: true,
      trailing: Text(
        '$served',
        style: AppFonts.display(
            const TextStyle(fontSize: 18, color: AppColors.clay700)),
      ),
    );
  }

  static String _titleCase(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}
