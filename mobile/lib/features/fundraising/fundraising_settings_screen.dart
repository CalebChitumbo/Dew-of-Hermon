import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_providers.dart';
import '../../core/api/api_client.dart';
import '../../core/fundraising/fundraising_menu.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/lux.dart';
import '../../data/models/fundraising.dart';
import '../../data/repositories/fundraising_repository.dart';
import 'storefront_screen.dart' show publicMenuProvider;

final manageMenuProvider = FutureProvider<MenuConfig>((ref) {
  return ref.watch(fundraisingRepositoryProvider).menu();
});

/// Menu & Settings — the prices buyers see and the MoMo number on receipts.
/// Mirrors `/manage/fundraising/settings`.
class FundraisingSettingsScreen extends ConsumerStatefulWidget {
  const FundraisingSettingsScreen({super.key});

  @override
  ConsumerState<FundraisingSettingsScreen> createState() =>
      _FundraisingSettingsScreenState();
}

class _FundraisingSettingsScreenState
    extends ConsumerState<FundraisingSettingsScreen> {
  /// itemKey → the price as typed, so a half-finished edit is not lost.
  final Map<String, TextEditingController> _prices = {};
  final Map<String, bool> _enabled = {};
  final _momo = TextEditingController();

  bool _loaded = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _prices.values) {
      c.dispose();
    }
    _momo.dispose();
    super.dispose();
  }

  void _seed(MenuConfig menu) {
    if (_loaded) return;
    _loaded = true;
    for (final item in menu.items) {
      _prices[item.key] = TextEditingController(text: '${item.price}');
      _enabled[item.key] = item.enabled;
    }
    // An item the config has never heard of still deserves a row.
    for (final def in kFundraisingMenuItems) {
      _prices.putIfAbsent(
          def.key, () => TextEditingController(text: '${def.defaultPrice}'));
      _enabled.putIfAbsent(def.key, () => true);
    }
    _momo.text = menu.momoNumber;
  }

  Future<void> _save() async {
    final prices = <String, int>{};
    for (final entry in _prices.entries) {
      final value = int.tryParse(entry.value.text.trim());
      if (value == null || value < 0 || value > 100000) {
        context.showError(
            'Every price must be a whole number between 0 and 100000.');
        return;
      }
      prices[entry.key] = value;
    }

    setState(() => _busy = true);
    try {
      await ref.read(fundraisingRepositoryProvider).updateMenu(
            itemPrices: prices,
            disabledItemKeys: [
              for (final entry in _enabled.entries)
                if (!entry.value) entry.key,
            ],
            momoNumber: _momo.text.trim(),
          );
      ref.invalidate(manageMenuProvider);
      // The storefront reads its own copy — keep the two in step.
      ref.invalidate(publicMenuProvider);
      if (mounted) {
        setState(() => _busy = false);
        context.showSuccess('Saved. The order page updates straight away.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        context.showError(e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ref.watch(accessProvider);
    final async = ref.watch(manageMenuProvider);

    if (!access.can('plan_fundraising_braai')) {
      return const AppScaffold(
        title: 'Menu & Settings',
        showBottomNav: false,
        body: NoAccessView(
          message: 'Only the Fundraising lead can edit menu prices.',
        ),
      );
    }

    return AppScaffold(
      title: 'Menu & Settings',
      subtitle: 'Prices buyers see, and the MoMo number on receipts',
      showBottomNav: false,
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(manageMenuProvider),
        ),
        data: (menu) {
          _seed(menu);

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              NoticeCard(
                icon: AppIcons.info,
                message: 'The items themselves are fixed in code on both the '
                    'web and the app. What you set here is the price and '
                    'whether each one is on sale.',
              ),
              const SizedBox(height: 22),

              const SectionHeading(
                title: 'Prices',
                icon: AppIcons.receipt,
                subtitle: 'In $kFundraisingCurrency. Turn an item off to hide '
                    'it from the order page.',
              ),
              const SizedBox(height: 12),
              for (final def in kFundraisingMenuItems)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _PriceRow(
                    def: def,
                    controller: _prices[def.key]!,
                    enabled: _enabled[def.key] ?? true,
                    onToggle: (v) => setState(() => _enabled[def.key] = v),
                  ),
                ),

              const SizedBox(height: 22),
              const SectionHeading(
                title: 'Mobile Money',
                icon: AppIcons.money,
                tone: IconTone.emerald,
                subtitle: 'The number printed on every receipt.',
              ),
              const SizedBox(height: 12),
              AppTextField(
                label: 'MoMo number',
                controller: _momo,
                keyboardType: TextInputType.phone,
                textCapitalization: TextCapitalization.none,
                hint: kDefaultMomoNumber,
                inputFormatters: [LengthLimitingTextInputFormatter(60)],
              ),

              const SizedBox(height: 26),
              PrimaryButton(
                label: 'Save changes',
                icon: AppIcons.check,
                loading: _busy,
                onPressed: _save,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.def,
    required this.controller,
    required this.enabled,
    required this.onToggle,
  });

  final MenuItemDef def;
  final TextEditingController controller;
  final bool enabled;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    return LuxCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Text(def.emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  def.name,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: enabled ? AppColors.clay700 : AppColors.clay400,
                  ),
                ),
                Text(
                  enabled ? 'On sale' : 'Hidden from the order page',
                  style: TextStyle(
                    fontSize: 11.5,
                    color:
                        enabled ? AppColors.clay400 : AppColors.destructive,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 76,
            child: TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.end,
              enabled: enabled,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              decoration: const InputDecoration(
                prefixText: kCurrencySymbol,
                isDense: true,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              ),
              style: const TextStyle(
                  fontSize: 14.5, fontWeight: FontWeight.w600),
            ),
          ),
          // Gold track comes from `switchTheme` in app_theme.dart.
          Switch(value: enabled, onChanged: onToggle),
        ],
      ),
    );
  }
}
