import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/enums.dart';
import '../../providers/auth_provider.dart';
import '../../services/firestore_service.dart';

class MyScheduleScreen extends ConsumerWidget {
  const MyScheduleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authUser = ref.watch(authStateProvider).value;
    if (authUser == null) {
      return const Center(child: Text('Sign in to view your schedule.'));
    }

    final stream = ref
        .watch(firestoreServiceProvider)
        .watchAssignmentsForUser(authUser.uid);

    return StreamBuilder(
      stream: stream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final assignments = snap.data ?? const [];
        if (assignments.isEmpty) {
          return const Center(child: Text('No assignments yet.'));
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: assignments.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final a = assignments[i];
            return Card(
              child: ListTile(
                title: Text(a.roleName),
                subtitle: Text(
                  'Service ${a.serviceId} • ${a.status.name}',
                ),
                trailing: a.status == AssignmentStatus.PENDING
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.check_circle_outline,
                                color: Colors.green),
                            tooltip: 'Confirm',
                            onPressed: () => ref
                                .read(firestoreServiceProvider)
                                .updateAssignmentStatus(a.id, 'CONFIRMED'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.cancel_outlined,
                                color: Colors.red),
                            tooltip: 'Decline',
                            onPressed: () => ref
                                .read(firestoreServiceProvider)
                                .updateAssignmentStatus(a.id, 'DECLINED'),
                          ),
                        ],
                      )
                    : Icon(
                        a.status == AssignmentStatus.CONFIRMED
                            ? Icons.check_circle
                            : Icons.cancel,
                        color: a.status == AssignmentStatus.CONFIRMED
                            ? Colors.green
                            : Colors.red,
                      ),
              ),
            );
          },
        );
      },
    );
  }
}
