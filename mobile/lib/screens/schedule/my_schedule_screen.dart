import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';

class MyScheduleScreen extends StatefulWidget {
  const MyScheduleScreen({super.key});

  @override
  State<MyScheduleScreen> createState() => _MyScheduleScreenState();
}

class _MyScheduleScreenState extends State<MyScheduleScreen> {
  List<MyAssignment> _assignments = [];
  bool _loading = true;
  String? _error;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final data = await api.getJson('/api/my-assignments');
      final list = (data['assignments'] as List? ?? [])
          .whereType<Map>()
          .map((m) => MyAssignment.fromJson(m.cast<String, dynamic>()))
          .toList();
      if (mounted) {
        setState(() {
          _assignments = list;
          _loading = false;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load your assignments.';
        });
      }
    }
  }

  Future<void> _respond(MyAssignment assignment, String status) async {
    final auth = context.read<AuthService>();
    final api = context.read<ApiClient>();
    setState(() => _actingOn = assignment.id);
    try {
      // Same endpoint + body the web my-schedule page sends.
      await api.putJson(assignment.updateApiPath, {
        'status': status,
        'callerRole': auth.profile?.role,
        'callerId': auth.firebaseUser?.uid,
      });
      if (mounted && status == 'CONFIRMED') {
        await showCelebration(context);
      }
      if (mounted) {
        showAppSnackBar(
          context,
          status == 'CONFIRMED'
              ? "You're in — thank you for serving! 🎉"
              : 'Assignment declined.',
        );
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().profile?.id;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final upcoming = _assignments
        .where((a) =>
            a.serviceDate == null || !a.serviceDate!.isBefore(today))
        .toList()
      ..sort((a, b) {
        final ad = a.serviceDate, bd = b.serviceDate;
        if (ad == null && bd == null) return 0;
        if (ad == null) return -1;
        if (bd == null) return 1;
        return ad.compareTo(bd);
      });
    final past = _assignments
        .where(
            (a) => a.serviceDate != null && a.serviceDate!.isBefore(today))
        .toList()
      ..sort((a, b) => b.serviceDate!.compareTo(a.serviceDate!));

    return Scaffold(
      appBar: AppBar(title: const Text('My Schedule')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                children: [
                  if (_error != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: PWColors.destructive),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_error!)),
                            TextButton(
                                onPressed: _load,
                                child: const Text('Retry')),
                          ],
                        ),
                      ),
                    ),
                  const SectionHeader('Upcoming'),
                  if (upcoming.isEmpty && _error == null)
                    const Card(
                      child: EmptyState(
                        icon: Icons.volunteer_activism_outlined,
                        title: 'No upcoming assignments',
                        subtitle:
                            'When a lead assigns you a role, it appears '
                            'here to confirm or decline.',
                      ),
                    )
                  else
                    for (final a in upcoming) ...[
                      _AssignmentCard(
                        assignment: a,
                        busy: _actingOn == a.id,
                        onConfirm: () => _respond(a, 'CONFIRMED'),
                        onDecline: () => _respond(a, 'DECLINED'),
                      ),
                      const SizedBox(height: 10),
                    ],
                  const SizedBox(height: 16),
                  if (uid != null) _AvailabilitySection(uid: uid),
                  if (past.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const SectionHeader('Recent history'),
                    Card(
                      child: Column(
                        children: [
                          for (final (i, a) in past.take(5).indexed) ...[
                            if (i > 0) const Divider(height: 1),
                            ListTile(
                              title: Text(
                                a.roleName,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                        fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                [
                                  if (a.eventTitle != null) a.eventTitle!,
                                  DateFormat('MMM d, yyyy')
                                      .format(a.serviceDate!),
                                ].join(' · '),
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: PWColors.clay400),
                              ),
                              trailing: StatusBadge(status: a.status),
                            ),
                          ],
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

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({
    required this.assignment,
    required this.busy,
    required this.onConfirm,
    required this.onDecline,
  });

  final MyAssignment assignment;
  final bool busy;
  final VoidCallback onConfirm;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final a = assignment;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [
                      if (a.serviceDate != null)
                        DateFormat('EEE, MMM d').format(a.serviceDate!),
                      if (a.serviceTime != null) a.serviceTime!,
                    ].join(' · '),
                    style: textTheme.labelSmall?.copyWith(
                      color: PWColors.clay400,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                StatusBadge(status: a.status),
              ],
            ),
            const SizedBox(height: 6),
            Text(a.roleName, style: textTheme.titleMedium),
            if (a.eventTitle != null || a.venue != null) ...[
              const SizedBox(height: 2),
              Text(
                [a.eventTitle, a.venue].whereType<String>().join(' · '),
                style:
                    textTheme.bodySmall?.copyWith(color: PWColors.clay500),
              ),
            ],
            if (a.theme != null) ...[
              const SizedBox(height: 2),
              Text(
                a.kind == 'braai' ? 'Phase: ${a.theme}' : 'Theme: ${a.theme}',
                style:
                    textTheme.bodySmall?.copyWith(color: PWColors.clay400),
              ),
            ],
            if (a.isPending) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : onDecline,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: PWColors.destructive,
                        side: const BorderSide(color: Color(0xFFFECACA)),
                      ),
                      child: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : onConfirm,
                      style: FilledButton.styleFrom(
                          backgroundColor: PWColors.teal),
                      child: busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Confirm'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Availability ────────────────────────────────────────────────────────

class _AvailabilitySection extends StatelessWidget {
  const _AvailabilitySection({required this.uid});

  final String uid;

  CollectionReference<Map<String, dynamic>> get _collection =>
      FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('availability');

  Future<void> _addUnavailableDate(BuildContext context) async {
    final messenger = context;
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !messenger.mounted) return;

    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: messenger,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text(
          'Unavailable on ${DateFormat('MMM d, yyyy').format(date)}',
          style: Theme.of(dialogContext).textTheme.titleLarge,
        ),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(
            labelText: 'Reason (optional)',
            hintText: 'e.g. travelling, exams…',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    // Same doc shape + path the web availability page writes.
    final dateKey = DateFormat('yyyy-MM-dd').format(date);
    await _collection.doc(dateKey).set({
      'available': false,
      'reason': reasonController.text.trim().isEmpty
          ? null
          : reasonController.text.trim(),
      'date': dateKey,
    });
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          'My availability',
          trailing: TextButton.icon(
            onPressed: () => _addUnavailableDate(context),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add date'),
          ),
        ),
        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
          stream: _collection.snapshots(),
          builder: (context, snapshot) {
            final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
            final items = (snapshot.data?.docs ?? const [])
                .map((d) => UserAvailability.fromMap(d.id, d.data()))
                .where((a) => !a.available && a.date.compareTo(today) >= 0)
                .toList()
              ..sort((a, b) => a.date.compareTo(b.date));
            if (items.isEmpty) {
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.event_available,
                          color: PWColors.teal),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'No unavailable dates — leads can schedule you '
                          'anytime.',
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay500),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }
            return Card(
              child: Column(
                children: [
                  for (final (i, a) in items.indexed) ...[
                    if (i > 0) const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.event_busy,
                          color: PWColors.goldDark),
                      title: Text(
                        DateFormat('EEE, MMM d, yyyy')
                            .format(DateTime.parse(a.date)),
                        style: textTheme.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      subtitle: a.reason == null
                          ? null
                          : Text(
                              a.reason!,
                              style: textTheme.bodySmall
                                  ?.copyWith(color: PWColors.clay400),
                            ),
                      trailing: IconButton(
                        icon: const Icon(Icons.close,
                            size: 18, color: PWColors.clay400),
                        onPressed: () => _collection.doc(a.date).delete(),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
