import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';

import '../../../models/models.dart';
import '../../../services/access_service.dart';
import '../../../services/auth_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../queues/queue_widgets.dart';

/// Discipleship follow-up pipeline: submit cards, approve youth-leader
/// submissions, assign and progress contacts — same endpoints as the web.
class FollowUpsScreen extends StatefulWidget {
  const FollowUpsScreen({super.key});

  @override
  State<FollowUpsScreen> createState() => _FollowUpsScreenState();
}

class _FollowUpsScreenState extends State<FollowUpsScreen> {
  List<FollowUpCard> _cards = [];
  bool _loading = true;
  String _filter = 'ACTIVE';
  String? _actingOn;

  static const _pipeline = [
    'NEW_CONTACT',
    'ASSIGNED',
    'CONTACTED',
    'FIRST_VISIT',
    'REGULAR_ATTENDEE',
    'MEMBER',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/follow-up-cards');
      final list = (res['cards'] as List? ?? []).whereType<Map>().map((m) {
        final map = m.cast<String, dynamic>();
        return FollowUpCard.fromMap(map['id']?.toString() ?? '', map);
      }).toList()
        ..sort((a, b) => b.dateOfContact.compareTo(a.dateOfContact));
      if (mounted) {
        setState(() {
          _cards = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _matches(FollowUpCard card) => switch (_filter) {
        'ACTIVE' => _pipeline.contains(card.status) &&
            card.status != 'MEMBER',
        'PENDING_APPROVAL' => card.status == 'PENDING_LEAD_APPROVAL',
        'DONE' => card.status == 'MEMBER' || card.status == 'REJECTED',
        _ => true,
      };

  Future<void> _submitCard() async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => const _NewCardSheet(),
    );
    if (result == null || !mounted) return;
    final api = context.read<ApiClient>();
    try {
      await api.postJson('/api/follow-up-cards', result);
      if (mounted) showAppSnackBar(context, 'Follow-up card submitted.');
      _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    }
  }

  Future<void> _approve(FollowUpCard card, String action) async {
    String? reason;
    if (action == 'REJECT') {
      reason = await promptText(context,
          title: 'Reject ${card.name}\'s card?',
          label: 'Reason (required)',
          requireText: true);
      if (reason == null || !mounted) return;
    }
    setState(() => _actingOn = card.id);
    final api = context.read<ApiClient>();
    try {
      await api.postJson('/api/follow-up-cards/${card.id}/approve', {
        'action': action,
        'reason': ?reason,
      });
      if (mounted) {
        showAppSnackBar(context,
            action == 'APPROVE' ? 'Card approved.' : 'Card rejected.');
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<void> _progress(FollowUpCard card) async {
    final access = context.read<AccessService>();
    final profile = context.read<AuthService>().profile;
    final canManage = access.checkFeature(profile, 'manage_follow_ups');
    final isMine = card.assigneeId == profile?.id;
    if (!canManage && !isMine) return;

    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (sheetContext) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (canManage)
            ListTile(
              leading: const Icon(Icons.person_add_alt),
              title: Text(card.assigneeId == null
                  ? 'Assign to someone'
                  : 'Reassign (now: ${card.assigneeName})'),
              onTap: () => Navigator.of(sheetContext).pop('ASSIGN'),
            ),
          for (final status in _pipeline.where((s) => s != card.status))
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: Text('Mark as ${followUpStatusLabels[status]}'),
              onTap: () => Navigator.of(sheetContext).pop(status),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
    if (action == null || !mounted) return;

    final api = context.read<ApiClient>();
    if (action == 'ASSIGN') {
      final snap = await FirebaseFirestore.instance
          .collection('users')
          .where('isActive', isEqualTo: true)
          .get();
      final usersSnap = snap.docs
          .map((d) => UserProfile.fromMap(d.id, d.data()))
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name));
      if (!mounted) return;
      final picked = await showModalBottomSheet<UserProfile>(
        context: context,
        showDragHandle: true,
        backgroundColor: PWColors.cream,
        builder: (sheetContext) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          children: [
            for (final member in usersSnap)
              ListTile(
                onTap: () => Navigator.of(sheetContext).pop(member),
                leading: InitialsAvatar(name: member.name, radius: 16),
                title: Text(member.name),
              ),
          ],
        ),
      );
      if (picked == null || !mounted) return;
      setState(() => _actingOn = card.id);
      try {
        await api.dio.patch('/api/follow-up-cards/${card.id}', data: {
          'status': 'ASSIGNED',
          'assigneeId': picked.id,
          'assigneeName': picked.name,
        });
        await _load();
      } on ApiException catch (e) {
        if (mounted) showAppSnackBar(context, e.message, isError: true);
      } finally {
        if (mounted) setState(() => _actingOn = null);
      }
      return;
    }

    setState(() => _actingOn = card.id);
    try {
      await api.dio.patch('/api/follow-up-cards/${card.id}',
          data: {'status': action});
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = context.watch<AccessService>();
    final profile = context.watch<AuthService>().profile;
    final canSubmit = access.checkFeature(profile, 'submit_follow_up');
    final canApprove = access.checkFeature(profile, 'approve_follow_up');
    final textTheme = Theme.of(context).textTheme;
    final cards = _cards.where(_matches).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Follow-Ups')),
      floatingActionButton: canSubmit
          ? FloatingActionButton.extended(
              backgroundColor: PWColors.gold,
              foregroundColor: PWColors.clay900,
              onPressed: _submitCard,
              icon: const Icon(Icons.add),
              label: const Text('New card'),
            )
          : null,
      body: Column(
        children: [
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
              children: [
                for (final (value, label) in const [
                  ('ACTIVE', 'Active'),
                  ('PENDING_APPROVAL', 'Awaiting approval'),
                  ('DONE', 'Completed'),
                  ('ALL', 'All'),
                ]) ...[
                  ChoiceChip(
                    label: Text(label),
                    selected: _filter == value,
                    selectedColor: PWColors.gold.withValues(alpha: 0.25),
                    onSelected: (_) => setState(() => _filter = value),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: cards.isEmpty
                        ? ListView(
                            physics:
                                const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 80),
                              EmptyState(
                                icon: Icons.favorite_outline,
                                title: 'No follow-up cards here',
                                subtitle: 'New contacts from campus '
                                    'ministry and life groups appear here.',
                              ),
                            ],
                          )
                        : ListView.separated(
                            physics:
                                const AlwaysScrollableScrollPhysics(),
                            padding:
                                const EdgeInsets.fromLTRB(20, 4, 20, 90),
                            itemCount: cards.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final card = cards[i];
                              return Card(
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () => _progress(card),
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            InitialsAvatar(
                                                name: card.name,
                                                radius: 17),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment
                                                        .start,
                                                children: [
                                                  Text(card.name,
                                                      style: textTheme
                                                          .bodyMedium
                                                          ?.copyWith(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600)),
                                                  Text(
                                                    '${card.phone} · '
                                                    '${card.source == 'CAMPUS_MINISTRY' ? 'Campus' : 'Life groups'} · '
                                                    '${DateFormat('MMM d').format(card.dateOfContact)}',
                                                    style: textTheme
                                                        .bodySmall
                                                        ?.copyWith(
                                                            color: PWColors
                                                                .clay400),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets
                                                  .symmetric(
                                                  horizontal: 9,
                                                  vertical: 3),
                                              decoration: BoxDecoration(
                                                color: PWColors.teal
                                                    .withValues(
                                                        alpha: 0.12),
                                                borderRadius:
                                                    BorderRadius.circular(
                                                        999),
                                              ),
                                              child: Text(
                                                card.statusLabel,
                                                style: textTheme.labelSmall
                                                    ?.copyWith(
                                                  color:
                                                      PWColors.tealDark,
                                                  fontWeight:
                                                      FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (card.assigneeName != null)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(
                                                    top: 6),
                                            child: Text(
                                              'Assigned to '
                                              '${card.assigneeName}',
                                              style: textTheme.labelSmall
                                                  ?.copyWith(
                                                      color: PWColors
                                                          .goldDark),
                                            ),
                                          ),
                                        if (card.notes.isNotEmpty)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(
                                                    top: 4),
                                            child: Text(
                                              card.notes,
                                              maxLines: 2,
                                              overflow:
                                                  TextOverflow.ellipsis,
                                              style: textTheme.bodySmall
                                                  ?.copyWith(
                                                      color: PWColors
                                                          .clay500),
                                            ),
                                          ),
                                        if (card.status ==
                                                'PENDING_LEAD_APPROVAL' &&
                                            canApprove) ...[
                                          const SizedBox(height: 10),
                                          ConfirmDeclineRow(
                                            busy: _actingOn == card.id,
                                            confirmLabel: 'Approve',
                                            onConfirm: () =>
                                                _approve(card, 'APPROVE'),
                                            onDecline: () =>
                                                _approve(card, 'REJECT'),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _NewCardSheet extends StatefulWidget {
  const _NewCardSheet();

  @override
  State<_NewCardSheet> createState() => _NewCardSheetState();
}

class _NewCardSheetState extends State<_NewCardSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _sourceDetail = TextEditingController();
  final _notes = TextEditingController();
  String _source = 'CAMPUS_MINISTRY';
  String? _reason;
  DateTime _dateOfContact = DateTime.now();

  @override
  void dispose() {
    for (final c in [_name, _phone, _sourceDetail, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('New follow-up card',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration:
                  const InputDecoration(labelText: 'Contact name *'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone *'),
            ),
            const SizedBox(height: 10),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'CAMPUS_MINISTRY', label: Text('Campus')),
                ButtonSegment(
                    value: 'LIFE_GROUPS', label: Text('Life group')),
              ],
              selected: {_source},
              onSelectionChanged: (s) =>
                  setState(() => _source = s.first),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _sourceDetail,
              decoration: InputDecoration(
                labelText: _source == 'CAMPUS_MINISTRY'
                    ? 'Which campus/institution? *'
                    : 'Which life group? *',
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _reason,
              decoration:
                  const InputDecoration(labelText: 'Reason (optional)'),
              items: const [
                DropdownMenuItem<String>(
                    value: null, child: Text('Not specified')),
                DropdownMenuItem(
                    value: 'NEW_VISITOR', child: Text('New visitor')),
                DropdownMenuItem(
                    value: 'RETURNING_AFTER_ABSENCE',
                    child: Text('Returning after absence')),
                DropdownMenuItem(
                    value: 'NEEDS_PASTORAL_SUPPORT',
                    child: Text('Needs pastoral support')),
                DropdownMenuItem(value: 'OTHER', child: Text('Other')),
              ],
              onChanged: (v) => setState(() => _reason = v),
            ),
            const SizedBox(height: 10),
            InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _dateOfContact,
                  firstDate:
                      DateTime.now().subtract(const Duration(days: 90)),
                  lastDate: DateTime.now(),
                );
                if (picked != null) {
                  setState(() => _dateOfContact = picked);
                }
              },
              child: InputDecorator(
                decoration:
                    const InputDecoration(labelText: 'Date of contact'),
                child: Text(
                    DateFormat('EEE, MMM d, yyyy').format(_dateOfContact)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 3,
              decoration: const InputDecoration(
                  labelText: 'Notes — how did you meet them?'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_name.text.trim().isEmpty ||
                    _phone.text.trim().isEmpty ||
                    _sourceDetail.text.trim().isEmpty) {
                  showAppSnackBar(
                      context, 'Name, phone and source are required.',
                      isError: true);
                  return;
                }
                Navigator.of(context).pop({
                  'name': _name.text.trim(),
                  'phone': _phone.text.trim(),
                  'source': _source,
                  'sourceDetail': _sourceDetail.text.trim(),
                  'reason': ?_reason,
                  'notes': _notes.text.trim(),
                  'dateOfContact': _dateOfContact.toIso8601String(),
                });
              },
              child: const Text('Submit card'),
            ),
          ],
        ),
      ),
    );
  }
}
