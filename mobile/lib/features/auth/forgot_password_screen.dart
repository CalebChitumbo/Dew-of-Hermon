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
import '../../core/widgets/lux.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await ref.read(authServiceProvider).sendPasswordReset(_email.text);
      if (mounted) {
        setState(() {
          _sent = true;
          _loading = false;
        });
      }
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
    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(AppIcons.back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/login'),
        ),
        title: const Text('Reset password'),
      ),
      body: SafeArea(
        top: false,
        child: _sent
            ? EmptyStateLux(
                icon: AppIcons.mail,
                tone: IconTone.emerald,
                title: 'Check your email',
                description:
                    'If an account exists for ${_email.text.trim()}, a reset '
                    'link is on its way. It expires in an hour.',
                action: PrimaryButton(
                  label: 'Back to sign in',
                  expand: false,
                  onPressed: () => context.canPop()
                      ? context.pop()
                      : context.go('/login'),
                ),
                note: 'No email after a few minutes? Check your spam folder, '
                    'or ask the Chairperson to confirm the address on your '
                    'profile.',
              )
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 36),
                  children: [
                    Text(
                      'Forgot your password?',
                      style: AppFonts.display(const TextStyle(
                          fontSize: 24, color: AppColors.clay700)),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Enter the email on your account and we will send you a '
                      'link to set a new password.',
                      style: TextStyle(
                          fontSize: 14,
                          height: 1.55,
                          color: AppColors.clay500),
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
                      label: 'Email',
                      controller: _email,
                      hint: 'you@example.com',
                      required: true,
                      prefixIcon: AppIcons.mail,
                      keyboardType: TextInputType.emailAddress,
                      textCapitalization: TextCapitalization.none,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      validator: (v) {
                        final value = v?.trim() ?? '';
                        if (value.isEmpty) return 'Email is required';
                        if (!value.contains('@')) {
                          return 'That email address does not look right';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 22),
                    PrimaryButton(
                      label: 'Send reset link',
                      loading: _loading,
                      onPressed: _submit,
                      icon: AppIcons.send,
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
