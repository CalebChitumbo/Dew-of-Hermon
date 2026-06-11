import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/models.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/common.dart';
import '../../events/event_detail_screen.dart';
import 'create_event_screen.dart';

/// All events with status filters — the manage/events list.
class EventsManageScreen extends StatefulWidget {
  const EventsManageScreen({super.key, required this.canCreate});

  final bool canCreate;

  @override
  State<EventsManageScreen> createState() => _EventsManageScreenState();
}

class _EventsManageScreenState extends State<EventsManageScreen> {
  String _filter = 'ALL';

  static const _filters = <(String, String)>[
    ('ALL', 'All'),
    ('PENDING', 'In approval'),
    ('APPROVED', 'Approved'),
    ('CHANGES_REQUESTED', 'Changes asked'),
    ('REJECTED', 'Rejected'),
  ];

  bool _matches(AppEvent e) => switch (_filter) {
        'ALL' => true,
        'PENDING' => const [
            'PENDING_DISPATCH',
            'PENDING_STAKEHOLDERS',
            'PENDING_VICE_CHAIR',
            'PENDING_CHAIR'
          ].contains(e.approvalStatus),
        _ => e.approvalStatus == _filter,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Events')),
      floatingActionButton: widget.canCreate
          ? FloatingActionButton.extended(
              backgroundColor: PWColors.gold,
              foregroundColor: PWColors.clay900,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CreateEventScreen()),
              ),
              icon: const Icon(Icons.add),
              label: const Text('New event'),
            )
          : null,
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              children: [
                for (final (value, label) in _filters) ...[
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
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('events')
                  .orderBy('startDate', descending: true)
                  .limit(100)
                  .snapshots(),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final events = (snap.data?.docs ?? const [])
                    .map((d) => AppEvent.fromMap(d.id, d.data()))
                    .where(_matches)
                    .toList();
                if (events.isEmpty) {
                  return const EmptyState(
                    icon: Icons.event_outlined,
                    title: 'No events match',
                    subtitle: 'Try a different filter.',
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 90),
                  itemCount: events.length,
                  itemBuilder: (context, i) {
                    final e = events[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => EventDetailScreen(event: e)),
                        ),
                        title: Text(
                          e.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              EventTypeChip(
                                  type: e.type, label: e.typeLabel),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  DateFormat('MMM d, yyyy')
                                      .format(e.startDate),
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: PWColors.clay400),
                                ),
                              ),
                            ],
                          ),
                        ),
                        trailing: Text(
                          e.approvalLabel,
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(
                                color: switch (e.approvalStatus) {
                                  'APPROVED' => PWColors.tealDark,
                                  'REJECTED' => PWColors.destructive,
                                  'CHANGES_REQUESTED' => PWColors.goldDark,
                                  _ => const Color(0xFF2563EB),
                                },
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
