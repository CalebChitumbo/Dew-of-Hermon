import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/enums.dart';
import '../../data/models/ministry.dart';
import '../../data/models/user.dart';
import '../../data/repositories/ministry_repository.dart';
import '../services/service_detail_screen.dart' show activeMembersProvider;

final followUpsProvider = FutureProvider<List<FollowUpCard>>((ref) {
  return ref.watch(ministryRepositoryProvider).followUps();
});

final devotionalsProvider =
    FutureProvider.family<List<Devotional>, DevotionalScope>((ref, scope) {
  return ref.watch(ministryRepositoryProvider).devotionals(scope: scope);
});

/// Campus Ministry and Life Groups are the same shape — a weekly devotional
/// focus plus the contacts that came in from that source — so they share one
/// screen with the scope swapped.
class MinistryScreen extends ConsumerStatefulWidget {
  const MinistryScreen({
    super.key,
    required this.scope,
    required this.title,
    required this.pageKey,
    required this.manageFeature,
    required this.icon,
    required this.tone,
  });

  final DevotionalScope scope;
  final String title;
  final String pageKey;
  final String manageFeature;
  final IconData icon;
  final IconTone tone;

  @override
  ConsumerState<MinistryScreen> createState() => _MinistryScreenState();
}

class _MinistryScreenState extends ConsumerState<MinistryScreen> {
  int _tab = 0;

  FollowUpSource get _source => widget.scope == DevotionalScope.campusMinistry
      ? FollowUpSource.campusMinistry
      : FollowUpSource.lifeGroups;

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.canView(widget.pageKey)) {
      return AppScaffold(
        title: widget.title,
        body: NoAccessView(
          message: '${widget.title} is not available to your role.',
        ),
      );
    }

    final devotionals = ref.watch(devotionalsProvider(widget.scope));
    final cards = ref.watch(followUpsProvider);
    final canManage = access.can(widget.manageFeature);
    final canSubmit = access.can('submit_follow_up');

    return AppScaffold(
      title: widget.title,
      onRefresh: () async {
        ref.invalidate(devotionalsProvider(widget.scope));
        ref.invalidate(followUpsProvider);
      },
      floatingActionButton: canSubmit && _tab == 1
          ? FloatingActionButton.extended(
              onPressed: _newCard,
              icon: const Icon(AppIcons.userPlus, size: 19),
              label: const Text('New contact'),
            )
          : null,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          SegmentedTabs(
            tabs: const ['This week', 'Contacts'],
            selected: _tab,
            onSelect: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 18),

          if (_tab == 0)
            devotionals.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () =>
                    ref.invalidate(devotionalsProvider(widget.scope)),
              ),
              data: (list) => _Devotionals(
                devotionals: list,
                canManage: canManage,
                scope: widget.scope,
                icon: widget.icon,
                tone: widget.tone,
                onPost: _postDevotional,
              ),
            )
          else
            cards.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(followUpsProvider),
              ),
              data: (list) {
                final ours =
                    list.where((c) => c.source == _source).toList();
                return _ContactList(cards: ours, source: _source);
              },
            ),
        ],
      ),
    );
  }

  Future<void> _postDevotional() async {
    final posted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DevotionalSheet(scope: widget.scope),
    );
    if (posted == true) ref.invalidate(devotionalsProvider(widget.scope));
  }

  Future<void> _newCard() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FollowUpSheet(source: _source),
    );
    if (created == true) ref.invalidate(followUpsProvider);
  }
}

class _Devotionals extends StatelessWidget {
  const _Devotionals({
    required this.devotionals,
    required this.canManage,
    required this.scope,
    required this.icon,
    required this.tone,
    required this.onPost,
  });

  final List<Devotional> devotionals;
  final bool canManage;
  final DevotionalScope scope;
  final IconData icon;
  final IconTone tone;
  final VoidCallback onPost;

  @override
  Widget build(BuildContext context) {
    if (devotionals.isEmpty) {
      return EmptyStateLux(
        icon: icon,
        tone: tone,
        title: 'No devotional yet',
        description: 'The weekly focus is posted here for everyone to work '
            'through together.',
        action: canManage
            ? PrimaryButton(
                label: 'Post this week',
                expand: false,
                icon: AppIcons.plus,
                onPressed: onPost,
              )
            : null,
      );
    }

    final current = devotionals.first;
    final past = devotionals.skip(1).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (canManage) ...[
          OutlinedButton.icon(
            onPressed: onPost,
            icon: const Icon(AppIcons.plus, size: 15),
            label: const Text('Post a new devotional'),
          ),
          const SizedBox(height: 16),
        ],
        LuxCard(
          accent: toneColors(tone).foreground,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Builder(
                builder: (context) => Text(
                  'WEEK OF ${D.medium(D.fromIso(current.weekStartDate)).toUpperCase()}',
                  style: context.eyebrow,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                current.title,
                style: AppFonts.display(const TextStyle(
                  fontSize: 23,
                  height: 1.15,
                  color: AppColors.clay700,
                )),
              ),
              if ((current.scriptureReference ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                StatusBadge(current.scriptureReference!,
                    tone: tone, icon: AppIcons.bible),
              ],
              const SizedBox(height: 14),
              Text(
                current.content,
                style: const TextStyle(
                    fontSize: 14.5, height: 1.65, color: AppColors.clay600),
              ),
              const SizedBox(height: 14),
              Text(
                '— ${current.authorName}',
                style: const TextStyle(
                    fontSize: 12.5, color: AppColors.clay400),
              ),
            ],
          ),
        ),
        if (past.isNotEmpty) ...[
          const SizedBox(height: 24),
          const SectionHeading(
            title: 'Earlier weeks',
            icon: AppIcons.history,
            tone: IconTone.clay,
          ),
          const SizedBox(height: 12),
          LuxCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (var i = 0; i < past.length; i++) ...[
                  if (i > 0) const LuxDivider(),
                  LuxTile(
                    title: past[i].title,
                    subtitle:
                        '${D.medium(D.fromIso(past[i].weekStartDate))}'
                        '${(past[i].scriptureReference ?? '').isEmpty ? '' : ' · ${past[i].scriptureReference}'}',
                    icon: AppIcons.bible,
                    tone: IconTone.clay,
                    dense: true,
                    onTap: () => showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => _DevotionalReader(devotional: past[i]),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _DevotionalReader extends StatelessWidget {
  const _DevotionalReader({required this.devotional});

  final Devotional devotional;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          Text(
            devotional.title,
            style: AppFonts.display(
                const TextStyle(fontSize: 24, color: AppColors.clay700)),
          ),
          const SizedBox(height: 6),
          Text(
            'Week of ${D.medium(D.fromIso(devotional.weekStartDate))}'
            '${(devotional.scriptureReference ?? '').isEmpty ? '' : ' · ${devotional.scriptureReference}'}',
            style: const TextStyle(fontSize: 13, color: AppColors.clay400),
          ),
          const SizedBox(height: 18),
          Text(
            devotional.content,
            style: const TextStyle(
                fontSize: 15, height: 1.7, color: AppColors.clay600),
          ),
          const SizedBox(height: 18),
          Text(
            '— ${devotional.authorName}',
            style: const TextStyle(fontSize: 13, color: AppColors.clay400),
          ),
        ],
      ),
    );
  }
}

class _ContactList extends StatelessWidget {
  const _ContactList({required this.cards, required this.source});

  final List<FollowUpCard> cards;
  final FollowUpSource source;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) {
      return EmptyStateLux(
        icon: AppIcons.userPlus,
        tone: IconTone.sage,
        title: 'No contacts yet',
        description: 'People who came through ${source.label} appear here so '
            'the discipleship team can follow them up.',
      );
    }

    return Column(
      children: [
        for (final card in cards)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: FollowUpCardTile(card: card),
          ),
      ],
    );
  }
}

/// One contact in the pipeline, with the actions their stage allows.
class FollowUpCardTile extends ConsumerStatefulWidget {
  const FollowUpCardTile({super.key, required this.card});

  final FollowUpCard card;

  @override
  ConsumerState<FollowUpCardTile> createState() => _FollowUpCardTileState();
}

class _FollowUpCardTileState extends ConsumerState<FollowUpCardTile> {
  bool _busy = false;
  bool _expanded = false;

  Future<void> _advance(FollowUpStatus status) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(ministryRepositoryProvider)
          .updateFollowUp(widget.card.id, status: status);
      ref.invalidate(followUpsProvider);
      if (mounted) context.showSuccess('Moved to ${status.label}.');
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _assign() async {
    final members = ref.read(activeMembersProvider).valueOrNull ?? const [];
    final chosen = await showModalBottomSheet<AppUser>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AssigneePicker(members: members),
    );
    if (chosen == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).updateFollowUp(
            widget.card.id,
            assigneeId: chosen.id,
            assigneeName: chosen.name,
            status: FollowUpStatus.assigned,
          );
      ref.invalidate(followUpsProvider);
      if (mounted) {
        context.showSuccess('${chosen.firstName} will follow up.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approve(bool approve) async {
    String? reason;
    if (!approve) {
      reason = await promptForText(
        context,
        title: 'Turn this card down?',
        hint: 'Why — whoever submitted it sees this',
        confirmLabel: 'Turn down',
        required: true,
      );
      if (reason == null || reason.isEmpty) return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).approveFollowUp(
            widget.card.id,
            approve: approve,
            rejectionReason: reason,
          );
      ref.invalidate(followUpsProvider);
      if (mounted) {
        context.showSuccess(approve ? 'Approved.' : 'Turned down.');
      }
    } on ApiException catch (e) {
      if (mounted) context.showError(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _call() async {
    final uri = Phone.dialUri(widget.card.phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      context.showError('No dialler on this device.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final access = ref.watch(accessProvider);
    final user = ref.watch(userOrNullProvider);

    final canManage = access.can('manage_follow_ups');
    final canApprove = access.can('approve_follow_up');
    final isMine = card.assigneeId == user?.id;
    final canUpdate = canManage ||
        (isMine && access.can('view_assigned_follow_ups'));

    final nextStatus = _next(card.status);

    return LuxCard(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MemberAvatar(initials: _initials(card.name), size: 42),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      card.name,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${card.sourceDetail} · '
                      '${D.relative(card.dateOfContact)}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              StatusBadge.forStatus(card.status.wire,
                  label: card.status.label, dense: true),
            ],
          ),

          if (card.isAssigned) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(AppIcons.user, size: 13, color: AppColors.clay300),
                const SizedBox(width: 5),
                Text(
                  isMine ? 'You are following up' : card.assigneeName!,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.clay500),
                ),
              ],
            ),
          ],

          if (_expanded) ...[
            const SizedBox(height: 12),
            const LuxDivider(indent: 0),
            const SizedBox(height: 4),
            DetailRow(
              label: 'Phone',
              value: Phone.pretty(card.phone),
              icon: AppIcons.phone,
              onTap: _call,
            ),
            if (card.reason != null)
              DetailRow(
                label: 'Reason',
                value: card.reason!.label,
                icon: AppIcons.info,
              ),
            DetailRow(
              label: 'Added by',
              value: card.createdByName,
              icon: AppIcons.user,
            ),
            if (card.notes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                card.notes,
                style: const TextStyle(
                    fontSize: 13, height: 1.5, color: AppColors.clay500),
              ),
            ],
            if ((card.rejectionReason ?? '').isNotEmpty) ...[
              const SizedBox(height: 10),
              NoticeCard(
                tone: IconTone.rose,
                icon: AppIcons.alert,
                message: card.rejectionReason!,
              ),
            ],
          ],

          const SizedBox(height: 14),
          if (card.awaitingApproval && canApprove)
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _approve(false),
                    icon: const Icon(AppIcons.xCircle, size: 15),
                    label: const Text('Turn down'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.destructive,
                      side: BorderSide(
                          color:
                              AppColors.destructive.withValues(alpha: 0.3)),
                      minimumSize: const Size(0, 42),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PrimaryButton(
                    label: 'Approve',
                    icon: AppIcons.check,
                    loading: _busy,
                    onPressed: () => _approve(true),
                  ),
                ),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _call,
                    icon: const Icon(AppIcons.phone, size: 15),
                    label: const Text('Call'),
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 42)),
                  ),
                ),
                if (canManage && !card.isAssigned) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: 'Assign',
                      icon: AppIcons.userPlus,
                      loading: _busy,
                      onPressed: _assign,
                    ),
                  ),
                ] else if (canUpdate && nextStatus != null) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: nextStatus.label,
                      icon: AppIcons.forward,
                      loading: _busy,
                      onPressed: () => _advance(nextStatus),
                    ),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }

  /// The next step in the pipeline, or null at the end of it.
  static FollowUpStatus? _next(FollowUpStatus status) {
    final index = FollowUpStatus.pipeline.indexOf(status);
    if (index < 0 || index >= FollowUpStatus.pipeline.length - 1) return null;
    return FollowUpStatus.pipeline[index + 1];
  }

  static String _initials(String name) {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

/// The discipleship pipeline: every contact, grouped by where they have got to.
class DiscipleshipScreen extends ConsumerStatefulWidget {
  const DiscipleshipScreen({super.key});

  @override
  ConsumerState<DiscipleshipScreen> createState() =>
      _DiscipleshipScreenState();
}

class _DiscipleshipScreenState extends ConsumerState<DiscipleshipScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    if (!access.canView('discipleship')) {
      return const AppScaffold(
        title: 'Discipleship',
        body: NoAccessView(
          message: 'Discipleship is not available to your role.',
        ),
      );
    }

    final async = ref.watch(followUpsProvider);
    final user = ref.watch(userOrNullProvider);

    return AppScaffold(
      title: 'Discipleship',
      onRefresh: () async => ref.invalidate(followUpsProvider),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(followUpsProvider),
        ),
        data: (cards) {
          final mine =
              cards.where((c) => c.assigneeId == user?.id).toList();
          final awaiting =
              cards.where((c) => c.awaitingApproval).toList();
          final unassigned = cards
              .where((c) => !c.isAssigned && !c.awaitingApproval)
              .toList();

          final shown = switch (_tab) {
            0 => mine,
            1 => unassigned,
            2 => awaiting,
            _ => cards,
          };

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              StatStripLux(items: [
                StripItem(
                  icon: AppIcons.users,
                  tone: IconTone.gold,
                  label: 'In the pipeline',
                  value: '${cards.length}',
                ),
                StripItem(
                  icon: AppIcons.heart,
                  tone: IconTone.emerald,
                  label: 'Became members',
                  value: '${cards.where((c) => c.status == FollowUpStatus.member).length}',
                ),
              ]),
              const SizedBox(height: 18),
              SegmentedTabs(
                tabs: const ['Yours', 'Unassigned', 'To approve', 'Everyone'],
                selected: _tab,
                counts: {
                  0: mine.length,
                  1: unassigned.length,
                  2: awaiting.length,
                },
                onSelect: (i) => setState(() => _tab = i),
              ),
              const SizedBox(height: 18),
              if (shown.isEmpty)
                EmptyStateLux(
                  icon: AppIcons.heart,
                  tone: IconTone.blush,
                  title: switch (_tab) {
                    0 => 'Nobody assigned to you',
                    1 => 'Everyone has someone',
                    2 => 'Nothing to approve',
                    _ => 'Nobody in the pipeline yet',
                  },
                  description: switch (_tab) {
                    0 => 'Contacts assigned to you for follow-up appear here.',
                    1 => 'Every contact has someone following them up.',
                    2 => 'Cards submitted by youth leaders wait here for a '
                        'lead to approve.',
                    _ => 'Contacts come in from Campus Ministry and Life '
                        'Groups.',
                  },
                )
              else
                for (final card in shown)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: FollowUpCardTile(card: card),
                  ),
            ],
          );
        },
      ),
    );
  }
}

class _AssigneePicker extends StatefulWidget {
  const _AssigneePicker({required this.members});

  final List<AppUser> members;

  @override
  State<_AssigneePicker> createState() => _AssigneePickerState();
}

class _AssigneePickerState extends State<_AssigneePicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final shown = q.isEmpty
        ? widget.members
        : widget.members
            .where((m) => m.name.toLowerCase().contains(q))
            .toList();

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Who will follow up?',
            style: AppFonts.display(
                const TextStyle(fontSize: 20, color: AppColors.clay700)),
          ),
          const SizedBox(height: 14),
          TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search members',
              prefixIcon:
                  Icon(AppIcons.search, size: 18, color: AppColors.clay300),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: shown.length,
              separatorBuilder: (_, __) => const LuxDivider(indent: 0),
              itemBuilder: (context, i) => LuxTile(
                title: shown[i].name,
                subtitle: shown[i].role.label,
                leading: MemberAvatar(
                  initials: shown[i].initials,
                  imageUrl: shown[i].profileImage,
                  size: 36,
                ),
                dense: true,
                onTap: () => Navigator.of(context).pop(shown[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DevotionalSheet extends ConsumerStatefulWidget {
  const _DevotionalSheet({required this.scope});

  final DevotionalScope scope;

  @override
  ConsumerState<_DevotionalSheet> createState() => _DevotionalSheetState();
}

class _DevotionalSheetState extends ConsumerState<_DevotionalSheet> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  final _scripture = TextEditingController();
  late DateTime _weekStart = D.startOfWeek(DateTime.now());
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    _scripture.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty || _content.text.trim().isEmpty) {
      context.showError('A title and the devotional itself are both needed.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).postDevotional(
            scope: widget.scope,
            title: _title.text.trim(),
            content: _content.text.trim(),
            weekStart: _weekStart,
            scriptureReference: _scripture.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Posted.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'This week\'s devotional',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            Text(
              'Everyone in ${widget.scope.label} works through the same focus.',
              style:
                  const TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),
            AppTextField(
              label: 'Title',
              controller: _title,
              required: true,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Scripture',
              controller: _scripture,
              hint: 'e.g. Psalm 133',
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'The devotional',
              controller: _content,
              required: true,
              maxLines: 10,
              minLines: 6,
            ),
            const SizedBox(height: 14),
            const FieldLabel('Week starting'),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _weekStart,
                  firstDate:
                      DateTime.now().subtract(const Duration(days: 60)),
                  lastDate: DateTime.now().add(const Duration(days: 120)),
                );
                if (picked != null) {
                  setState(() => _weekStart = D.startOfWeek(picked));
                }
              },
              borderRadius: BorderRadius.circular(AppRadius.base),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.base),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(AppIcons.calendar,
                        size: 16, color: AppColors.clay300),
                    const SizedBox(width: 11),
                    Text(
                      D.medium(_weekStart),
                      style: const TextStyle(
                          fontSize: 14.5, color: AppColors.clay700),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Post it',
              icon: AppIcons.send,
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _FollowUpSheet extends ConsumerStatefulWidget {
  const _FollowUpSheet({required this.source});

  final FollowUpSource source;

  @override
  ConsumerState<_FollowUpSheet> createState() => _FollowUpSheetState();
}

class _FollowUpSheetState extends ConsumerState<_FollowUpSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _sourceDetail = TextEditingController();
  final _notes = TextEditingController();
  FollowUpReason _reason = FollowUpReason.newVisitor;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _sourceDetail.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty) {
      context.showError('A name and a phone number are both needed.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(ministryRepositoryProvider).createFollowUp(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            source: widget.source,
            sourceDetail: _sourceDetail.text.trim(),
            reason: _reason,
            notes: _notes.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess('Added to the pipeline.');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'New contact',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            Text(
              'Someone from ${widget.source.label} for the discipleship team '
              'to follow up.',
              style:
                  const TextStyle(fontSize: 13, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),
            AppTextField(
              label: 'Name',
              controller: _name,
              required: true,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Phone',
              controller: _phone,
              required: true,
              keyboardType: TextInputType.phone,
              textCapitalization: TextCapitalization.none,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: widget.source == FollowUpSource.campusMinistry
                  ? 'Which campus'
                  : 'Which life group',
              controller: _sourceDetail,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 14),
            AppDropdown<FollowUpReason>(
              label: 'Why follow up',
              value: _reason,
              items: [
                for (final r in FollowUpReason.values)
                  DropdownMenuItem(value: r, child: Text(r.label)),
              ],
              onChanged: (v) =>
                  setState(() => _reason = v ?? FollowUpReason.newVisitor),
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'Notes',
              controller: _notes,
              maxLines: 4,
              hint: 'Anything the person following up should know',
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Add contact',
              icon: AppIcons.userPlus,
              loading: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
