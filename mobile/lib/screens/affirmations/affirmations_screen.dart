import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Encouragement notes for the team — same `affirmations` collection the
/// web /affirmations page streams.
class AffirmationsScreen extends StatelessWidget {
  const AffirmationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Affirmations')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance
            .collection('affirmations')
            .orderBy('createdAt', descending: true)
            .limit(50)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = (snapshot.data?.docs ?? const [])
              .map((d) => Affirmation.fromMap(d.id, d.data()))
              .toList();
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.auto_awesome,
              title: 'No affirmations yet',
              subtitle:
                  'Words of encouragement for the team will appear here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final affirmation = items[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFCE7F3),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.auto_awesome,
                                size: 16, color: Color(0xFFDB2777)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(affirmation.title,
                                style: textTheme.titleMedium),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        affirmation.content,
                        style:
                            textTheme.bodyMedium?.copyWith(height: 1.55),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '${affirmation.authorName} · '
                        '${DateFormat('MMM d, yyyy').format(affirmation.createdAt)}',
                        style: textTheme.labelSmall
                            ?.copyWith(color: PWColors.clay400),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
