import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../theme/app_theme.dart';

/// Shared status pill for the request queues.
class RequestStatusChip extends StatelessWidget {
  const RequestStatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, fg, bg) = switch (status) {
      'APPROVED' || 'CONFIRMED' => (
          status == 'APPROVED' ? 'Approved' : 'Confirmed',
          PWColors.tealDark,
          const Color(0xFFE2F3F0)
        ),
      'REJECTED' || 'REJECTED_TREASURER' || 'DECLINED' => (
          'Declined',
          const Color(0xFFB91C1C),
          const Color(0xFFFEE2E2)
        ),
      'CANCELLED' => ('Cancelled', PWColors.clay400, PWColors.clay100),
      'PENDING_DETAILS' => (
          'Needs costing',
          const Color(0xFF2563EB),
          const Color(0xFFDBEAFE)
        ),
      _ => ('Pending', PWColors.goldDark, const Color(0xFFFCF0DC)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        label,
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: fg, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class QueueCardHeader extends StatelessWidget {
  const QueueCardHeader({
    super.key,
    required this.eventTitle,
    required this.eventDate,
    required this.status,
  });

  final String eventTitle;
  final DateTime? eventDate;
  final String status;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(eventTitle,
                  style: textTheme.titleMedium, maxLines: 2),
              if (eventDate != null)
                Text(
                  DateFormat('EEE, MMM d, yyyy').format(eventDate!),
                  style: textTheme.bodySmall
                      ?.copyWith(color: PWColors.clay400),
                ),
            ],
          ),
        ),
        RequestStatusChip(status: status),
      ],
    );
  }
}

class NeedsBlock extends StatelessWidget {
  const NeedsBlock({super.key, required this.label, required this.text});

  final String label;
  final String text;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      width: double.infinity,
      decoration: BoxDecoration(
        color: PWColors.cream,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: PWColors.clay100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: textTheme.labelSmall?.copyWith(
                  color: PWColors.clay400, letterSpacing: 1.2)),
          const SizedBox(height: 2),
          Text(text,
              style: textTheme.bodySmall
                  ?.copyWith(color: PWColors.clay700, height: 1.4)),
        ],
      ),
    );
  }
}

/// Confirm/decline button pair used by media + food queues.
class ConfirmDeclineRow extends StatelessWidget {
  const ConfirmDeclineRow({
    super.key,
    required this.busy,
    required this.onConfirm,
    required this.onDecline,
    this.confirmLabel = 'Confirm',
  });

  final bool busy;
  final VoidCallback onConfirm;
  final VoidCallback onDecline;
  final String confirmLabel;

  @override
  Widget build(BuildContext context) {
    if (busy) {
      return const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onDecline,
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
            onPressed: onConfirm,
            style: FilledButton.styleFrom(backgroundColor: PWColors.teal),
            child: Text(confirmLabel),
          ),
        ),
      ],
    );
  }
}

/// Free-text prompt used for decline reasons / comments.
Future<String?> promptText(
  BuildContext context, {
  required String title,
  String label = 'Comments (optional)',
  bool requireText = false,
}) async {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: Colors.white,
      title: Text(title, style: Theme.of(dialogContext).textTheme.titleLarge),
      content: TextField(
        controller: controller,
        maxLines: 3,
        decoration: InputDecoration(labelText: label),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            if (requireText && controller.text.trim().isEmpty) return;
            Navigator.of(dialogContext).pop(controller.text.trim());
          },
          child: const Text('Continue'),
        ),
      ],
    ),
  );
}
