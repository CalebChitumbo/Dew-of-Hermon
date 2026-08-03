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

/// Sign in. Keeps the web's brand hero — the dark clay wash, the Cinzel
/// wordmark and Psalm 133:3 — above the form, then the two "Open Now" cards
/// that let someone order or register without an account.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _showPassword = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await action();
      // The router redirect takes over the moment auth state lands.
    } on AuthCancelled {
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = AuthService.describeError(e);
          _loading = false;
        });
      }
    }
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    _run(() => ref
        .read(authServiceProvider)
        .signIn(_email.text, _password.text));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const _BrandHero(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 26, 20, 32),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back',
                      style: AppFonts.display(const TextStyle(
                        fontSize: 26,
                        color: AppColors.clay700,
                      )),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Sign in to continue',
                      style:
                          TextStyle(fontSize: 14, color: AppColors.clay400),
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
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      suffix: IconButton(
                        icon: Icon(
                          _showPassword ? AppIcons.eyeOff : AppIcons.eye,
                          size: 18,
                          color: AppColors.clay400,
                        ),
                        onPressed: () =>
                            setState(() => _showPassword = !_showPassword),
                        tooltip: _showPassword
                            ? 'Hide password'
                            : 'Show password',
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => context.push('/forgot-password'),
                        child: const Text('Forgot password?'),
                      ),
                    ),
                    const SizedBox(height: 6),
                    PrimaryButton(
                      label: 'Sign in',
                      loading: _loading,
                      onPressed: _submit,
                      icon: AppIcons.login,
                    ),
                    const SizedBox(height: 18),
                    const _OrDivider(),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _loading
                            ? null
                            : () => _run(() => ref
                                .read(authServiceProvider)
                                .signInWithGoogle()),
                        icon: const Icon(AppIcons.google, size: 18),
                        label: const Text('Continue with Google'),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Center(
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text(
                            'New here? ',
                            style: TextStyle(
                                fontSize: 14, color: AppColors.clay500),
                          ),
                          GestureDetector(
                            onTap: () => context.push('/register'),
                            child: const Text(
                              'Create an account',
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
                    const SizedBox(height: 30),
                    const _OpenNowStrip(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The dark brand panel — a phone-height version of the web's hero column.
class _BrandHero extends StatelessWidget {
  const _BrandHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 30),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A0D05), AppColors.clay900, Color(0xFF2A1810)],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Image.asset(
                'assets/images/church-logo.png',
                height: 40,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
              const SizedBox(width: 11),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'TABERNACLE OF DAVID',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.2,
                      color: AppColors.cream.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'CITY MISSION CHURCH',
                    style: TextStyle(
                      fontSize: 9,
                      letterSpacing: 1.9,
                      color: AppColors.cream.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 30),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.cream.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(999),
              border:
                  Border.all(color: AppColors.cream.withValues(alpha: 0.15)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  height: 6,
                  width: 6,
                  decoration: const BoxDecoration(
                    color: AppColors.goldLight,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  'A COMMUNITY IN WORSHIP',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2.1,
                    color: AppColors.goldLight,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Dew of',
            style: AppFonts.cinzel(const TextStyle(
              fontSize: 40,
              height: 0.98,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
              color: AppColors.cream,
            )),
          ),
          ShaderMask(
            shaderCallback: (bounds) => const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.goldLight,
                AppColors.gold,
                AppColors.goldDark,
              ],
            ).createShader(bounds),
            child: Text(
              'Hermon',
              style: AppFonts.cinzel(const TextStyle(
                fontSize: 40,
                height: 1.02,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
                color: Colors.white,
              )),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            '"As the dew of Hermon, that descended upon the mountains of '
            'Zion: for there the Lord commanded the blessing, even life '
            'forevermore."',
            style: TextStyle(
              fontSize: 13.5,
              height: 1.6,
              fontStyle: FontStyle.italic,
              color: AppColors.cream.withValues(alpha: 0.75),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '— PSALM 133:3',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 2.2,
              color: AppColors.goldLight.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

/// The two no-sign-in-needed entry points.
class _OpenNowStrip extends StatelessWidget {
  const _OpenNowStrip();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              height: 7,
              width: 7,
              decoration: const BoxDecoration(
                color: Color(0xFF34D399),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'OPEN NOW',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.1,
                color: AppColors.clay500,
              ),
            ),
            const Spacer(),
            const Text(
              'NO SIGN-IN NEEDED',
              style: TextStyle(
                fontSize: 9.5,
                letterSpacing: 1.8,
                color: AppColors.clay300,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _FeatureCard(
          image: 'assets/images/login-features/potters-shockers.jpg',
          eyebrow: "POTTER'S SHOCKERS",
          eyebrowColor: const Color(0xFFB85A1E),
          title: 'Sunday Braai pre-orders',
          subtitle: "Order ahead for this Sunday's fundraiser",
          onTap: () => context.push('/fundraising/order'),
        ),
        const SizedBox(height: 11),
        _FeatureCard(
          image: 'assets/images/login-features/rops-camp.jpg',
          eyebrow: 'ROPS X · 2026',
          eyebrowColor: const Color(0xFFD14A1F),
          title: 'Rites of Passage Camp',
          subtitle: 'Register, sponsor a camper, or track a registration',
          onTap: () => context.push('/rops-camp'),
        ),
      ],
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.image,
    required this.eyebrow,
    required this.eyebrowColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String image;
  final String eyebrow;
  final Color eyebrowColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: Container(
          height: 104,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: AppColors.clay100),
          ),
          clipBehavior: Clip.antiAlias,
          child: Row(
            children: [
              SizedBox(
                width: 104,
                height: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      image,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          Container(color: AppColors.clay200),
                    ),
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [
                            eyebrowColor,
                            eyebrowColor.withValues(alpha: 0.5),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          Icon(AppIcons.flame, size: 11, color: eyebrowColor),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              eyebrow,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.8,
                                color: eyebrowColor,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                          color: AppColors.clay700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 11.5,
                          height: 1.35,
                          color: AppColors.clay400,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Icon(AppIcons.forward,
                    size: 15, color: AppColors.clay300),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            'OR',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.6,
              color: AppColors.clay400.withValues(alpha: 0.9),
            ),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.border)),
      ],
    );
  }
}
