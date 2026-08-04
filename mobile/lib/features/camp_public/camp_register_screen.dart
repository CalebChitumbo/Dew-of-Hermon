import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/camp/camp_meals.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/camp_theme.dart';
import '../../core/utils/dates.dart';
import '../../core/utils/money.dart';
import '../../core/widgets/common.dart';
import '../../data/models/camp.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/camp_repository.dart';
import 'camp_landing_screen.dart';

/// Who is filling the form in.
enum _RegistrantType { self, other }

/// Public camp registration.
///
/// Anonymous submission is deliberate: a parent registering a camper usually
/// has no account, and making them create one first is how registrations get
/// lost. The form is grouped into four short steps so a phone keyboard never
/// hides the field being typed into.
class CampRegisterScreen extends ConsumerStatefulWidget {
  const CampRegisterScreen({super.key});

  @override
  ConsumerState<CampRegisterScreen> createState() => _CampRegisterScreenState();
}

class _CampRegisterScreenState extends ConsumerState<CampRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scroll = ScrollController();

  _RegistrantType _who = _RegistrantType.other;

  final _camperName = TextEditingController();
  final _churchOrSchool = TextEditingController();
  final _parentName = TextEditingController();
  final _parentRelationship = TextEditingController();
  final _parentPhone = TextEditingController();
  final _parentAltPhone = TextEditingController();
  final _parentEmail = TextEditingController();
  final _address = TextEditingController();
  final _emergencyName = TextEditingController();
  final _emergencyRelationship = TextEditingController();
  final _emergencyPhone = TextEditingController();
  final _allergies = TextEditingController();
  final _medicalConditions = TextEditingController();
  final _medications = TextEditingController();
  final _dietary = TextEditingController();
  final _notes = TextEditingController();

  DateTime? _dob;
  CampGender? _gender;
  CampTShirtSize _tshirt = CampTShirtSize.m;
  CampDropoffLocation? _dropoff;
  bool _consent = false;

  bool _submitting = false;
  String? _error;
  _Submitted? _submitted;

  bool get _isSelf => _who == _RegistrantType.self;

  @override
  void dispose() {
    _scroll.dispose();
    for (final c in [
      _camperName,
      _churchOrSchool,
      _parentName,
      _parentRelationship,
      _parentPhone,
      _parentAltPhone,
      _parentEmail,
      _address,
      _emergencyName,
      _emergencyRelationship,
      _emergencyPhone,
      _allergies,
      _medicalConditions,
      _medications,
      _dietary,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 16),
      firstDate: DateTime(now.year - 40),
      lastDate: DateTime(now.year - 5),
      helpText: 'Date of birth',
    );
    if (picked != null) setState(() => _dob = picked);
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    if (!(_formKey.currentState?.validate() ?? false)) {
      unawaited(_scroll.animateTo(0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut));
      return;
    }
    if (_dob == null) {
      setState(() => _error = 'Date of birth is required.');
      return;
    }
    if (_gender == null) {
      setState(() => _error = 'Please choose a gender.');
      return;
    }
    if (_dropoff == null) {
      setState(() => _error = "Choose how you'll get to camp.");
      return;
    }
    if (!_consent) {
      setState(() => _error = _isSelf
          ? 'Your consent is required.'
          : 'Parent or guardian consent is required.');
      return;
    }

    // The web sends first and last name separately; a single field is far
    // easier on a phone, so split it the same way the web's form does.
    final parts = _camperName.text.trim().split(RegExp(r'\s+'));
    final firstName = parts.isEmpty ? _camperName.text.trim() : parts.first;
    final lastName =
        parts.length > 1 ? parts.sublist(1).join(' ') : firstName;

    final medicalSummary = [
      if (_allergies.text.trim().isNotEmpty)
        'Allergies: ${_allergies.text.trim()}',
      if (_medicalConditions.text.trim().isNotEmpty)
        'Medical conditions: ${_medicalConditions.text.trim()}',
      if (_medications.text.trim().isNotEmpty)
        'Medications: ${_medications.text.trim()}',
    ].join('\n');

    setState(() => _submitting = true);
    try {
      final result = await ref.read(campRepositoryProvider).register({
        'campId': kDefaultCampId,
        'registrantType': _isSelf ? 'self' : 'other',
        'firstName': firstName,
        'lastName': lastName,
        'dateOfBirth': D.iso(_dob!),
        'gender': _gender!.wire,
        'phone': _parentPhone.text.trim(),
        if (_parentEmail.text.trim().isNotEmpty)
          'email': _parentEmail.text.trim(),
        'churchOrSchool': _churchOrSchool.text.trim(),
        'emergencyContactName': _emergencyName.text.trim(),
        'emergencyContactPhone': _emergencyPhone.text.trim(),
        if (_emergencyRelationship.text.trim().isNotEmpty)
          'emergencyContactRelationship': _emergencyRelationship.text.trim(),
        if (medicalSummary.isNotEmpty) 'medicalNotes': medicalSummary,
        if (_allergies.text.trim().isNotEmpty)
          'allergies': _allergies.text.trim(),
        if (_medications.text.trim().isNotEmpty)
          'medications': _medications.text.trim(),
        'tshirtSize': _tshirt.wire,
        if (_dietary.text.trim().isNotEmpty)
          'dietaryPreference': _dietary.text.trim(),
        'parentName': _parentName.text.trim(),
        if (_parentRelationship.text.trim().isNotEmpty)
          'parentRelationship': _parentRelationship.text.trim(),
        if (_parentAltPhone.text.trim().isNotEmpty)
          'parentAltPhone': _parentAltPhone.text.trim(),
        if (_parentEmail.text.trim().isNotEmpty)
          'parentEmail': _parentEmail.text.trim(),
        if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
        'dropoffLocation': _dropoff!.wire,
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        'consentGiven': true,
      });

      final registration = result['registration'];
      final id = registration is Map ? '${registration['id'] ?? ''}' : '';
      final code =
          registration is Map ? registration['checkInCode']?.toString() : null;
      final email = result['confirmationEmail'];
      final queuedTo = email is Map && email['queued'] == true
          ? email['to']?.toString()
          : null;

      if (!mounted) return;
      ref.invalidate(publicCapacityProvider);
      setState(() {
        _submitting = false;
        _submitted = _Submitted(
          id: id,
          camperName: _camperName.text.trim(),
          checkInCode: code,
          emailedTo: queuedTo,
        );
      });
      _scroll.jumpTo(0);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
      unawaited(_scroll.animateTo(0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut));
    }
  }

  @override
  Widget build(BuildContext context) {
    final camp = getCamp(kDefaultCampId);
    final capacity = ref.watch(publicCapacityProvider).valueOrNull;

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
            title: Text(_submitted == null ? 'Register' : 'Registered'),
          ),
          body: _submitted != null
              ? _SuccessView(submitted: _submitted!)
              : Form(
                  key: _formKey,
                  child: ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                    children: [
                      if (camp != null)
                        _CampSummary(camp: camp, capacity: capacity),
                      const SizedBox(height: 20),

                      if (_error != null) ...[
                        _DarkNotice(message: _error!, isError: true),
                        const SizedBox(height: 16),
                      ],

                      _WhoToggle(
                        value: _who,
                        onChanged: (v) => setState(() => _who = v),
                      ),
                      const SizedBox(height: 24),

                      _Section(
                        number: '1',
                        title: _isSelf ? 'About you' : 'About the camper',
                      ),
                      _DarkField(
                        label: _isSelf ? 'Your full name' : 'Camper full name',
                        controller: _camperName,
                        required: true,
                        textCapitalization: TextCapitalization.words,
                      ),
                      _DarkDateField(
                        label: 'Date of birth',
                        value: _dob,
                        onTap: _pickDob,
                      ),
                      _DarkChoice<CampGender>(
                        label: 'Gender',
                        value: _gender,
                        options: {
                          for (final g in CampGender.values) g: g.label,
                        },
                        onChanged: (v) => setState(() => _gender = v),
                      ),
                      _DarkField(
                        label: 'Church or school',
                        controller: _churchOrSchool,
                        required: true,
                        textCapitalization: TextCapitalization.words,
                      ),
                      _DarkChoice<CampTShirtSize>(
                        label: 'T-shirt size',
                        value: _tshirt,
                        options: {
                          for (final s in CampTShirtSize.values) s: s.label,
                        },
                        onChanged: (v) =>
                            setState(() => _tshirt = v ?? CampTShirtSize.m),
                      ),
                      const SizedBox(height: 26),

                      _Section(
                        number: '2',
                        title: _isSelf
                            ? 'Your contact details'
                            : 'Parent or guardian',
                      ),
                      _DarkField(
                        label: _isSelf ? 'Your name' : 'Parent/guardian name',
                        controller: _parentName,
                        required: true,
                        textCapitalization: TextCapitalization.words,
                      ),
                      if (!_isSelf)
                        _DarkField(
                          label: 'Relationship to camper',
                          controller: _parentRelationship,
                          hint: 'Mother, father, guardian…',
                        ),
                      _DarkField(
                        label: 'Primary phone',
                        controller: _parentPhone,
                        required: true,
                        keyboardType: TextInputType.phone,
                        hint: '097X XXX XXX',
                      ),
                      _DarkField(
                        label: 'Alternative phone',
                        controller: _parentAltPhone,
                        keyboardType: TextInputType.phone,
                      ),
                      _DarkField(
                        label: 'Email',
                        controller: _parentEmail,
                        keyboardType: TextInputType.emailAddress,
                        hint: 'Where the camp badge is sent',
                        validator: (v) {
                          final value = v?.trim() ?? '';
                          if (value.isEmpty) return null;
                          return value.contains('@') && value.contains('.')
                              ? null
                              : 'Enter a valid email';
                        },
                      ),
                      _DarkField(
                        label: 'Home address',
                        controller: _address,
                        maxLines: 2,
                      ),
                      const SizedBox(height: 26),

                      const _Section(number: '3', title: 'Emergency contact'),
                      _DarkField(
                        label: 'Name',
                        controller: _emergencyName,
                        required: true,
                        textCapitalization: TextCapitalization.words,
                      ),
                      _DarkField(
                        label: 'Phone',
                        controller: _emergencyPhone,
                        required: true,
                        keyboardType: TextInputType.phone,
                      ),
                      _DarkField(
                        label: 'Relationship',
                        controller: _emergencyRelationship,
                      ),
                      const SizedBox(height: 26),

                      const _Section(
                          number: '4', title: 'Health and getting there'),
                      _DarkField(
                        label: 'Allergies',
                        controller: _allergies,
                        hint: 'Food, medication, anything else',
                        maxLines: 2,
                      ),
                      _DarkField(
                        label: 'Medical conditions',
                        controller: _medicalConditions,
                        maxLines: 2,
                      ),
                      _DarkField(
                        label: 'Medications',
                        controller: _medications,
                        hint: 'What they take and when',
                        maxLines: 2,
                      ),
                      _DarkField(
                        label: 'Dietary requirement',
                        controller: _dietary,
                        hint: 'Vegetarian, no pork…',
                      ),
                      _DarkChoice<CampDropoffLocation>(
                        label: 'Getting to camp',
                        value: _dropoff,
                        options: {
                          CampDropoffLocation.church:
                              'Bus from the church',
                          CampDropoffLocation.campsite:
                              'Own transport to the campsite',
                        },
                        onChanged: (v) => setState(() => _dropoff = v),
                      ),
                      _DarkField(
                        label: 'Anything else we should know',
                        controller: _notes,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 22),

                      _ConsentBox(
                        isSelf: _isSelf,
                        value: _consent,
                        onChanged: (v) => setState(() => _consent = v),
                      ),
                      const SizedBox(height: 22),

                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2.2, color: Colors.white),
                                )
                              : const Text('Submit registration'),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'No account needed. After you submit we email the camp '
                        'badge and payment details to the address above.',
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

class _Submitted {
  const _Submitted({
    required this.id,
    required this.camperName,
    this.checkInCode,
    this.emailedTo,
  });

  final String id;
  final String camperName;
  final String? checkInCode;
  final String? emailedTo;
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.submitted});

  final _Submitted submitted;

  @override
  Widget build(BuildContext context) {
    final camp = getCamp(kDefaultCampId);
    final firstName = submitted.camperName.split(RegExp(r'\s+')).first;
    final reference = buildCampPaymentReference(submitted.id);
    final code = submitted.checkInCode;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      children: [
        Center(
          child: Container(
            height: 74,
            width: 74,
            decoration: const BoxDecoration(
              color: RopsColors.ember,
              shape: BoxShape.circle,
            ),
            child: const Icon(AppIcons.check, size: 34, color: Colors.white),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          "You're in, $firstName!",
          textAlign: TextAlign.center,
          style: AppFonts.fraunces(const TextStyle(
            fontSize: 30,
            height: 1.08,
            fontWeight: FontWeight.w700,
            color: RopsColors.cream,
          )),
        ),
        const SizedBox(height: 10),
        Text(
          submitted.emailedTo == null
              ? 'Your place is held. Keep the reference below for payment.'
              : 'Your place is held and the details are on their way to '
                  '${submitted.emailedTo}.',
          textAlign: TextAlign.center,
          style: AppFonts.manrope(const TextStyle(
            fontSize: 14,
            height: 1.55,
            color: RopsColors.sand,
          )),
        ),
        const SizedBox(height: 28),

        if (code != null && code.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: RopsColors.cream,
              borderRadius: BorderRadius.circular(AppRadius.lux),
            ),
            child: Column(
              children: [
                QrImageView(
                  data: '${AppConfig.webBaseUrl}/rops-camp/track?code=$code',
                  size: 180,
                  backgroundColor: RopsColors.cream,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: RopsColors.ink,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: RopsColors.ink,
                  ),
                ),
                const SizedBox(height: 14),
                SelectableText(
                  formatMealCode(code),
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2.4,
                    color: RopsColors.ink,
                  )),
                ),
                const SizedBox(height: 6),
                Text(
                  'Your camp badge — arrival, meals and the gate. '
                  'Screenshot it.',
                  textAlign: TextAlign.center,
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF6B5545),
                  )),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
        ],

        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: RopsColors.inkSoft,
            borderRadius: BorderRadius.circular(AppRadius.lux),
            border: Border.all(color: RopsColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PAYING THE CAMP FEE',
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.7,
                  color: RopsColors.ember,
                )),
              ),
              const SizedBox(height: 14),
              _PayRow(
                label: 'Amount',
                value: camp == null
                    ? '—'
                    : Money.format(camp.fee, camp.currency),
              ),
              _PayRow(label: 'Mobile money', value: kCampPaymentNumber),
              _PayRow(label: 'Reference', value: reference, selectable: true),
              const SizedBox(height: 12),
              Text(
                'Send the fee to the number above using that reference, then '
                'send proof of payment to the camp team. Your place is held '
                'either way — the reference is just how we match the payment '
                'to $firstName.',
                style: AppFonts.manrope(const TextStyle(
                  fontSize: 12.5,
                  height: 1.6,
                  color: RopsColors.sand,
                )),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        OutlinedButton.icon(
          onPressed: () => context.go('/rops-camp/track'),
          icon: const Icon(AppIcons.search, size: 16),
          label: const Text('Track this registration'),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/rops-camp'),
          child: const Text('Back to the camp page'),
        ),
      ],
    );
  }
}

class _PayRow extends StatelessWidget {
  const _PayRow({
    required this.label,
    required this.value,
    this.selectable = false,
  });

  final String label;
  final String value;
  final bool selectable;

  @override
  Widget build(BuildContext context) {
    final style = AppFonts.manrope(const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: RopsColors.cream,
    ));
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppFonts.manrope(const TextStyle(
                  fontSize: 12.5, color: RopsColors.sand)),
            ),
          ),
          Expanded(
            child: selectable
                ? SelectableText(value, style: style)
                : Text(value, style: style),
          ),
        ],
      ),
    );
  }
}

class _CampSummary extends StatelessWidget {
  const _CampSummary({required this.camp, this.capacity});

  final CampDefinition camp;
  final CampCapacity? capacity;

  @override
  Widget build(BuildContext context) {
    final left = capacity?.spotsLeft;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: RopsColors.inkSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: RopsColors.border),
      ),
      child: Row(
        children: [
          const Icon(AppIcons.tent, size: 20, color: RopsColors.ember),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  camp.name,
                  style: AppFonts.manrope(const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: RopsColors.cream,
                  )),
                ),
                const SizedBox(height: 2),
                Text(
                  '${D.range(camp.start, camp.end)} · '
                  '${Money.format(camp.fee, camp.currency)}'
                  '${left == null ? '' : ' · $left places left'}',
                  style: AppFonts.manrope(
                      const TextStyle(fontSize: 12, color: RopsColors.sand)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WhoToggle extends StatelessWidget {
  const _WhoToggle({required this.value, required this.onChanged});

  final _RegistrantType value;
  final ValueChanged<_RegistrantType> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'WHO IS REGISTERING?',
          style: AppFonts.manrope(const TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.6,
            color: RopsColors.sand,
          )),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ToggleButton(
                label: 'I am registering myself',
                selected: value == _RegistrantType.self,
                onTap: () => onChanged(_RegistrantType.self),
              ),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: _ToggleButton(
                label: 'I am registering someone else',
                selected: value == _RegistrantType.other,
                onTap: () => onChanged(_RegistrantType.other),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
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
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
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
          style: AppFonts.manrope(TextStyle(
            fontSize: 12.5,
            height: 1.35,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? RopsColors.cream : RopsColors.sand,
          )),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.number, required this.title});

  final String number;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Container(
            height: 26,
            width: 26,
            decoration: BoxDecoration(
              color: RopsColors.ember,
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Text(
              number,
              style: AppFonts.manrope(const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              )),
            ),
          ),
          const SizedBox(width: 11),
          Text(
            title,
            style: AppFonts.fraunces(const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              color: RopsColors.cream,
            )),
          ),
        ],
      ),
    );
  }
}

class _DarkField extends StatelessWidget {
  const _DarkField({
    required this.label,
    required this.controller,
    this.hint,
    this.required = false,
    this.keyboardType,
    this.maxLines = 1,
    this.validator,
    this.textCapitalization = TextCapitalization.sentences,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? Function(String?)? validator;
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

class _DarkDateField extends StatelessWidget {
  const _DarkDateField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onTap;

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
                children: const [
                  TextSpan(
                    text: ' *',
                    style: TextStyle(color: RopsColors.ember),
                  ),
                ],
              ),
            ),
          ),
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadius.base),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: RopsColors.inkSoft,
                borderRadius: BorderRadius.circular(AppRadius.base),
                border: Border.all(color: RopsColors.border),
              ),
              child: Row(
                children: [
                  const Icon(AppIcons.calendar,
                      size: 16, color: RopsColors.sand),
                  const SizedBox(width: 11),
                  Text(
                    value == null ? 'Choose a date' : D.medium(value),
                    style: AppFonts.manrope(TextStyle(
                      fontSize: 14.5,
                      color: value == null
                          ? RopsColors.sand.withValues(alpha: 0.75)
                          : RopsColors.cream,
                    )),
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

class _DarkChoice<T> extends StatelessWidget {
  const _DarkChoice({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final T? value;
  final Map<T, String> options;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              label,
              style: AppFonts.manrope(const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: RopsColors.sand,
              )),
            ),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in options.entries)
                _ToggleChip(
                  label: entry.value,
                  selected: value == entry.key,
                  onTap: () => onChanged(entry.key),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  const _ToggleChip({
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
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? RopsColors.ember.withValues(alpha: 0.18)
              : RopsColors.inkSoft,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? RopsColors.ember : RopsColors.border,
            width: selected ? 1.4 : 1,
          ),
        ),
        child: Text(
          label,
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

class _ConsentBox extends StatelessWidget {
  const _ConsentBox({
    required this.isSelf,
    required this.value,
    required this.onChanged,
  });

  final bool isSelf;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: value
              ? RopsColors.ember.withValues(alpha: 0.1)
              : RopsColors.inkSoft,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: value ? RopsColors.ember : RopsColors.border,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: value,
              onChanged: (v) => onChanged(v ?? false),
              fillColor: WidgetStateProperty.resolveWith(
                (s) => s.contains(WidgetState.selected)
                    ? RopsColors.ember
                    : Colors.transparent,
              ),
              side: const BorderSide(color: RopsColors.sand, width: 1.4),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                isSelf
                    ? 'I consent to attending ROPs Camp and to the camp team '
                        'holding the details above for the duration of camp.'
                    : 'As parent or guardian, I consent to this camper '
                        'attending ROPs Camp and to the camp team holding the '
                        'details above for the duration of camp.',
                style: AppFonts.manrope(TextStyle(
                  fontSize: 12.5,
                  height: 1.55,
                  color: value ? RopsColors.cream : RopsColors.sand,
                )),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A notice styled for the dark camp theme — [NoticeCard] assumes the light
/// Clay & Gold surfaces.
class _DarkNotice extends StatelessWidget {
  const _DarkNotice({required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final accent = isError ? const Color(0xFFFF6B6B) : RopsColors.ember;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: accent.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(isError ? AppIcons.alert : AppIcons.info,
              size: 17, color: accent),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              message,
              style: AppFonts.manrope(TextStyle(
                fontSize: 13,
                height: 1.5,
                color: RopsColors.cream.withValues(alpha: 0.92),
              )),
            ),
          ),
        ],
      ),
    );
  }
}
