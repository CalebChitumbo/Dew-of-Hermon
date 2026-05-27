import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../services/firestore_service.dart';

class AffirmationsScreen extends ConsumerWidget {
  const AffirmationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stream = ref.watch(firestoreServiceProvider).watchAffirmations();
    return StreamBuilder(
      stream: stream,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final affirmations = snap.data ?? const [];
        if (affirmations.isEmpty) {
          return const Center(child: Text('No affirmations yet.'));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: affirmations.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            final a = affirmations[i];
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${a.authorName} • ${DateFormat.MMMd().format(a.createdAt)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    Text(a.content),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
