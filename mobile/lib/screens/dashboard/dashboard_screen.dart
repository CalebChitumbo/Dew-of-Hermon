import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';
import '../affirmations/affirmations_screen.dart';
import '../camp/camp_screen.dart';
import '../events/event_detail_screen.dart';
import '../fundraising/order_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.onSeeSchedule,
    required this.onSeeCalendar,
  });

  final VoidCallback onSeeSchedule;
  final VoidCallback onSeeCalendar;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  MyAssignment? _nextAssignment;
  bool _loadingAssignment = true;
  bool _responding = false;

  @override
  void initState() {
    super.initState();
    _loadNextAssignment();
  }

  Future<void> _loadNextAssignment() async {
    final api = context.read<ApiClient>();
    try {
      final data = await api.getJson('/api/my-assignments');
      final list = (data['assignments'] as List? ?? [])
          .whereType<Map>()
          .map((m) => MyAssignment.fromJson(m.cast<String, dynamic>()))
          .toList();
      final today = DateTime.now().subtract(const Duration(hours: 24));
      list.retainWhere(
          (a) => a.serviceDate == null || a.serviceDate!.isAfter(today));
      list.sort((a, b) {
        final ad = a.serviceDate, bd = b.serviceDate;
        if (ad == null && bd == null) return 0;
        if (ad == null) return -1;
        if (bd == null) return 1;
        return ad.compareTo(bd);
      });
      if (mounted) {
        setState(() {
          _nextAssignment = list.isEmpty ? null : list.first;
          _loadingAssignment = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingAssignment = false);
    }
  }

  /// Confirm/decline straight from the dashboard — confetti on confirm.
  Future<void> _respond(MyAssignment assignment, String status) async {
    final auth = context.read<AuthService>();
    final api = context.read<ApiClient>();
    setState(() => _responding = true);
    try {
      await api.putJson(assignment.updateApiPath, {
        'status': status,
        'callerRole': auth.profile?.role,
        'callerId': auth.firebaseUser?.uid,
      });
      if (!mounted) return;
      if (status == 'CONFIRMED') {
        await showCelebration(context);
        if (mounted) {
          showAppSnackBar(context, "You're in — thank you for serving! 🎉");
        }
      } else {
        showAppSnackBar(context, 'Assignment declined.');
      }
      await _loadNextAssignment();
    } on ApiException catch (e) {
      if (mounted) showAppSnackBar(context, e.message, isError: true);
    } finally {
      if (mounted) setState(() => _responding = false);
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthService>().profile;
    if (profile == null) return const SizedBox.shrink();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: PWColors.goldDark,
          onRefresh: _loadNextAssignment,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              Entrance(
                child: _AnimatedHero(
                  profile: profile,
                  greeting: _greeting(),
                  pendingAssignment:
                      _nextAssignment?.isPending == true ? _nextAssignment : null,
                ),
              ),
              const SizedBox(height: 14),
              if (profile.isAdmin)
                Entrance(delayMs: 80, child: _LiveStatsRow()),
              const SizedBox(height: 14),
              Entrance(
                delayMs: 140,
                child: _MyNextCard(
                  loading: _loadingAssignment,
                  responding: _responding,
                  assignment: _nextAssignment,
                  onOpenSchedule: widget.onSeeSchedule,
                  onConfirm: (a) => _respond(a, 'CONFIRMED'),
                  onDecline: (a) => _respond(a, 'DECLINED'),
                ),
              ),
              const SizedBox(height: 24),
              Entrance(
                delayMs: 200,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader('This week'),
                    _DevotionalCard(),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Entrance(
                delayMs: 260,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SectionHeader('Ministry pulse'),
                    _QuickActions(),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Entrance(
                delayMs: 320,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SectionHeader(
                      'Upcoming events',
                      trailing: TextButton(
                        onPressed: widget.onSeeCalendar,
                        child: const Text('Calendar'),
                      ),
                    ),
                    _UpcomingEvents(lifeGroup: profile.lifeGroup),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Entrance(
                delayMs: 380,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader('Recent activity'),
                    _RecentActivity(uid: profile.id),
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

// ─── Animated hero ───────────────────────────────────────────────────────

class _AnimatedHero extends StatefulWidget {
  const _AnimatedHero({
    required this.profile,
    required this.greeting,
    required this.pendingAssignment,
  });

  final UserProfile profile;
  final String greeting;
  final MyAssignment? pendingAssignment;

  @override
  State<_AnimatedHero> createState() => _AnimatedHeroState();
}

class _AnimatedHeroState extends State<_AnimatedHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 9),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final profile = widget.profile;

    return AnimatedBuilder(
      animation: _drift,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_drift.value);
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border:
                Border.all(color: PWColors.clay200.withValues(alpha: 0.7)),
            gradient: LinearGradient(
              begin: Alignment(-1 + t * 0.6, -1),
              end: Alignment(1, 1 - t * 0.5),
              colors: [
                PWColors.cream,
                Colors.white,
                Color.lerp(
                  PWColors.gold.withValues(alpha: 0.10),
                  PWColors.teal.withValues(alpha: 0.10),
                  t,
                )!,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: PWColors.clay700.withValues(alpha: 0.07),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Drifting glow orbs.
              Positioned(
                top: -38 + t * 14,
                right: -30,
                child: _orb(110, PWColors.gold.withValues(alpha: 0.22)),
              ),
              Positioned(
                bottom: -42 - t * 10,
                left: -26 + t * 16,
                child: _orb(96, PWColors.teal.withValues(alpha: 0.18)),
              ),
              child!,
            ],
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _PulsingDot(),
                const SizedBox(width: 8),
                Text(
                  DateFormat('EEEE, MMMM d').format(DateTime.now())
                      .toUpperCase(),
                  style: textTheme.labelSmall?.copyWith(
                    color: PWColors.clay400,
                    letterSpacing: 1.8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '${widget.greeting}, '),
                  WidgetSpan(
                    alignment: PlaceholderAlignment.baseline,
                    baseline: TextBaseline.alphabetic,
                    child: ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [
                          PWColors.clay700,
                          PWColors.goldDark,
                          PWColors.gold,
                        ],
                      ).createShader(bounds),
                      child: Text(
                        profile.firstName,
                        style: textTheme.headlineMedium
                            ?.copyWith(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
              style: textTheme.headlineMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _chip(context, profile.roleLabel, gold: true),
                if (profile.lifeGroup != null)
                  _chip(context, '${profile.lifeGroup} life group'),
              ],
            ),
            const SizedBox(height: 12),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              child: Text(
                widget.pendingAssignment != null
                    ? 'You have a pending '
                        '${widget.pendingAssignment!.roleName} assignment '
                        'to confirm. ⤵'
                    : 'All caught up — have a blessed day. ✨',
                key: ValueKey(widget.pendingAssignment?.id ?? 'free'),
                style: textTheme.bodyMedium
                    ?.copyWith(color: PWColors.clay600, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _orb(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withValues(alpha: 0)],
          ),
        ),
      );

  Widget _chip(BuildContext context, String label, {bool gold = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: gold
            ? PWColors.gold.withValues(alpha: 0.16)
            : Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(999),
        border: gold ? null : Border.all(color: PWColors.clay200),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: gold ? PWColors.goldDark : PWColors.clay600,
              fontWeight: gold ? FontWeight.w700 : FontWeight.w500,
            ),
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 1.0).animate(_controller),
      child: Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: PWColors.gold,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: PWColors.gold.withValues(alpha: 0.6),
              blurRadius: 6,
              spreadRadius: 1,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Live admin stats with count-up numbers ──────────────────────────────

class _LiveStatsRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final db = FirebaseFirestore.instance;
    return Row(
      children: [
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: db
                .collection('users')
                .where('isActive', isEqualTo: true)
                .snapshots(),
            builder: (context, snap) => _StatCard(
              label: 'Members',
              value: snap.data?.size,
              icon: Icons.people_outline,
              color: PWColors.teal,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: db.collection('events').where(
              'approvalStatus',
              whereIn: const [
                'PENDING_DISPATCH',
                'PENDING_STAKEHOLDERS',
                'PENDING_VICE_CHAIR',
                'PENDING_CHAIR',
              ],
            ).snapshots(),
            builder: (context, snap) => _StatCard(
              label: 'Approvals',
              value: snap.data?.size,
              icon: Icons.fact_check_outlined,
              color: PWColors.goldDark,
              highlight: (snap.data?.size ?? 0) > 0,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: db
                .collection('events')
                .where('startDate',
                    isGreaterThanOrEqualTo:
                        Timestamp.fromDate(DateTime.now()))
                .orderBy('startDate')
                .limit(10)
                .snapshots(),
            builder: (context, snap) {
              final upcoming = (snap.data?.docs ?? const [])
                  .map((d) => AppEvent.fromMap(d.id, d.data()))
                  .where((e) => e.isApproved)
                  .length;
              return _StatCard(
                label: 'Events up',
                value: snap.hasData ? upcoming : null,
                icon: Icons.event_outlined,
                color: const Color(0xFF2563EB),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.highlight = false,
  });

  final String label;
  final int? value;
  final IconData icon;
  final Color color;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: highlight
              ? color.withValues(alpha: 0.5)
              : PWColors.clay200.withValues(alpha: 0.7),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(height: 8),
            value == null
                ? const PulseSkeleton(height: 24, width: 36)
                : CountUp(
                    value!,
                    style: textTheme.headlineSmall
                        ?.copyWith(color: PWColors.clay700),
                  ),
            Text(
              label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textTheme.labelSmall?.copyWith(
                color: PWColors.clay400,
                letterSpacing: 1.1,
                fontSize: 9.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── My Next (with in-place confirm + confetti) ──────────────────────────

class _MyNextCard extends StatelessWidget {
  const _MyNextCard({
    required this.loading,
    required this.responding,
    required this.assignment,
    required this.onOpenSchedule,
    required this.onConfirm,
    required this.onDecline,
  });

  final bool loading;
  final bool responding;
  final MyAssignment? assignment;
  final VoidCallback onOpenSchedule;
  final ValueChanged<MyAssignment> onConfirm;
  final ValueChanged<MyAssignment> onDecline;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final a = assignment;

    return Card(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            // Accent rail
            Positioned.fill(
              left: 0,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 4,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: a?.isPending == true
                          ? [PWColors.gold, PWColors.goldDark]
                          : [
                              PWColors.gold.withValues(alpha: 0.6),
                              PWColors.teal.withValues(alpha: 0.5),
                            ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
              child: AnimatedSize(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOut,
                alignment: Alignment.topCenter,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                PWColors.gold.withValues(alpha: 0.25),
                                PWColors.gold.withValues(alpha: 0.1),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.inbox_outlined,
                              size: 18, color: PWColors.goldDark),
                        ),
                        const SizedBox(width: 10),
                        Text('My Next', style: textTheme.titleMedium),
                        const Spacer(),
                        TextButton(
                          onPressed: onOpenSchedule,
                          child: const Text('Full schedule'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (loading)
                      const Column(
                        children: [
                          PulseSkeleton(height: 14, width: 140),
                          SizedBox(height: 8),
                          PulseSkeleton(height: 22),
                          SizedBox(height: 8),
                          PulseSkeleton(height: 14, width: 200),
                        ],
                      )
                    else if (a == null)
                      Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: PWColors.teal.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.auto_awesome,
                                color: PWColors.teal),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "You're free right now.",
                                  style: textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  'No upcoming role assignments.',
                                  style: textTheme.bodySmall
                                      ?.copyWith(color: PWColors.clay400),
                                ),
                              ],
                            ),
                          ),
                        ],
                      )
                    else ...[
                      Text(
                        [
                          if (a.serviceDate != null)
                            DateFormat('EEE, MMM d').format(a.serviceDate!),
                          if (a.serviceTime != null) a.serviceTime!,
                        ].join(' · ').toUpperCase(),
                        style: textTheme.labelSmall?.copyWith(
                          color: PWColors.clay400,
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(a.roleName, style: textTheme.titleLarge),
                      if (a.eventTitle != null || a.venue != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          [a.eventTitle, a.venue]
                              .whereType<String>()
                              .join(' · '),
                          style: textTheme.bodySmall
                              ?.copyWith(color: PWColors.clay500),
                        ),
                      ],
                      const SizedBox(height: 12),
                      if (responding)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(6),
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        )
                      else if (a.isPending)
                        Row(
                          children: [
                            Expanded(
                              child: PressableScale(
                                onTap: () => onDecline(a),
                                child: OutlinedButton(
                                  onPressed: () => onDecline(a),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: PWColors.destructive,
                                    side: const BorderSide(
                                        color: Color(0xFFFECACA)),
                                  ),
                                  child: const Text('Decline'),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              flex: 2,
                              child: PressableScale(
                                onTap: () => onConfirm(a),
                                child: Container(
                                  height: 46,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        PWColors.teal,
                                        PWColors.tealDark,
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: PWColors.teal
                                            .withValues(alpha: 0.4),
                                        blurRadius: 12,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: const Center(
                                    child: Text(
                                      "I'm in — confirm 🙌",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        )
                      else
                        Row(
                          children: [
                            StatusBadge(status: a.status),
                            const Spacer(),
                            TextButton(
                              onPressed: onOpenSchedule,
                              child: const Text('View details'),
                            ),
                          ],
                        ),
                    ],
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

// ─── Quick actions ───────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.cabin_outlined,
            colors: const [Color(0xFFFB923C), Color(0xFFEA580C)],
            label: 'ROPs Camp',
            hint: 'Register',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CampScreen()),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.outdoor_grill_outlined,
            colors: const [Color(0xFFF87171), Color(0xFFDC2626)],
            label: 'Braai orders',
            hint: 'Order food',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const FundraisingOrderScreen()),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.auto_awesome,
            colors: const [Color(0xFFF472B6), Color(0xFFDB2777)],
            label: 'Affirmations',
            hint: 'Read',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const AffirmationsScreen()),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.colors,
    required this.label,
    required this.hint,
    required this.onTap,
  });

  final IconData icon;
  final List<Color> colors;
  final String label;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return PressableScale(
      onTap: onTap,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: colors,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: colors.last.withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(icon, size: 19, color: Colors.white),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelMedium?.copyWith(
                  color: PWColors.clay700,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    textTheme.labelSmall?.copyWith(color: PWColors.clay400),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Devotional ──────────────────────────────────────────────────────────

class _DevotionalCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('devotionals')
          .orderBy('weekStartDate', descending: true)
          .limit(1)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  PulseSkeleton(height: 14, width: 160),
                  SizedBox(height: 8),
                  PulseSkeleton(height: 18),
                ],
              ),
            ),
          );
        }
        final docs = snapshot.data?.docs ?? const [];
        if (docs.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No devotional yet',
              subtitle: 'This week’s devotional will appear here.',
            ),
          );
        }
        final devotional =
            Devotional.fromMap(docs.first.id, docs.first.data());
        return PressableScale(
          scale: 0.98,
          onTap: () => showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            showDragHandle: true,
            backgroundColor: PWColors.cream,
            builder: (_) => _DevotionalSheet(devotional: devotional),
          ),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFA78BFA), Color(0xFF7C3AED)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF7C3AED)
                              .withValues(alpha: 0.35),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.menu_book_outlined,
                        color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "THIS WEEK'S DEVOTIONAL",
                          style: textTheme.labelSmall?.copyWith(
                            color: PWColors.clay400,
                            letterSpacing: 1.6,
                            fontSize: 9.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          devotional.title,
                          style: textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (devotional.scriptureReference != null)
                          Text(
                            devotional.scriptureReference!,
                            style: textTheme.bodySmall
                                ?.copyWith(color: PWColors.goldDark),
                          ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: PWColors.clay300),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _DevotionalSheet extends StatelessWidget {
  const _DevotionalSheet({required this.devotional});

  final Devotional devotional;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        children: [
          Text(devotional.title, style: textTheme.headlineSmall),
          if (devotional.scriptureReference != null) ...[
            const SizedBox(height: 4),
            Text(
              devotional.scriptureReference!,
              style: textTheme.bodyMedium?.copyWith(
                color: PWColors.goldDark,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'By ${devotional.authorName}',
            style: textTheme.bodySmall?.copyWith(color: PWColors.clay400),
          ),
          const Divider(height: 28),
          Text(
            devotional.content,
            style: textTheme.bodyMedium?.copyWith(height: 1.6),
          ),
        ],
      ),
    );
  }
}

// ─── Upcoming events ─────────────────────────────────────────────────────

class _UpcomingEvents extends StatelessWidget {
  const _UpcomingEvents({required this.lifeGroup});

  final String? lifeGroup;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('events')
          .where('startDate',
              isGreaterThanOrEqualTo: Timestamp.fromDate(DateTime.now()))
          .orderBy('startDate')
          .limit(10)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  PulseSkeleton(height: 44),
                  SizedBox(height: 10),
                  PulseSkeleton(height: 44),
                ],
              ),
            ),
          );
        }
        final events = (snapshot.data?.docs ?? const [])
            .map((d) => AppEvent.fromMap(d.id, d.data()))
            .where((e) => e.isApproved)
            .take(5)
            .toList();
        if (events.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.event_outlined,
              title: 'Nothing scheduled yet',
              subtitle: 'Upcoming events will show up here.',
            ),
          );
        }
        return Card(
          child: Column(
            children: [
              for (final (i, event) in events.indexed) ...[
                if (i > 0) const Divider(height: 1),
                _EventRow(event: event),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event});

  final AppEvent event;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final daysAway = event.startDate
        .difference(DateTime.now())
        .inDays;
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => EventDetailScreen(event: event)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    PWColors.cream,
                    PWColors.gold.withValues(alpha: 0.12),
                  ],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: PWColors.clay200.withValues(alpha: 0.7)),
              ),
              child: Column(
                children: [
                  Text(
                    DateFormat('MMM').format(event.startDate).toUpperCase(),
                    style: textTheme.labelSmall?.copyWith(
                      color: PWColors.goldDark,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    DateFormat('d').format(event.startDate),
                    style: textTheme.titleMedium
                        ?.copyWith(color: PWColors.clay700),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      EventTypeChip(type: event.type, label: event.typeLabel),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          daysAway <= 0
                              ? 'Today!'
                              : daysAway == 1
                                  ? 'Tomorrow'
                                  : 'In $daysAway days · ${event.venue}',
                          style: textTheme.bodySmall?.copyWith(
                            color: daysAway <= 1
                                ? PWColors.goldDark
                                : PWColors.clay400,
                            fontWeight:
                                daysAway <= 1 ? FontWeight.w700 : null,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: PWColors.clay300),
          ],
        ),
      ),
    );
  }
}

// ─── Recent activity ─────────────────────────────────────────────────────

class _RecentActivity extends StatelessWidget {
  const _RecentActivity({required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('notifications')
          .where('userId', isEqualTo: uid)
          .orderBy('createdAt', descending: true)
          .limit(6)
          .snapshots(),
      builder: (context, snapshot) {
        final items = (snapshot.data?.docs ?? const [])
            .map((d) => AppNotification.fromMap(d.id, d.data()))
            .toList();
        if (items.isEmpty) {
          return const Card(
            child: EmptyState(
              icon: Icons.notifications_none,
              title: 'No activity yet',
              subtitle: 'Assignments and announcements will appear here.',
            ),
          );
        }
        return Card(
          child: Column(
            children: [
              for (final (i, n) in items.indexed) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  leading: _activityIcon(n.type),
                  title: Text(
                    n.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    n.message,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                  trailing: Text(
                    _relative(n.createdAt),
                    style: textTheme.labelSmall
                        ?.copyWith(color: PWColors.clay400),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  static Widget _activityIcon(String type) {
    final (icon, fg, bg) = switch (type) {
      'assignment' => (
          Icons.person_add_alt,
          PWColors.tealDark,
          const Color(0xFFE2F3F0)
        ),
      'reminder' => (
          Icons.notifications_outlined,
          PWColors.goldDark,
          const Color(0xFFFCF0DC)
        ),
      'event' => (
          Icons.event_outlined,
          const Color(0xFF2563EB),
          const Color(0xFFDBEAFE)
        ),
      _ => (
          Icons.auto_awesome,
          const Color(0xFF7C3AED),
          const Color(0xFFF3E8FF)
        ),
    };
    return Container(
      width: 38,
      height: 38,
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Icon(icon, size: 18, color: fg),
    );
  }

  static String _relative(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return DateFormat('MMM d').format(date);
  }
}
