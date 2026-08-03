import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_theme.dart';
import '../theme/icon_tones.dart';
import 'lux.dart';

/// A coloured status pill — the Dart counterpart of `StatusBadge.tsx`.
class StatusBadge extends StatelessWidget {
  const StatusBadge(
    this.label, {
    super.key,
    this.tone = IconTone.clay,
    this.icon,
    this.dense = false,
  });

  /// Pick a tone from a status string, using the same colour language the web
  /// uses: green = settled, amber = waiting, red = refused, blue = in flight.
  factory StatusBadge.forStatus(String wire, {String? label, bool dense = false}) {
    final upper = wire.toUpperCase();
    IconTone tone;
    if (upper.contains('APPROVED') ||
        upper.contains('CONFIRMED') ||
        upper == 'PAID' ||
        upper == 'DONE' ||
        upper == 'COMPLETED' ||
        upper == 'REVIEWED' ||
        upper == 'DELIVERED' ||
        upper == 'COLLECTED' ||
        upper == 'RETURNED' ||
        upper == 'MEMBER') {
      tone = IconTone.emerald;
    } else if (upper.startsWith('PENDING') ||
        upper == 'DRAFT' ||
        upper == 'SUBMITTED' ||
        upper == 'QUEUED' ||
        upper == 'UNPAID' ||
        upper == 'PARTIAL' ||
        upper == 'IN_PREP' ||
        upper == 'CHANGES_REQUESTED' ||
        upper == 'NO_RESPONSE') {
      tone = IconTone.amber;
    } else if (upper.contains('REJECTED') ||
        upper == 'DECLINED' ||
        upper == 'CANCELLED' ||
        upper == 'FAILED' ||
        upper == 'WITHDRAWN') {
      tone = IconTone.rose;
    } else if (upper == 'OUT' ||
        upper == 'IN_PROGRESS' ||
        upper == 'ASSIGNED' ||
        upper == 'SHORTLISTED' ||
        upper == 'SLOTTED' ||
        upper == 'READY' ||
        upper == 'CONTACTED') {
      tone = IconTone.blue;
    } else {
      tone = IconTone.clay;
    }
    return StatusBadge(label ?? _humanise(wire), tone: tone, dense: dense);
  }

  final String label;
  final IconTone tone;
  final IconData? icon;
  final bool dense;

  static String _humanise(String wire) {
    if (wire.isEmpty) return wire;
    return wire
        .split('_')
        .map((w) => w.isEmpty
            ? w
            : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(tone);
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: dense ? 8 : 10, vertical: dense ? 3 : 5),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: dense ? 11 : 13, color: colors.foreground),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: dense ? 10.5 : 11.5,
              fontWeight: FontWeight.w600,
              color: colors.foreground,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// The page-level loading state — a small gold spinner, centred.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            height: 30,
            width: 30,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(message!,
                style: const TextStyle(
                    fontSize: 13.5, color: AppColors.clay400)),
          ],
        ],
      ),
    );
  }
}

/// What a screen shows when a stream or request failed.
class ErrorView extends StatelessWidget {
  const ErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.title = 'Something went wrong',
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyStateLux(
      icon: AppIcons.alert,
      tone: IconTone.rose,
      title: title,
      description: message,
      action: onRetry == null
          ? null
          : OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(AppIcons.refresh, size: 16),
              label: const Text('Try again'),
            ),
    );
  }
}

/// A labelled field row, used across every detail screen.
class DetailRow extends StatelessWidget {
  const DetailRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.valueWidget,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Widget? valueWidget;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(icon, size: 15, color: AppColors.clay300),
            ),
            const SizedBox(width: 10),
          ],
          SizedBox(
            width: 116,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.clay400,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: valueWidget ??
                Text(
                  value.isEmpty ? '—' : value,
                  style: TextStyle(
                    fontSize: 13.5,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                    color: onTap != null
                        ? AppColors.goldDark
                        : AppColors.clay700,
                  ),
                ),
          ),
        ],
      ),
    );
    if (onTap == null) return row;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: row,
    );
  }
}

/// A tappable list row inside a LuxCard — the standard list idiom.
class LuxTile extends StatelessWidget {
  const LuxTile({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.tone = IconTone.clay,
    this.trailing,
    this.onTap,
    this.leading,
    this.dense = false,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final IconTone tone;
  final Widget? trailing;
  final Widget? leading;
  final VoidCallback? onTap;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(
              horizontal: 16, vertical: dense ? 10 : 13),
          child: Row(
            children: [
              if (leading != null)
                leading!
              else if (icon != null)
                IconChip(icon!, tone: tone, size: dense ? 34 : 40),
              if (leading != null || icon != null) const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: dense ? 13.5 : 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.clay700,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          subtitle!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.clay400,
                            height: 1.35,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 10),
                trailing!,
              ] else if (onTap != null) ...[
                const SizedBox(width: 6),
                const Icon(AppIcons.chevronRight,
                    size: 17, color: AppColors.clay300),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A hairline divider inset to the text column, as list separators are on the
/// web.
class LuxDivider extends StatelessWidget {
  const LuxDivider({super.key, this.indent = 16});
  final double indent;

  @override
  Widget build(BuildContext context) => Divider(
        height: 1,
        thickness: 1,
        indent: indent,
        endIndent: indent,
        color: AppColors.clay100,
      );
}

/// The section label used above form groups.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.required = false});

  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: RichText(
        text: TextSpan(
          text: text,
          style: AppFonts.body(const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.clay600,
          )),
          children: required
              ? [
                  const TextSpan(
                    text: ' *',
                    style: TextStyle(color: AppColors.destructive),
                  ),
                ]
              : null,
        ),
      ),
    );
  }
}

/// A labelled text field, wrapped so every form reads the same.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.required = false,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
    this.minLines,
    this.validator,
    this.onChanged,
    this.suffix,
    this.prefixIcon,
    this.enabled = true,
    this.initialValue,
    this.textCapitalization = TextCapitalization.sentences,
    this.inputFormatters,
    this.autofillHints,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int maxLines;
  final int? minLines;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final Widget? suffix;
  final IconData? prefixIcon;
  final bool enabled;
  final String? initialValue;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final TextInputAction? textInputAction;
  final void Function(String)? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(label, required: required),
        TextFormField(
          controller: controller,
          initialValue: initialValue,
          keyboardType: keyboardType,
          obscureText: obscureText,
          maxLines: obscureText ? 1 : maxLines,
          minLines: minLines,
          enabled: enabled,
          textCapitalization: textCapitalization,
          inputFormatters: inputFormatters,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          onFieldSubmitted: onFieldSubmitted,
          onChanged: onChanged,
          validator: validator ??
              (required
                  ? (v) => (v == null || v.trim().isEmpty)
                      ? '$label is required'
                      : null
                  : null),
          style: const TextStyle(fontSize: 14.5, color: AppColors.clay700),
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: suffix,
            prefixIcon: prefixIcon == null
                ? null
                : Icon(prefixIcon, size: 18, color: AppColors.clay300),
          ),
        ),
      ],
    );
  }
}

/// A labelled dropdown, wrapped to match [AppTextField].
class AppDropdown<T> extends StatelessWidget {
  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.required = false,
    this.hint,
  });

  final String label;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final bool required;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(label, required: required),
        DropdownButtonFormField<T>(
          value: value,
          items: items,
          onChanged: onChanged,
          isExpanded: true,
          icon: const Icon(AppIcons.chevronDown,
              size: 16, color: AppColors.clay400),
          style: const TextStyle(fontSize: 14.5, color: AppColors.clay700),
          decoration: InputDecoration(hintText: hint),
          validator: required
              ? (v) => v == null ? '$label is required' : null
              : null,
        ),
      ],
    );
  }
}

/// A full-width primary action, sized for a thumb.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = true,
    this.destructive = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool expand;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton(
      onPressed: loading ? null : onPressed,
      style: destructive
          ? FilledButton.styleFrom(
              backgroundColor: AppColors.destructive,
              foregroundColor: Colors.white,
            )
          : null,
      child: loading
          ? const SizedBox(
              height: 19,
              width: 19,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                color: Colors.white,
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 17),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(label, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A card that carries a short explanation, warning or instruction.
class NoticeCard extends StatelessWidget {
  const NoticeCard({
    super.key,
    required this.message,
    this.title,
    this.tone = IconTone.gold,
    this.icon,
    this.action,
  });

  final String message;
  final String? title;
  final IconTone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(tone);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: colors.foreground.withValues(alpha: 0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(icon ?? AppIcons.info,
                size: 17, color: colors.foreground),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: colors.foreground,
                    ),
                  ),
                  const SizedBox(height: 3),
                ],
                Text(
                  message,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: colors.foreground.withValues(alpha: 0.92),
                  ),
                ),
                if (action != null) ...[
                  const SizedBox(height: 10),
                  action!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The member avatar — profile photo when there is one, monogram otherwise.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.initials,
    this.imageUrl,
    this.size = 40,
  });

  final String initials;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: size,
      width: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.clay100,
        image: (imageUrl != null && imageUrl!.isNotEmpty)
            ? DecorationImage(
                image: NetworkImage(imageUrl!), fit: BoxFit.cover)
            : null,
      ),
      alignment: Alignment.center,
      child: (imageUrl != null && imageUrl!.isNotEmpty)
          ? null
          : Text(
              initials,
              style: TextStyle(
                fontSize: size * 0.36,
                fontWeight: FontWeight.w700,
                color: AppColors.clay600,
              ),
            ),
    );
  }
}

/// A segmented control matching the web's `SegmentedTabsList`.
class SegmentedTabs extends StatelessWidget {
  const SegmentedTabs({
    super.key,
    required this.tabs,
    required this.selected,
    required this.onSelect,
    this.counts = const {},
  });

  final List<String> tabs;
  final int selected;
  final ValueChanged<int> onSelect;
  final Map<int, int> counts;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: AppColors.cream,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: AppColors.clay100),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < tabs.length; i++)
              Padding(
                padding: EdgeInsets.only(right: i == tabs.length - 1 ? 0 : 5),
                child: _tab(i),
              ),
          ],
        ),
      ),
    );
  }

  Widget _tab(int i) {
    final active = i == selected;
    final count = counts[i] ?? 0;
    return Material(
      color: active ? Colors.white : Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: () => onSelect(i),
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: active
                  ? AppColors.gold.withValues(alpha: 0.35)
                  : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                tabs[i],
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: active ? AppColors.clay700 : AppColors.clay500,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 7),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: active
                        ? AppColors.gold.withValues(alpha: 0.15)
                        : AppColors.clay100,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color:
                          active ? AppColors.goldDark : AppColors.clay500,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Snackbar helpers so every screen reports success and failure identically.
extension AppMessenger on BuildContext {
  void showSuccess(String message) => _show(message, AppColors.clay800,
      icon: AppIcons.checkCircle, iconColor: const Color(0xFF6EE7B7));

  void showError(String message) => _show(message, AppColors.destructive,
      icon: AppIcons.alert, iconColor: Colors.white);

  void showInfo(String message) => _show(message, AppColors.clay700);

  void _show(String message, Color background,
      {IconData? icon, Color? iconColor}) {
    final messenger = ScaffoldMessenger.maybeOf(this);
    if (messenger == null) return;
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        backgroundColor: background,
        duration: const Duration(seconds: 4),
        content: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 17, color: iconColor ?? Colors.white),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Text(message,
                  style: const TextStyle(
                      fontSize: 13.5, color: AppColors.cream)),
            ),
          ],
        ),
      ));
  }
}

/// Ask for confirmation before something irreversible.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(cancelLabel,
              style: const TextStyle(color: AppColors.clay500)),
        ),
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(true),
          style: destructive
              ? FilledButton.styleFrom(
                  backgroundColor: AppColors.destructive,
                  foregroundColor: Colors.white,
                )
              : null,
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// Prompt for a short free-text comment — the decision dialogs all use this.
Future<String?> promptForText(
  BuildContext context, {
  required String title,
  String? hint,
  String confirmLabel = 'Submit',
  bool required = false,
  int maxLines = 4,
}) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLines: maxLines,
        minLines: 2,
        decoration: InputDecoration(hintText: hint),
        style: const TextStyle(fontSize: 14.5),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Cancel',
              style: TextStyle(color: AppColors.clay500)),
        ),
        FilledButton(
          onPressed: () {
            final text = controller.text.trim();
            if (required && text.isEmpty) return;
            Navigator.of(ctx).pop(text);
          },
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  controller.dispose();
  return result;
}
