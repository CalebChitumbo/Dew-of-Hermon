import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

final campBroadcastsProvider = FutureProvider<List<CampBroadcast>>((ref) {
  return ref.watch(campRepositoryProvider).listBroadcasts();
});

/// Camp announcements — one message, typed once, delivered as a personalised
/// copy to every camper in the chosen audience.
class CampAnnouncementsScreen extends ConsumerWidget {
  const CampAnnouncementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(accessProvider).can('manage_camp_registrations')) {
      return const AppScaffold(
        title: 'Announcements',
        body: NoAccessView(
          message: 'Camp announcements need the Manage ROPs Camp '
              'Registrations permission.',
        ),
      );
    }

    final async = ref.watch(campBroadcastsProvider);

    return AppScaffold(
      title: 'Announcements',
      subtitle: getCamp(kDefaultCampId)?.name,
      showBottomNav: false,
      onRefresh: () async => ref.invalidate(campBroadcastsProvider),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _compose(context, ref),
        icon: const Icon(AppIcons.megaphone, size: 19),
        label: const Text('New announcement'),
      ),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(campBroadcastsProvider),
        ),
        data: (sent) {
          if (sent.isEmpty) {
            return const EmptyStateLux(
              icon: AppIcons.megaphone,
              tone: IconTone.lavender,
              title: 'Nothing sent yet',
              description: 'Announcements you send to campers are kept here, '
                  'with what happened to each copy.',
            );
          }
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              for (final broadcast in sent)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _BroadcastCard(
                    broadcast: broadcast,
                    onReuse: () => _compose(context, ref, reuse: broadcast),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _compose(
    BuildContext context,
    WidgetRef ref, {
    CampBroadcast? reuse,
  }) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ComposeSheet(reuse: reuse),
    );
    if (sent == true) ref.invalidate(campBroadcastsProvider);
  }
}

class _BroadcastCard extends StatefulWidget {
  const _BroadcastCard({required this.broadcast, required this.onReuse});

  final CampBroadcast broadcast;
  final VoidCallback onReuse;

  @override
  State<_BroadcastCard> createState() => _BroadcastCardState();
}

class _BroadcastCardState extends State<_BroadcastCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final b = widget.broadcast;
    return LuxCard(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(AppIcons.megaphone,
                  tone: b.failedCount > 0 ? IconTone.amber : IconTone.lavender,
                  size: 42),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      b.subject,
                      style: AppFonts.display(const TextStyle(
                        fontSize: 17,
                        height: 1.2,
                        color: AppColors.clay700,
                      )),
                      maxLines: _expanded ? 3 : 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${b.audience.label} · ${D.relative(b.sentAt)} · '
                      '${b.sentByName}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.clay400),
                    ),
                  ],
                ),
              ),
              Icon(_expanded ? AppIcons.chevronUp : AppIcons.chevronDown,
                  size: 16, color: AppColors.clay300),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              StatusBadge('${b.sentCount} sent',
                  tone: IconTone.emerald, dense: true),
              if (b.skippedCount > 0)
                StatusBadge('${b.skippedCount} skipped',
                    tone: IconTone.clay, dense: true),
              if (b.failedCount > 0)
                StatusBadge('${b.failedCount} failed',
                    tone: IconTone.rose, dense: true),
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: 14),
            const LuxDivider(indent: 0),
            const SizedBox(height: 12),
            Text(
              b.body,
              style: const TextStyle(
                  fontSize: 13.5, height: 1.6, color: AppColors.clay600),
            ),
            if (b.outcomes.any(
                (o) => o.status != CampBroadcastOutcomeStatus.sent)) ...[
              const SizedBox(height: 14),
              const Text(
                'Not delivered',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.clay500,
                ),
              ),
              const SizedBox(height: 6),
              for (final outcome in b.outcomes.where(
                  (o) => o.status != CampBroadcastOutcomeStatus.sent))
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '${outcome.name} — ${outcome.status.label.toLowerCase()}'
                    '${outcome.reason == null ? '' : ': ${outcome.reason}'}',
                    style: const TextStyle(
                        fontSize: 12, height: 1.45, color: AppColors.clay400),
                  ),
                ),
            ],
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: widget.onReuse,
              icon: const Icon(AppIcons.copy, size: 15),
              label: const Text('Use as a starting point'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet({this.reuse});

  final CampBroadcast? reuse;

  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends ConsumerState<_ComposeSheet> {
  late final _subject = TextEditingController(text: widget.reuse?.subject);
  late final _body = TextEditingController(text: widget.reuse?.body);
  late final _ctaLabel = TextEditingController(text: widget.reuse?.ctaLabel);
  late final _ctaUrl = TextEditingController(text: widget.reuse?.ctaUrl);
  late final _replyTo = TextEditingController(text: widget.reuse?.replyTo);

  late CampBroadcastAudience _audience =
      widget.reuse?.audience ?? CampBroadcastAudience.all;
  bool _busy = false;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    _ctaLabel.dispose();
    _ctaUrl.dispose();
    _replyTo.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_subject.text.trim().isEmpty || _body.text.trim().isEmpty) {
      context.showError('A subject and a message are both needed.');
      return;
    }
    if (_audience == CampBroadcastAudience.selected) {
      context.showError(
        'Picking individual campers is done on the web for now — choose one '
        'of the other audiences here.',
      );
      return;
    }

    final ok = await confirmAction(
      context,
      title: 'Send to ${_audience.label.toLowerCase()}?',
      message: 'Each camper gets their own personalised copy. This cannot be '
          'unsent.',
      confirmLabel: 'Send',
    );
    if (!ok) return;

    setState(() => _busy = true);
    try {
      final result = await ref.read(campRepositoryProvider).sendBroadcast(
            subject: _subject.text.trim(),
            body: _body.text.trim(),
            audience: _audience,
            ctaLabel: _ctaLabel.text.trim(),
            ctaUrl: _ctaUrl.text.trim(),
            replyTo: _replyTo.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      context.showSuccess(
        '${result.sentCount} sent'
        '${result.failedCount > 0 ? ', ${result.failedCount} failed' : ''}.',
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'New announcement',
              style: AppFonts.display(
                  const TextStyle(fontSize: 21, color: AppColors.clay700)),
            ),
            const SizedBox(height: 4),
            const Text(
              'Type it once. Every camper in the audience gets their own copy.',
              style: TextStyle(
                  fontSize: 13, height: 1.5, color: AppColors.clay400),
            ),
            const SizedBox(height: 20),

            AppDropdown<CampBroadcastAudience>(
              label: 'Who receives it',
              value: _audience,
              items: [
                for (final a in CampBroadcastAudience.values)
                  if (a != CampBroadcastAudience.selected)
                    DropdownMenuItem(value: a, child: Text(a.label)),
              ],
              onChanged: (v) =>
                  setState(() => _audience = v ?? CampBroadcastAudience.all),
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Subject',
              controller: _subject,
              required: true,
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Message',
              controller: _body,
              required: true,
              maxLines: 8,
              minLines: 5,
              hint: 'You can use {{firstName}} — it is filled in per camper.',
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Button label',
              controller: _ctaLabel,
              hint: 'Optional — e.g. "Fill in the form"',
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Button link',
              controller: _ctaUrl,
              keyboardType: TextInputType.url,
              textCapitalization: TextCapitalization.none,
            ),
            const SizedBox(height: 16),
            AppTextField(
              label: 'Replies go to',
              controller: _replyTo,
              keyboardType: TextInputType.emailAddress,
              textCapitalization: TextCapitalization.none,
            ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: 'Send announcement',
              icon: AppIcons.send,
              loading: _busy,
              onPressed: _send,
            ),
          ],
        ),
      ),
    );
  }
}
