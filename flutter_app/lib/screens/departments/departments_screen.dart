import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/firestore_service.dart';

class DepartmentsScreen extends ConsumerWidget {
  const DepartmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stream = ref.watch(firestoreServiceProvider).watchDepartments();
    return StreamBuilder(
      stream: stream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final departments = snap.data ?? const [];
        if (departments.isEmpty) {
          return const Center(child: Text('No departments configured.'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: departments.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final d = departments[i];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.groups),
                title: Text(d.name),
                subtitle: d.description != null ? Text(d.description!) : null,
              ),
            );
          },
        );
      },
    );
  }
}
