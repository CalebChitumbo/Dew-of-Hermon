import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/fundraising/fundraising_menu.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/fundraising_theme.dart';
import '../../core/utils/dates.dart';
import '../../core/widgets/common.dart';
import '../../data/models/enums.dart';
import '../../data/models/fundraising.dart';
import '../../data/repositories/fundraising_repository.dart';

final publicMenuProvider = FutureProvider<MenuConfig>((ref) {
  return ref.watch(fundraisingRepositoryProvider).publicMenu();
});

final publicBraaisProvider = FutureProvider<List<PublicBraai>>((ref) {
  return ref.watch(fundraisingRepositoryProvider).publicBraais();
});

/// Roman numerals for the first five menu cards, as on the web.
const _roman = ['I', 'II', 'III', 'IV', 'V'];

String _money(int amount) => '$kCurrencySymbol$amount';

/// The Potter's Shockers storefront — the public order page, no account
/// needed. Mirrors `/fundraising/order`, parchment and all.
class StorefrontScreen extends ConsumerStatefulWidget {
  const StorefrontScreen({super.key});

  @override
  ConsumerState<StorefrontScreen> createState() => _StorefrontScreenState();
}

class _StorefrontScreenState extends ConsumerState<StorefrontScreen> {
  /// itemKey → quantity.
  final Map<String, int> _cart = {};
  String? _braaiId;

  int get _count => _cart.values.fold(0, (a, b) => a + b);

  int _total(MenuConfig menu) {
    var sum = 0;
    _cart.forEach((key, qty) {
      final item = menu.item(key);
      if (item != null) sum += item.price * qty;
    });
    return sum;
  }

  void _bump(String key, int delta) {
    setState(() {
      final next = (_cart[key] ?? 0) + delta;
      if (next <= 0) {
        _cart.remove(key);
      } else {
        _cart[key] = next.clamp(1, 99);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final menuAsync = ref.watch(publicMenuProvider);
    final braaisAsync = ref.watch(publicBraaisProvider);

    return ParchmentThemeScope(
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: ParchmentColors.paper,
          appBar: AppBar(
            title: const Text("Potter's Shockers"),
            centerTitle: false,
          ),
          floatingActionButton: _count == 0
              ? null
              : FloatingActionButton.extended(
                  backgroundColor: ParchmentColors.ember,
                  foregroundColor: Colors.white,
                  onPressed: () => _openCart(menuAsync.valueOrNull),
                  icon: _CountBubble(count: _count),
                  label: Text(
                    'View order · '
                    '${_money(_total(menuAsync.valueOrNull ?? MenuConfig.fallback()))}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
          body: RefreshIndicator(
            color: ParchmentColors.ember,
            onRefresh: () async {
              ref.invalidate(publicMenuProvider);
              ref.invalidate(publicBraaisProvider);
            },
            child: menuAsync.when(
              loading: () => const LoadingView(message: 'Loading menu…'),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(publicMenuProvider),
              ),
              data: (menu) => _body(context, menu, braaisAsync),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(
    BuildContext context,
    MenuConfig menu,
    AsyncValue<List<PublicBraai>> braaisAsync,
  ) {
    final items = menu.onSale;
    final prices = items.map((i) => i.price).toList()..sort();
    final range = prices.isEmpty
        ? '—'
        : prices.first == prices.last
            ? '${prices.first}'
            : '${prices.first}–${prices.last}';

    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 110),
      children: [
        _Hero(itemCount: items.length, priceRange: range),

        // Which braai are we ordering from?
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
          child: braaisAsync.when(
            loading: () => const _Note('Loading upcoming braais…'),
            error: (_, __) =>
                const _Note("Couldn't load the upcoming braais. Pull to retry."),
            data: (braais) {
              if (braais.isEmpty) {
                return const _Note(
                  'No upcoming braais are open for orders right now. '
                  'Check back soon.',
                );
              }
              final selected = _braaiId ??= braais.first.id;
              final braai = firstWhere(braais, (b) => b.id == selected);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Eyebrow('Ordering for which braai?'),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: selected,
                    isExpanded: true,
                    icon: const Icon(AppIcons.chevronDown, size: 16),
                    items: [
                      for (final b in braais)
                        DropdownMenuItem(
                          value: b.id,
                          child: Text(
                            _braaiLabel(b),
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14),
                          ),
                        ),
                    ],
                    onChanged: (v) => setState(() => _braaiId = v),
                  ),
                  if (braai?.eventDate != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Your order will be ready for collection on '
                      '${D.long(D.fromIso(braai!.eventDate!))}.',
                      style: const TextStyle(
                          fontSize: 12, color: ParchmentColors.inkSoft),
                    ),
                  ],
                ],
              );
            },
          ),
        ),

        const SizedBox(height: 34),
        const _SectionHead(
          eyebrow: 'The Menu',
          title: "Choose what's on your table",
          note: 'Every meal comes with complimentary coleslaw on the side.',
        ),
        const SizedBox(height: 20),

        for (var i = 0; i < items.length; i++)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: _MenuCard(
              item: items[i],
              index: i,
              qty: _cart[items[i].key] ?? 0,
              onInc: () => _bump(items[i].key, 1),
              onDec: () => _bump(items[i].key, -1),
            ),
          ),

        const SizedBox(height: 24),
        const _SectionHead(
          eyebrow: 'Why we do this',
          title: 'Hot food, bigger purpose.',
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 6, 20, 0),
          child: Text(
            'Every Kwacha raised goes back into the ministry — supporting '
            'outreach, camps, and the discipleship of the next generation of '
            'believers at Tabernacle of David.\n\n'
            'Thank you for joining us at the table.',
            style: TextStyle(
                fontSize: 14, height: 1.75, color: ParchmentColors.inkSoft),
          ),
        ),

        const SizedBox(height: 34),
        const _VerseBlock(),
      ],
    );
  }

  static String _braaiLabel(PublicBraai b) {
    final parts = <String>[b.title];
    if (b.eventDate != null) parts.add(D.dayMedium(D.fromIso(b.eventDate!)));
    if ((b.venue ?? '').isNotEmpty) parts.add(b.venue!);
    return parts.join(' · ');
  }

  Future<void> _openCart(MenuConfig? menu) async {
    if (menu == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ParchmentColors.paper,
      builder: (_) => ParchmentThemeScope(
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.85,
          maxChildSize: 0.95,
          builder: (context, controller) => _CartSheet(
            menu: menu,
            cart: Map.of(_cart),
            braaiId: _braaiId,
            scrollController: controller,
            onChangeQty: _bump,
            onOrdered: () => setState(_cart.clear),
          ),
        ),
      ),
    );
    if (mounted) setState(() {});
  }
}

/// The one-off `firstWhere` this file needs, returning null instead of
/// throwing.
T? firstWhere<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

// ─── Hero ───

class _Hero extends StatelessWidget {
  const _Hero({required this.itemCount, required this.priceRange});

  final int itemCount;
  final String priceRange;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 26),
      color: ParchmentColors.paperDeep,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                  color: ParchmentColors.ember,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Live now · Place your order',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                  color: ParchmentColors.ember,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text.rich(
            TextSpan(children: [
              const TextSpan(text: "Potter's "),
              TextSpan(
                text: 'Shockers',
                style: TextStyle(
                  color: ParchmentColors.ember,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const TextSpan(text: '\nFundraiser'),
            ]),
            style: AppFonts.display(const TextStyle(
              fontSize: 34,
              height: 1.1,
              color: ParchmentColors.ink,
            )),
          ),
          const SizedBox(height: 12),
          const Text(
            'Hot food, prepared by the youth, sold every Sunday to support '
            "ministry. Pick your meal below and we'll have it ready for "
            'collection at church.',
            style: TextStyle(
                fontSize: 14, height: 1.7, color: ParchmentColors.inkSoft),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              _HeroStat(value: itemCount == 0 ? '—' : '$itemCount',
                  label: 'Menu Items'),
              _HeroStat(
                  value: '$kCurrencySymbol$priceRange', label: 'Price Range'),
              const _HeroStat(value: '2 ways', label: 'To Pay'),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: AppFonts.display(const TextStyle(
              fontSize: 21,
              color: ParchmentColors.ink,
            )),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: ParchmentColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Menu ───

class _MenuCard extends StatelessWidget {
  const _MenuCard({
    required this.item,
    required this.index,
    required this.qty,
    required this.onInc,
    required this.onDec,
  });

  final MenuItem item;
  final int index;
  final int qty;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFBF5E9),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: ParchmentColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 104,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _ItemVisual(item: item),
                Positioned(
                  top: 6,
                  left: 8,
                  child: Text(
                    _roman.length > index ? _roman[index] : '${index + 1}',
                    style: AppFonts.display(TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.9),
                      shadows: const [
                        Shadow(color: Color(0x99000000), blurRadius: 4),
                      ],
                    )),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(13, 12, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.name,
                    style: AppFonts.display(const TextStyle(
                      fontSize: 16,
                      height: 1.2,
                      color: ParchmentColors.ink,
                    )),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.description,
                    style: const TextStyle(
                        fontSize: 12, height: 1.5,
                        color: ParchmentColors.inkSoft),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Text.rich(
                        TextSpan(children: [
                          TextSpan(
                            text: kCurrencySymbol,
                            style: const TextStyle(
                                fontSize: 11.5,
                                color: ParchmentColors.inkSoft),
                          ),
                          TextSpan(text: '${item.price}'),
                        ]),
                        style: AppFonts.display(const TextStyle(
                          fontSize: 19,
                          color: ParchmentColors.ember,
                        )),
                      ),
                      const Spacer(),
                      _QtyControl(qty: qty, onInc: onInc, onDec: onDec),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The photo if it is bundled, the emoji if it is not — the same fallback the
/// web does with `onError`.
class _ItemVisual extends StatelessWidget {
  const _ItemVisual({required this.item, this.emojiSize = 34});

  final MenuItem item;
  final double emojiSize;

  @override
  Widget build(BuildContext context) {
    final asset = item.assetPath;
    final fallback = Container(
      color: ParchmentColors.paperDeep,
      alignment: Alignment.center,
      child: Text(item.emoji, style: TextStyle(fontSize: emojiSize)),
    );
    if (asset == null) return fallback;
    return Image.asset(
      asset,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => fallback,
    );
  }
}

class _QtyControl extends StatelessWidget {
  const _QtyControl({
    required this.qty,
    required this.onInc,
    required this.onDec,
    this.compact = false,
  });

  final int qty;
  final VoidCallback onInc;
  final VoidCallback onDec;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 26.0 : 30.0;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: ParchmentColors.border),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _RoundButton(
            icon: AppIcons.minus,
            size: size,
            onTap: qty == 0 ? null : onDec,
          ),
          SizedBox(
            width: compact ? 24 : 28,
            child: Text(
              '$qty',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: compact ? 13 : 14.5,
                fontWeight: FontWeight.w700,
                color: ParchmentColors.ink,
              ),
            ),
          ),
          _RoundButton(icon: AppIcons.plus, size: size, onTap: onInc),
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.size,
    required this.onTap,
  });

  final IconData icon;
  final double size;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(
          icon,
          size: size * 0.5,
          color: onTap == null
              ? ParchmentColors.border
              : ParchmentColors.ink,
        ),
      ),
    );
  }
}

// ─── Cart → checkout → receipt ───

class _CartSheet extends ConsumerStatefulWidget {
  const _CartSheet({
    required this.menu,
    required this.cart,
    required this.braaiId,
    required this.scrollController,
    required this.onChangeQty,
    required this.onOrdered,
  });

  final MenuConfig menu;
  final Map<String, int> cart;
  final String? braaiId;
  final ScrollController scrollController;
  final void Function(String key, int delta) onChangeQty;
  final VoidCallback onOrdered;

  @override
  ConsumerState<_CartSheet> createState() => _CartSheetState();
}

enum _CartView { cart, checkout, receipt }

class _CartSheetState extends ConsumerState<_CartSheet> {
  late Map<String, int> _cart = Map.of(widget.cart);
  _CartView _view = _CartView.cart;

  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _time = TextEditingController();
  final _notes = TextEditingController();
  FundraisingPickupTimeOption _pickup = FundraisingPickupTimeOption.after1st;

  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _receipt;
  bool _copied = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _time.dispose();
    _notes.dispose();
    super.dispose();
  }

  int get _count => _cart.values.fold(0, (a, b) => a + b);

  int get _total {
    var sum = 0;
    _cart.forEach((key, qty) {
      final item = widget.menu.item(key);
      if (item != null) sum += item.price * qty;
    });
    return sum;
  }

  void _bump(String key, int delta) {
    setState(() {
      final next = (_cart[key] ?? 0) + delta;
      if (next <= 0) {
        _cart.remove(key);
      } else {
        _cart[key] = next.clamp(1, 99);
      }
    });
    // Keep the page behind the sheet in step.
    widget.onChangeQty(key, delta);
  }

  Future<void> _submit() async {
    if (widget.braaiId == null) {
      setState(() => _error = "Pick which braai you're ordering from.");
      return;
    }
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Your name is required.');
      return;
    }
    if (_phone.text.trim().isEmpty) {
      setState(() => _error =
          'A phone number is required so we can find you at collection.');
      return;
    }
    if (_pickup == FundraisingPickupTimeOption.custom &&
        !RegExp(r'^\d{1,2}:\d{2}$').hasMatch(_time.text.trim())) {
      setState(() => _error = 'Time should look like HH:mm.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final receipt =
          await ref.read(fundraisingRepositoryProvider).placeOrder(
                braaiEventId: widget.braaiId!,
                customerName: _name.text.trim(),
                customerPhone: _phone.text.trim(),
                pickupTime: _pickup,
                customPickupTime: _time.text.trim(),
                notes: _notes.text.trim(),
                quantities: _cart,
              );
      if (!mounted) return;
      setState(() {
        _receipt = receipt;
        _view = _CartView.receipt;
        _busy = false;
      });
      widget.onOrdered();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Head
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  switch (_view) {
                    _CartView.receipt => 'Order Confirmed',
                    _CartView.checkout => 'Your Details',
                    _CartView.cart => 'Your Order',
                  },
                  style: AppFonts.display(const TextStyle(
                      fontSize: 19, color: ParchmentColors.ink)),
                ),
              ),
              IconButton(
                icon: const Icon(AppIcons.close, size: 20),
                color: ParchmentColors.inkSoft,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: switch (_view) {
            _CartView.cart => _cartBody(),
            _CartView.checkout => _checkoutBody(),
            _CartView.receipt => _receiptBody(),
          },
        ),
      ],
    );
  }

  // ── Cart ──

  Widget _cartBody() {
    final lines = <(MenuItem, int)>[
      for (final entry in _cart.entries)
        if (widget.menu.item(entry.key) != null)
          (widget.menu.item(entry.key)!, entry.value),
    ];

    return Column(
      children: [
        Expanded(
          child: lines.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(30),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('🧺', style: TextStyle(fontSize: 40)),
                        SizedBox(height: 12),
                        Text(
                          'Your basket is empty. Add something from the menu.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 14, color: ParchmentColors.inkSoft),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  controller: widget.scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  children: [
                    for (final (item, qty) in lines)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius:
                                  BorderRadius.circular(AppRadius.sm),
                              child: SizedBox(
                                width: 46,
                                height: 46,
                                child:
                                    _ItemVisual(item: item, emojiSize: 22),
                              ),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: ParchmentColors.ink,
                                    ),
                                  ),
                                  Text(
                                    '${_money(item.price)} each',
                                    style: const TextStyle(
                                        fontSize: 11.5,
                                        color: ParchmentColors.inkSoft),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              _money(item.price * qty),
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: ParchmentColors.ink,
                              ),
                            ),
                            const SizedBox(width: 10),
                            _QtyControl(
                              qty: qty,
                              compact: true,
                              onInc: () => _bump(item.key, 1),
                              onDec: () => _bump(item.key, -1),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
        _foot(
          rows: [('Items', '$_count')],
          action: FilledButton(
            onPressed: lines.isEmpty
                ? null
                : () => setState(() {
                      _error = widget.braaiId == null
                          ? "Pick which braai you're ordering from."
                          : null;
                      _view = _CartView.checkout;
                    }),
            child: const Text('Continue to details'),
          ),
        ),
      ],
    );
  }

  // ── Checkout ──

  Widget _checkoutBody() {
    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: widget.scrollController,
            padding: EdgeInsets.fromLTRB(
                20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 16),
            children: [
              TextButton.icon(
                onPressed: () => setState(() => _view = _CartView.cart),
                icon: const Icon(AppIcons.back, size: 15),
                label: const Text('Back to basket'),
                style: TextButton.styleFrom(
                    foregroundColor: ParchmentColors.inkSoft),
              ),
              const SizedBox(height: 6),
              const Text(
                "Almost there. We just need to know who's collecting.",
                style: TextStyle(
                    fontSize: 13.5, height: 1.6,
                    color: ParchmentColors.inkSoft),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                _ErrorNote(_error!),
              ],
              const SizedBox(height: 18),
              _Field(label: 'Your name', child: TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(hintText: 'Your name'),
              )),
              const SizedBox(height: 14),
              _Field(label: 'Phone number', child: TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(hintText: '+260 …'),
              )),
              const SizedBox(height: 14),
              _Field(
                label: 'When will you collect?',
                child: DropdownButtonFormField<FundraisingPickupTimeOption>(
                  value: _pickup,
                  isExpanded: true,
                  icon: const Icon(AppIcons.chevronDown, size: 16),
                  items: [
                    for (final option in FundraisingPickupTimeOption.values)
                      DropdownMenuItem(
                        value: option,
                        child: Text(
                          option == FundraisingPickupTimeOption.custom
                              ? 'Pick a specific time…'
                              : option.label,
                          style: const TextStyle(fontSize: 14),
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(
                      () => _pickup = v ?? FundraisingPickupTimeOption.after1st),
                ),
              ),
              if (_pickup == FundraisingPickupTimeOption.custom) ...[
                const SizedBox(height: 14),
                _Field(
                  label: 'Time',
                  child: TextField(
                    controller: _time,
                    keyboardType: TextInputType.datetime,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9:]')),
                      LengthLimitingTextInputFormatter(5),
                    ],
                    decoration: const InputDecoration(hintText: '13:30'),
                  ),
                ),
              ],
              const SizedBox(height: 14),
              _Field(
                label: 'Anything we should know? (optional)',
                child: TextField(
                  controller: _notes,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                      hintText: 'Allergies, special requests…'),
                ),
              ),
            ],
          ),
        ),
        _foot(
          action: FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : Text('Place order · ${_money(_total)}'),
          ),
        ),
      ],
    );
  }

  // ── Receipt ──

  Widget _receiptBody() {
    final order = _receipt ?? const <String, dynamic>{};
    final orderNumber = '${order['orderNumber'] ?? ''}';
    final total = order['total'] is num ? (order['total'] as num).toInt() : 0;
    final momo = '${order['momoNumber'] ?? kDefaultMomoNumber}';
    final lines = (order['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((m) => OrderLine.fromMap(Map<String, dynamic>.from(m)))
        .toList();

    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: widget.scrollController,
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            children: [
              Column(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: const BoxDecoration(
                      color: ParchmentColors.ember,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Icon(AppIcons.check,
                        size: 26, color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Order placed!',
                    style: AppFonts.display(const TextStyle(
                        fontSize: 22, color: ParchmentColors.ink)),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'Now complete payment below',
                    style: TextStyle(
                        fontSize: 13, color: ParchmentColors.inkSoft),
                  ),
                ],
              ),
              const SizedBox(height: 22),

              // Receipt
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF5E9),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                  border: Border.all(color: ParchmentColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _Eyebrow('Order Number'),
                    const SizedBox(height: 3),
                    Text(
                      orderNumber,
                      style: AppFonts.display(const TextStyle(
                          fontSize: 24, color: ParchmentColors.ember)),
                    ),
                    const SizedBox(height: 14),
                    const Divider(height: 1),
                    const SizedBox(height: 12),
                    _ReceiptRow(
                      left: '${order['braaiEventTitle'] ?? 'Fundraising braai'}',
                      right: order['braaiEventDate'] == null
                          ? ''
                          : D.dayMedium(D.fromIso('${order['braaiEventDate']}')),
                      muted: true,
                    ),
                    _ReceiptRow(
                      left: 'Collection',
                      right: _pickup == FundraisingPickupTimeOption.custom &&
                              _time.text.trim().isNotEmpty
                          ? 'At ${_time.text.trim()}'
                          : _pickup.label,
                      muted: true,
                    ),
                    const SizedBox(height: 10),
                    for (final line in lines)
                      _ReceiptRow(
                        left: '${line.qty}×  ${line.name}',
                        right: _money(line.subtotal),
                      ),
                    const SizedBox(height: 10),
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text(
                          'Total',
                          style: AppFonts.display(const TextStyle(
                              fontSize: 16, color: ParchmentColors.ink)),
                        ),
                        const Spacer(),
                        Text(
                          _money(total),
                          style: AppFonts.display(const TextStyle(
                              fontSize: 20, color: ParchmentColors.ember)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${order['customerName'] ?? ''}\n'
                      '${order['customerPhone'] ?? ''}',
                      style: const TextStyle(
                          fontSize: 12.5, height: 1.5,
                          color: ParchmentColors.inkSoft),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 22),
              const _Eyebrow('Pay with one of these'),
              const SizedBox(height: 3),
              const Text(
                "Choose what's easiest for you.",
                style:
                    TextStyle(fontSize: 13, color: ParchmentColors.inkSoft),
              ),
              const SizedBox(height: 12),

              _PayCard(
                emoji: '📱',
                method: 'Mobile Money',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            momo,
                            style: AppFonts.display(const TextStyle(
                                fontSize: 20, color: ParchmentColors.ink)),
                          ),
                        ),
                        OutlinedButton(
                          onPressed: () async {
                            await Clipboard.setData(
                                ClipboardData(text: momo));
                            if (!mounted) return;
                            setState(() => _copied = true);
                          },
                          style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 36)),
                          child: Text(_copied ? 'Copied' : 'Copy'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text.rich(
                      TextSpan(children: [
                        const TextSpan(text: 'Send '),
                        TextSpan(
                          text: _money(total),
                          style:
                              const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const TextSpan(text: ' to the number above.'),
                      ]),
                      style: const TextStyle(
                          fontSize: 13, color: ParchmentColors.inkSoft),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Use order number $orderNumber as reference if possible.',
                      style: const TextStyle(
                          fontSize: 12, color: ParchmentColors.inkSoft),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _PayCard(
                emoji: '💵',
                method: 'Cash at Collection',
                child: Text.rich(
                  TextSpan(children: [
                    const TextSpan(text: 'Pay '),
                    TextSpan(
                      text: _money(total),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const TextSpan(
                        text: ' when you pick up your order. Bring the exact '
                            'amount if possible.'),
                  ]),
                  style: const TextStyle(
                      fontSize: 13, height: 1.6,
                      color: ParchmentColors.inkSoft),
                ),
              ),

              const SizedBox(height: 18),
              const Text(
                'Keep this screen or take a screenshot — your order number is '
                'the easiest way for the team to find your meal at the '
                'counter.',
                style: TextStyle(
                    fontSize: 12, height: 1.6, color: ParchmentColors.inkSoft),
              ),
            ],
          ),
        ),
        _foot(
          action: OutlinedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Place Another Order'),
          ),
        ),
      ],
    );
  }

  Widget _foot({
    List<(String, String)> rows = const [],
    required Widget action,
  }) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          20, 14, 20, MediaQuery.of(context).padding.bottom + 16),
      decoration: const BoxDecoration(
        color: ParchmentColors.paperDeep,
        border: Border(top: BorderSide(color: ParchmentColors.border)),
      ),
      child: Column(
        children: [
          for (final (label, value) in rows) ...[
            Row(
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 13, color: ParchmentColors.inkSoft)),
                const Spacer(),
                Text(value,
                    style: const TextStyle(
                        fontSize: 13, color: ParchmentColors.ink)),
              ],
            ),
            const SizedBox(height: 6),
          ],
          if (_view != _CartView.receipt) ...[
            Row(
              children: [
                Text(
                  'Total',
                  style: AppFonts.display(const TextStyle(
                      fontSize: 16, color: ParchmentColors.ink)),
                ),
                const Spacer(),
                Text(
                  _money(_total),
                  style: AppFonts.display(const TextStyle(
                      fontSize: 21, color: ParchmentColors.ember)),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          SizedBox(width: double.infinity, child: action),
        ],
      ),
    );
  }
}

// ─── Small parchment pieces ───

class _SectionHead extends StatelessWidget {
  const _SectionHead({required this.eyebrow, required this.title, this.note});

  final String eyebrow;
  final String title;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Eyebrow(eyebrow),
          const SizedBox(height: 6),
          Text(
            title,
            style: AppFonts.display(const TextStyle(
                fontSize: 25, height: 1.2, color: ParchmentColors.ink)),
          ),
          if (note != null) ...[
            const SizedBox(height: 6),
            Text(
              note!,
              style: const TextStyle(
                  fontSize: 13, height: 1.6, color: ParchmentColors.inkSoft),
            ),
          ],
        ],
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.8,
        color: ParchmentColors.ember,
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ParchmentColors.paperDeep,
        borderRadius: BorderRadius.circular(AppRadius.base),
        border: Border.all(color: ParchmentColors.border),
      ),
      child: Text(
        text,
        style: const TextStyle(
            fontSize: 13, height: 1.55, color: ParchmentColors.inkSoft),
      ),
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.rose50,
        borderRadius: BorderRadius.circular(AppRadius.base),
        border: Border.all(color: AppColors.rose500.withValues(alpha: 0.25)),
      ),
      child: Text(
        message,
        style: const TextStyle(
            fontSize: 13, height: 1.5, color: AppColors.rose500),
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.left,
    required this.right,
    this.muted = false,
  });

  final String left;
  final String right;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: muted ? 12 : 13.5,
      color: muted ? ParchmentColors.inkSoft : ParchmentColors.ink,
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(left, style: style)),
          if (right.isNotEmpty) ...[
            const SizedBox(width: 12),
            Text(right, style: style),
          ],
        ],
      ),
    );
  }
}

class _PayCard extends StatelessWidget {
  const _PayCard({
    required this.emoji,
    required this.method,
    required this.child,
  });

  final String emoji;
  final String method;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFFFBF5E9),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: ParchmentColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 9),
              Text(
                method,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: ParchmentColors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _VerseBlock extends StatelessWidget {
  const _VerseBlock();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 30),
      color: ParchmentColors.paperDeep,
      child: Column(
        children: [
          Text(
            '“As the dew of Hermon, and as the dew that descended upon the '
            'mountains of Zion: for there the LORD commanded the blessing.”',
            textAlign: TextAlign.center,
            style: AppFonts.display(const TextStyle(
                fontSize: 17, height: 1.6, color: ParchmentColors.ink)),
          ),
          const SizedBox(height: 10),
          const Text(
            'PSALM 133:3',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: ParchmentColors.ember,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Every Kwacha · For the Kingdom · Thank You',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11.5,
              letterSpacing: 0.6,
              color: ParchmentColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: ParchmentColors.inkSoft,
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _CountBubble extends StatelessWidget {
  const _CountBubble({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        '$count',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}
