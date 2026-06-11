import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/camp.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import 'payment_card.dart';

/// Camp registration form. Submits to the same public endpoint as the
/// website (POST /api/camp-registrations); because the API client carries
/// the session cookie, the registration is linked to this account and
/// appears under "My registrations" on both web and mobile.
class CampRegisterScreen extends StatefulWidget {
  const CampRegisterScreen({super.key, required this.camp});

  final CampInfo camp;

  @override
  State<CampRegisterScreen> createState() => _CampRegisterScreenState();
}

class _CampRegisterScreenState extends State<CampRegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  String _registrantType = 'self';
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  DateTime? _dateOfBirth;
  String? _gender;
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _churchOrSchool = TextEditingController();

  final _allergies = TextEditingController();
  final _medications = TextEditingController();
  final _medicalNotes = TextEditingController();
  final _dietary = TextEditingController();

  String? _tshirtSize;
  String? _dropoff;
  final _address = TextEditingController();
  final _notes = TextEditingController();

  final _parentName = TextEditingController();
  final _parentRelationship = TextEditingController();
  final _parentAltPhone = TextEditingController();
  final _parentEmail = TextEditingController();

  final _emergencyName = TextEditingController();
  final _emergencyPhone = TextEditingController();
  final _emergencyRelationship = TextEditingController();

  bool _consent = false;
  bool _submitting = false;
  CampRegistration? _submitted;

  @override
  void initState() {
    super.initState();
    _prefillSelf();
  }

  void _prefillSelf() {
    final profile = context.read<AuthService>().profile;
    if (profile == null) return;
    final parts = profile.name.trim().split(RegExp(r'\s+'));
    _firstName.text = parts.first;
    _lastName.text = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    _phone.text = profile.phone ?? '';
    _email.text = profile.email;
  }

  void _clearCamper() {
    _firstName.clear();
    _lastName.clear();
    _phone.clear();
    _email.clear();
  }

  @override
  void dispose() {
    for (final c in [
      _firstName, _lastName, _phone, _email, _churchOrSchool,
      _allergies, _medications, _medicalNotes, _dietary,
      _address, _notes,
      _parentName, _parentRelationship, _parentAltPhone, _parentEmail,
      _emergencyName, _emergencyPhone, _emergencyRelationship,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      showAppSnackBar(context, 'Please fill in the highlighted fields.',
          isError: true);
      return;
    }
    if (_dateOfBirth == null) {
      showAppSnackBar(context, "Please pick the camper's date of birth.",
          isError: true);
      return;
    }
    if (_gender == null) {
      showAppSnackBar(context, "Please select the camper's gender.",
          isError: true);
      return;
    }
    if (!_consent) {
      showAppSnackBar(context, 'Consent is required to register.',
          isError: true);
      return;
    }

    setState(() => _submitting = true);
    final api = context.read<ApiClient>();
    String? text(TextEditingController c) =>
        c.text.trim().isEmpty ? null : c.text.trim();

    try {
      final response = await api.postJson('/api/camp-registrations', {
        'campId': widget.camp.id,
        'registrantType': _registrantType,
        'firstName': _firstName.text.trim(),
        'lastName': _lastName.text.trim(),
        'dateOfBirth': DateFormat('yyyy-MM-dd').format(_dateOfBirth!),
        'gender': _gender,
        'phone': _phone.text.trim(),
        'email': ?text(_email),
        'churchOrSchool': ?text(_churchOrSchool),
        'emergencyContactName': _emergencyName.text.trim(),
        'emergencyContactPhone': _emergencyPhone.text.trim(),
        'emergencyContactRelationship': ?text(_emergencyRelationship),
        'medicalNotes': ?text(_medicalNotes),
        'allergies': ?text(_allergies),
        'medications': ?text(_medications),
        'tshirtSize': ?_tshirtSize,
        'dietaryPreference': ?text(_dietary),
        'parentName': ?text(_parentName),
        'parentRelationship': ?text(_parentRelationship),
        'parentAltPhone': ?text(_parentAltPhone),
        'parentEmail': ?text(_parentEmail),
        'address': ?text(_address),
        'dropoffLocation': ?_dropoff,
        'notes': ?text(_notes),
        'consentGiven': true,
      });
      final registration = response['registration'];
      if (mounted && registration is Map) {
        setState(() {
          _submitted = CampRegistration.fromJson(
              registration.cast<String, dynamic>());
        });
      }
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } catch (_) {
      if (mounted) {
        showAppSnackBar(
            context, 'Could not submit the registration. Please try again.',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final submitted = _submitted;
    if (submitted != null) {
      return _SuccessView(registration: submitted, camp: widget.camp);
    }

    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.camp.name)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              const SectionHeader('Who is registering?'),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'self', label: Text('Myself')),
                  ButtonSegment(value: 'other', label: Text('Someone else')),
                ],
                selected: {_registrantType},
                onSelectionChanged: (selection) => setState(() {
                  _registrantType = selection.first;
                  if (_registrantType == 'self') {
                    _prefillSelf();
                  } else {
                    _clearCamper();
                  }
                }),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Camper details'),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _firstName,
                      textCapitalization: TextCapitalization.words,
                      decoration:
                          const InputDecoration(labelText: 'First name *'),
                      validator: _required,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _lastName,
                      textCapitalization: TextCapitalization.words,
                      decoration:
                          const InputDecoration(labelText: 'Last name *'),
                      validator: _required,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _dateOfBirth ?? DateTime(now.year - 16),
                    firstDate: DateTime(now.year - 80),
                    lastDate: now,
                  );
                  if (picked != null) setState(() => _dateOfBirth = picked);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Date of birth *',
                    prefixIcon: Icon(Icons.cake_outlined),
                  ),
                  child: Text(
                    _dateOfBirth == null
                        ? 'Tap to pick'
                        : DateFormat('MMMM d, yyyy').format(_dateOfBirth!),
                    style: textTheme.bodyMedium?.copyWith(
                      color: _dateOfBirth == null
                          ? PWColors.clay300
                          : PWColors.clay800,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                emptySelectionAllowed: true,
                segments: const [
                  ButtonSegment(value: 'MALE', label: Text('Male')),
                  ButtonSegment(value: 'FEMALE', label: Text('Female')),
                ],
                selected: {?_gender},
                onSelectionChanged: (selection) => setState(
                    () => _gender = selection.isEmpty ? null : selection.first),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone *',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: _required,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email (optional)',
                  prefixIcon: Icon(Icons.mail_outline),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _churchOrSchool,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Church or school (optional)',
                  prefixIcon: Icon(Icons.school_outlined),
                ),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Health'),
              TextFormField(
                controller: _allergies,
                decoration:
                    const InputDecoration(labelText: 'Allergies (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _medications,
                decoration: const InputDecoration(
                    labelText: 'Medications (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _medicalNotes,
                maxLines: 2,
                decoration: const InputDecoration(
                    labelText: 'Medical notes (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dietary,
                decoration: const InputDecoration(
                    labelText: 'Dietary preference (optional)'),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Camp logistics'),
              DropdownButtonFormField<String>(
                initialValue: _tshirtSize,
                decoration: const InputDecoration(
                  labelText: 'T-shirt size (optional)',
                  prefixIcon: Icon(Icons.checkroom_outlined),
                ),
                items: [
                  const DropdownMenuItem<String>(
                      value: null, child: Text('Not sure')),
                  ...campTShirtSizes.map(
                      (s) => DropdownMenuItem(value: s, child: Text(s))),
                ],
                onChanged: (v) => setState(() => _tshirtSize = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _dropoff,
                decoration: const InputDecoration(
                  labelText: 'Drop-off point (optional)',
                  prefixIcon: Icon(Icons.directions_bus_outlined),
                ),
                items: const [
                  DropdownMenuItem<String>(
                      value: null, child: Text('Decide later')),
                  DropdownMenuItem(value: 'CHURCH', child: Text('Church')),
                  DropdownMenuItem(
                      value: 'CAMPSITE', child: Text('Campsite')),
                ],
                onChanged: (v) => setState(() => _dropoff = v),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _address,
                decoration: const InputDecoration(
                    labelText: 'Home address (optional)'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notes,
                maxLines: 2,
                decoration: const InputDecoration(
                    labelText: 'Anything else we should know? (optional)'),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Parent / guardian (for minors)'),
              TextFormField(
                controller: _parentName,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                    labelText: 'Parent/guardian name (optional)'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _parentRelationship,
                      decoration: const InputDecoration(
                          labelText: 'Relationship (optional)'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _parentAltPhone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                          labelText: 'Phone (optional)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _parentEmail,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                    labelText: 'Parent email (optional)'),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Emergency contact'),
              TextFormField(
                controller: _emergencyName,
                textCapitalization: TextCapitalization.words,
                decoration:
                    const InputDecoration(labelText: 'Contact name *'),
                validator: _required,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _emergencyPhone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                          labelText: 'Contact phone *'),
                      validator: _required,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _emergencyRelationship,
                      decoration: const InputDecoration(
                          labelText: 'Relationship (optional)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: PWColors.gold,
                value: _consent,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: Text(
                  'I consent to the camper attending '
                  '${widget.camp.name} and confirm the details above are '
                  'accurate. *',
                  style: textTheme.bodySmall?.copyWith(height: 1.4),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: PWColors.cream),
                      )
                    : Text(
                        'Submit registration · ${widget.camp.currency} ${widget.camp.fee.toStringAsFixed(0)}'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String? _required(String? v) =>
      (v == null || v.trim().isEmpty) ? 'Required' : null;
}

class _SuccessView extends StatelessWidget {
  const _SuccessView({required this.registration, required this.camp});

  final CampRegistration registration;
  final CampInfo camp;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Registered'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            const Icon(Icons.check_circle_outline,
                size: 64, color: PWColors.teal),
            const SizedBox(height: 12),
            Text(
              '${registration.fullName} is registered!',
              textAlign: TextAlign.center,
              style: textTheme.headlineSmall,
            ),
            const SizedBox(height: 6),
            Text(
              'Spot reserved for ${camp.name}. Complete payment below to '
              'secure it.',
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(color: PWColors.clay500),
            ),
            const SizedBox(height: 20),
            CampPaymentCard(
              registrationId: registration.id,
              camperName: registration.firstName,
              amount: camp.fee,
              currency: camp.currency,
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}
