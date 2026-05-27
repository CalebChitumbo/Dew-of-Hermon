import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../services/firestore_service.dart';

class CalendarScreen extends ConsumerWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stream = ref
        .watch(firestoreServiceProvider)
        .watchUpcomingEvents(limit: 100);

    return StreamBuilder(
      stream: stream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final events = snap.data ?? const [];
        if (events.isEmpty) {
          return const Center(child: Text('No upcoming events.'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: events.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final e = events[i];
            return Card(
              child: ListTile(
                leading: CircleAvatar(
                  child: Text(DateFormat.d().format(e.startDate)),
                ),
                title: Text(e.title),
                subtitle: Text(
                  '${DateFormat.MMMd().add_jm().format(e.startDate)} • ${e.venue}',
                ),
                trailing: Text(
                  e.type.name.replaceAll('_', ' '),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
