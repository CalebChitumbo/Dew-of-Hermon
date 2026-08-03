import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/auth/auth_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_icons.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/icon_tones.dart';
import '../../core/widgets/common.dart';
import '../../data/models/enums.dart';
import '../../data/repositories/member_repository.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  LifeGroup? _lifeGroup;
  bool _isStudent = false;
  String? _institutionId;
  bool _showPassword = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_isStudent && (_institutionId == null || _institutionId!.isEmpty)) {
      setState(() => _error = 'Choose the institution you attend.');
      return;
    }

    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await ref.read(authServiceProvider).signUp(
            email: _email.text,
            password: _password.text,
            name: _name.text.trim(),
            lifeGroup: _lifeGroup?.wire,
            isStudent: _isStudent,
            institutionId: _isStudent ? _institutionId : null,
          );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = AuthService.describeError(e);
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final institutions = ref.watch(activeInstitutionsProvider);

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(AppIcons.back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/login'),
        ),
        title: const Text('Create account'),
      ),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
            children: [
              Text(
                'Join the ministry',
                style: AppFonts.display(
                    const TextStyle(fontSize: 24, color: AppColors.clay700)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Your account gives you your schedule, the Bible reader and '
                'everything your role reaches.',
                style: TextStyle(
                    fontSize: 13.5, height: 1.5, color: AppColors.clay400),
              ),
              const SizedBox(height: 24),
              if (_error != null) ...[
                NoticeCard(
                  message: _error!,
                  tone: IconTone.rose,
                  icon: AppIcons.alert,
                ),
                const SizedBox(height: 16),
              ],
              AppTextField(
                label: 'Full name',
                controller: _name,
                required: true,
                prefixIcon: AppIcons.user,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.name],
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Email',
                controller: _email,
                hint: 'you@example.com',
                required: true,
                prefixIcon: AppIcons.mail,
                keyboardType: TextInputType.emailAddress,
                textCapitalization: TextCapitalization.none,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                validator: (v) {
                  final value = v?.trim() ?? '';
                  if (value.isEmpty) return 'Email is required';
                  if (!value.contains('@')) {
                    return 'That email address does not look right';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Password',
                controller: _password,
                required: true,
                obscureText: !_showPassword,
                prefixIcon: AppIcons.lock,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.next,
                suffix: IconButton(
                  icon: Icon(_showPassword ? AppIcons.eyeOff : AppIcons.eye,
                      size: 18, color: AppColors.clay400),
                  onPressed: () =>
                      setState(() => _showPassword = !_showPassword),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Password is required';
                  if (v.length < 6) {
                    return 'Choose at least 6 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              AppTextField(
                label: 'Confirm password',
                controller: _confirm,
                required: true,
                obscureText: !_showPassword,
                prefixIcon: AppIcons.lock,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _submit(),
                validator: (v) =>
                    v == _password.text ? null : 'Passwords do not match',
              ),
              const SizedBox(height: 16),
              AppDropdown<LifeGroup>(
                label: 'Life Group',
                hint: 'Not sure yet',
                value: _lifeGroup,
                items: [
                  const DropdownMenuItem(value: null, child: Text('Not sure yet')),
                  for (final g in LifeGroup.values)
                    DropdownMenuItem(value: g, child: Text(g.label)),
                ],
                onChanged: (v) => setState(() => _lifeGroup = v),
              ),
              const SizedBox(height: 18),
              _StudentToggle(
                value: _isStudent,
                onChanged: (v) => setState(() {
                  _isStudent = v;
                  if (!v) _institutionId = null;
                }),
              ),
              if (_isStudent) ...[
                const SizedBox(height: 16),
                AppDropdown<String>(
                  label: 'Institution',
                  hint: institutions.isEmpty
                      ? 'Loading institutions…'
                      : 'Choose your school or college',
                  required: true,
                  value: _institutionId,
                  items: [
                    for (final i in institutions)
                      DropdownMenuItem(value: i.id, child: Text(i.name)),
                  ],
                  onChanged: (v) => setState(() => _institutionId = v),
                ),
              ],
              const SizedBox(height: 26),
              PrimaryButton(
                label: 'Create account',
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 18),
              Center(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    const Text('Already have an account? ',
                        style: TextStyle(
                            fontSize: 14, color: AppColors.clay500)),
                    GestureDetector(
                      onTap: () => context.canPop()
                          ? context.pop()
                          : context.go('/login'),
                      child: const Text(
                        'Sign in',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.goldDark,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StudentToggle extends StatelessWidget {
  const _StudentToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            const IconChipSmall(),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    "I'm a student",
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.clay700,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'So Campus Ministry knows where to find you',
                    style:
                        TextStyle(fontSize: 12, color: AppColors.clay400),
                  ),
                ],
              ),
            ),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}

class IconChipSmall extends StatelessWidget {
  const IconChipSmall({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = toneColors(IconTone.periwinkle);
    return Container(
      height: 38,
      width: 38,
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Icon(AppIcons.graduation, size: 17, color: colors.foreground),
    );
  }
}
