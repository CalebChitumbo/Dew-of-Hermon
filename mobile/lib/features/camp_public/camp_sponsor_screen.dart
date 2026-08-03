import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/camp_theme.dart';
import '../../core/utils/money.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';

/// Pledge to send a young person to camp.
///
/// Anonymous submission is allowed on purpose — sponsors are usually not app
/// users, and the camp team allocates pledges to campers afterwards.
class CampSponsorScreen extends ConsumerStatefulWidget {
  const CampSponsorScreen({super.key});

  @override
  ConsumerState<CampSponsorScreen> createState() => _CampSponsorScreenState();
}

class _CampSponsorScreenState extends ConsumerState<CampSponsorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _organization = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _notes = TextEditingController();

  CampSponsorshipPledgeType _type = CampSponsorshipPledgeType.slots;
  int _slots = 1;
  final _amount = TextEditingController();

  bool _busy = false;
  String? _error;
  bool _done = false;

  @override
  void dispose() {
    _name.dispose();
    _organization.dispose();
    _phone.dispose();
    _email.dispose();
    _notes.dispose();
    _amount.dispose();
    super.dispose();
  }

  double get _computedAmount {
    final camp = getCamp(kDefaultCampId);
    if (_type == CampSponsorshipPledgeType.slots) {
      return (camp?.fee ?? 0) * _slots;
    }
    return double.tryParse(_amount.text.trim()) ?? 0;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_type == CampSponsorshipPledgeType.amount && _computedAmount <= 0) {
      setState(() => _error = 'Enter the amount you would like to pledge.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(campRepositoryProvider).pledgeSponsorship({
        'campId': kDefaultCampId,
        'sponsorName': _name.text.trim(),
        if (_organization.text.trim().isNotEmpty)
          'organization': _organization.text.trim(),
        'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'pledgeType': _type.wire,
        if (_type == CampSponsorshipPledgeType.slots) 'slotsPledged': _slots,
        if (_type == CampSponsorshipPledgeType.amount)
          'amountPledged': _computedAmount,
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
      });
      if (mounted) setState(() => _done = true);
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
    final camp = getCamp(kDefaultCampId);

    return RopsThemeScope(
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: RopsColors.ink,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(AppIcons.back),
              onPressed: () => context.canPop()
                  ? context.pop()
                  : context.go('/rops-camp'),
            ),
            title: const Text('Sponsor a camper'),
          ),
          body: _done
              ? _ThankYou(amount: _computedAmount, camp: camp)
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
                    children: [
                      Text(
                        'Carry someone to camp.',
                        style: AppFonts.fraunces(const TextStyle(
                          fontSize: 28,
                          height: 1.08,
                          fontWeight: FontWeight.w700,
                          color: RopsColors.cream,
                        )),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        camp == null
                            ? 'Pledge for as many youth as you wish, or give '
                                'an amount.'
                            : '${Money.format(camp.fee, camp.currency)} covers '
                                "one young person's passage — camp fee, meals, "
                                'and all. Pledge for as many youth as you wish, '
                                'or give an amount, and the camp team will '
                                'allocate it to campers who need it.',
                        style: AppFonts.manrope(const TextStyle(
                          fontSize: 14,
                          height: 1.6,
                          color: RopsColors.sand,
                        )),
                      ),
                      const SizedBox(height: 26),

                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color:
                                const Color(0xFFFF6B6B).withValues(alpha: 0.12),
                            borderRadius:
                                BorderRadius.circular(AppRadius.card),
                            border: Border.all(
                                color: const Color(0xFFFF6B6B)
                                    .withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            _error!,
                            style: AppFonts.manrope(const TextStyle(
                              fontSize: 13,
                              height: 1.5,
                              color: RopsColors.cream,
                            )),
                          ),
                        ),
                        const SizedBox(height: 18),
                      ],

                      _Label('What would you like to pledge?'),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _Choice(
                              label: 'A number of youth',
                              selected:
                                  _type == CampSponsorshipPledgeType.slots,
                              onTap: () => setState(
                                  () => _type = CampSponsorshipPledgeType.slots),
                            ),
                          ),
                          const SizedBox(width: 9),
                          Expanded(
                            child: _Choice(
                              label: 'An amount',
                              selected:
                                  _type == CampSponsorshipPledgeType.amount,
                              onTap: () => setState(() =>
                                  _type = CampSponsorshipPledgeType.amount),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      if (_type == CampSponsorshipPledgeType.slots)
                        _SlotStepper(
                          value: _slots,
                          onChanged: (v) => setState(() => _slots = v),
                        )
                      else
                        _SponsorField(
                          label: 'Amount (${camp?.currency ?? 'ZMW'})',
                          controller: _amount,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                        ),
                      const SizedBox(height: 14),

                      Container(
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: RopsColors.ember.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(AppRadius.card),
                          border: Border.all(
                              color: RopsColors.ember.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(AppIcons.handshake,
                                size: 18, color: RopsColors.ember),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _type == CampSponsorshipPledgeType.slots
                                    ? 'Your pledge: $_slots '
                                        '${_slots == 1 ? 'camper' : 'campers'} · '
                                        '${Money.format(_computedAmount, camp?.currency)}'
                                    : 'Your pledge: '
                                        '${Money.format(_computedAmount, camp?.currency)}',
                                style: AppFonts.manrope(const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: RopsColors.cream,
                                )),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 26),

                      _Label('About you'),
                      const SizedBox(height: 12),
                      _SponsorField(
                        label: 'Your name',
                        controller: _name,
                        required: true,
                        textCapitalization: TextCapitalization.words,
                      ),
                      _SponsorField(
                        label: 'Organisation',
                        controller: _organization,
                        hint: 'If you are pledging on behalf of one',
                        textCapitalization: TextCapitalization.words,
                      ),
                      _SponsorField(
                        label: 'Phone',
                        controller: _phone,
                        required: true,
                        keyboardType: TextInputType.phone,
                      ),
                      _SponsorField(
                        label: 'Email',
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) {
                          final value = v?.trim() ?? '';
                          if (value.isEmpty) return null;
                          return value.contains('@') && value.contains('.')
                              ? null
                              : 'Enter a valid email';
                        },
                      ),
                      _SponsorField(
                        label: 'Anything you would like us to know',
                        controller: _notes,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 20),

                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _busy ? null : _submit,
                          icon: _busy
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(AppIcons.handshake, size: 17),
                          label: const Text('Pledge sponsorship'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No payment is taken here. The camp team will call you '
                        'to arrange it.',
                        textAlign: TextAlign.center,
                        style: AppFonts.manrope(const TextStyle(
                          fontSize: 12,
                          height: 1.5,
                          color: RopsColors.sand,
                        )),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

class _ThankYou extends StatelessWidget {
  const _ThankYou({required this.amount, this.camp});

  final double amount;
  final CampDefinition? camp;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
      children: [
        Center(
          child: Container(
            height: 74,
            width: 74,
            decoration: const BoxDecoration(
              color: RopsColors.ember,
              shape: BoxShape.circle,
            ),
            child:
                const Icon(AppIcons.handshake, size: 32, color: Colors.white),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Thank you.',
          textAlign: TextAlign.center,
          style: AppFonts.fraunces(const TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: RopsColors.cream,
          )),
        ),
        const SizedBox(height: 12),
        Text(
          'Your pledge of ${Money.format(amount, camp?.currency)} is with the '
          'camp team. Someone will call you to arrange payment, and your '
          'sponsorship will be allocated to campers who need it.',
          textAlign: TextAlign.center,
          style: AppFonts.manrope(const TextStyle(
            fontSize: 14.5,
            height: 1.65,
            color: RopsColors.sand,
          )),
        ),
        const SizedBox(height: 30),
        OutlinedButton(
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/rops-camp'),
          child: const Text('Back to the camp page'),
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: AppFonts.manrope(const TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.6,
          color: RopsColors.sand,
        )),
      );
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        decoration: BoxDecoration(
          color: selected
              ? RopsColors.ember.withValues(alpha: 0.16)
              : RopsColors.inkSoft,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: selected ? RopsColors.ember : RopsColors.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: AppFonts.manrope(TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? RopsColors.cream : RopsColors.sand,
          )),
        ),
      ),
    );
  }
}

class _SlotStepper extends StatelessWidget {
  const _SlotStepper({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: RopsColors.inkSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: RopsColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Number of youth',
              style: AppFonts.manrope(const TextStyle(
                  fontSize: 14, color: RopsColors.cream)),
            ),
          ),
          _StepButton(
            icon: AppIcons.minus,
            onTap: value > 1 ? () => onChanged(value - 1) : null,
          ),
          SizedBox(
            width: 54,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: AppFonts.fraunces(const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: RopsColors.cream,
              )),
            ),
          ),
          _StepButton(
            icon: AppIcons.plus,
            onTap: value < 200 ? () => onChanged(value + 1) : null,
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Material(
      color: enabled ? RopsColors.ember : RopsColors.border,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(9),
          child: Icon(
            icon,
            size: 17,
            color: enabled ? Colors.white : RopsColors.sand,
          ),
        ),
      ),
    );
  }
}

class _SponsorField extends StatelessWidget {
  const _SponsorField({
    required this.label,
    required this.controller,
    this.hint,
    this.required = false,
    this.keyboardType,
    this.maxLines = 1,
    this.validator,
    this.onChanged,
    this.textCapitalization = TextCapitalization.sentences,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: RichText(
              text: TextSpan(
                text: label,
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: RopsColors.sand,
                )),
                children: required
                    ? [
                        const TextSpan(
                          text: ' *',
                          style: TextStyle(color: RopsColors.ember),
                        ),
                      ]
                    : null,
              ),
            ),
          ),
          TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            maxLines: maxLines,
            onChanged: onChanged,
            textCapitalization: textCapitalization,
            style: AppFonts.manrope(const TextStyle(
                fontSize: 14.5, color: RopsColors.cream)),
            decoration: InputDecoration(hintText: hint),
            validator: validator ??
                (required
                    ? (v) => (v == null || v.trim().isEmpty)
                        ? '$label is required'
                        : null
                    : null),
          ),
        ],
      ),
    );
  }
}
