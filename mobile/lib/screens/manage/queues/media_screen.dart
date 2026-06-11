import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api_client.dart';
import '../../../models/models.dart';
import '../../../models/requests.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import 'queue_widgets.dart';

/// Media coordinator queue: confirm event media and assign the Sound,
/// Publicity, and Coverage roles (PATCH /api/media-requests/{id}/confirm).
class MediaQueueScreen extends StatefulWidget {
  const MediaQueueScreen({super.key});

  @override
  State<MediaQueueScreen> createState() => _MediaQueueScreenState();
}

class _MediaQueueScreenState extends State<MediaQueueScreen> {
  List<MediaRequest> _requests = [];
  bool _loading = true;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    try {
      final res = await api.getJson('/api/media-requests');
      final list = (res['requests'] as List? ?? []).whereType<Map>().map((m) {
        final map = m.cast<String, dynamic>();
        return MediaRequest.fromJson(map['id']?.toString() ?? '', map);
      }).toList();
      if (mounted) {
        setState(() {
          _requests = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirm(MediaRequest req) async {
    // Pick the three media roles from active members.
    final usersSnap = await FirebaseFirestore.instance
        .collection('users')
        .where('isActive', isEqualTo: true)
        .get();
    final members = usersSnap.docs
        .map((d) => UserProfile.fromMap(d.id, d.data()))
        .toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    if (!mounted) return;

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PWColors.cream,
      builder: (_) => _MediaRolesSheet(members: members),
    );
    if (result == null || !mounted) return;

    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/media-requests/${req.id}/confirm', data: {
        'action': 'CONFIRM',
        ...result,
      });
      if (mounted) {
        showAppSnackBar(context, 'Media confirmed and roles assigned.');
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<void> _decline(MediaRequest req) async {
    final comments = await promptText(context,
        title: 'Decline media for "${req.eventTitle}"?',
        label: 'Reason (required)',
        requireText: true);
    if (comments == null || !mounted) return;
    setState(() => _actingOn = req.id);
    final api = context.read<ApiClient>();
    try {
      await api.dio.patch('/api/media-requests/${req.id}/confirm', data: {
        'action': 'DECLINE',
        'comments': comments,
      });
      if (mounted) showAppSnackBar(context, 'Media request declined.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Media Requests')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _requests.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      EmptyState(
                        icon: Icons.videocam_outlined,
                        title: 'No media requests',
                        subtitle: 'Events that flagged media needs appear '
                            'here once dispatched.',
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: _requests.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final req = _requests[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              QueueCardHeader(
                                eventTitle: req.eventTitle,
                                eventDate: req.eventStartDate,
                                status: req.status,
                              ),
                              NeedsBlock(
                                  label: 'Needs',
                                  text: req.needsDescription),
                              if (req.status == 'CONFIRMED') ...[
                                const SizedBox(height: 8),
                                Text(
                                  'Sound: ${req.soundUserName ?? '—'}\n'
                                  'Publicity: ${req.publicityUserName ?? '—'}\n'
                                  'Coverage: ${req.coverageUserName ?? '—'}',
                                  style: textTheme.bodySmall?.copyWith(
                                      color: PWColors.clay600, height: 1.5),
                                ),
                              ],
                              if (req.status == 'PENDING_MEDIA') ...[
                                const SizedBox(height: 12),
                                ConfirmDeclineRow(
                                  busy: _actingOn == req.id,
                                  confirmLabel: 'Assign & confirm',
                                  onConfirm: () => _confirm(req),
                                  onDecline: () => _decline(req),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}

class _MediaRolesSheet extends StatefulWidget {
  const _MediaRolesSheet({required this.members});

  final List<UserProfile> members;

  @override
  State<_MediaRolesSheet> createState() => _MediaRolesSheetState();
}

class _MediaRolesSheetState extends State<_MediaRolesSheet> {
  UserProfile? _sound;
  UserProfile? _publicity;
  UserProfile? _coverage;
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Widget _rolePicker(String label, UserProfile? value,
      ValueChanged<UserProfile?> onChanged) {
    return DropdownButtonFormField<UserProfile>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: '$label *'),
      items: widget.members
          .map((m) => DropdownMenuItem(value: m, child: Text(m.name)))
          .toList(),
      onChanged: onChanged,
    );
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
            Text('Assign media roles',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            _rolePicker('Sound', _sound, (v) => setState(() => _sound = v)),
            const SizedBox(height: 10),
            _rolePicker('Publicity', _publicity,
                (v) => setState(() => _publicity = v)),
            const SizedBox(height: 10),
            _rolePicker('Coverage', _coverage,
                (v) => setState(() => _coverage = v)),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'Notes (optional)'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                if (_sound == null ||
                    _publicity == null ||
                    _coverage == null) {
                  showAppSnackBar(context, 'All three roles are required.',
                      isError: true);
                  return;
                }
                Navigator.of(context).pop({
                  'soundUserId': _sound!.id,
                  'soundUserName': _sound!.name,
                  'publicityUserId': _publicity!.id,
                  'publicityUserName': _publicity!.name,
                  'coverageUserId': _coverage!.id,
                  'coverageUserName': _coverage!.name,
                  if (_notes.text.trim().isNotEmpty)
                    'coordinatorNotes': _notes.text.trim(),
                });
              },
              child: const Text('Confirm media'),
            ),
          ],
        ),
      ),
    );
  }
}
