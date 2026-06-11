import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/models.dart';

/// Port of src/lib/access-control.ts + AccessControlContext: streams the
/// saved config from settings/accessControl and the departments collection,
/// merges with the same defaults as the web, and answers page/feature
/// access questions for the signed-in profile.
class AccessService extends ChangeNotifier {
  AccessService() {
    _configSub = FirebaseFirestore.instance
        .doc('settings/accessControl')
        .snapshots()
        .listen(_onConfig, onError: (Object e) {
      debugPrint('accessControl listener: $e');
    });
    _deptSub = FirebaseFirestore.instance
        .collection('departments')
        .snapshots()
        .listen(_onDepartments, onError: (Object e) {
      debugPrint('departments listener: $e');
    });
  }

  StreamSubscription? _configSub;
  StreamSubscription? _deptSub;

  Map<String, Map<String, String>> _pagePermissions = {};
  Map<String, String> _featureMinRoles = {};
  List<DepartmentAccessRule> _departmentRules = [];
  bool _hasSavedConfig = false;

  List<Department> departments = [];
  Map<String, String> departmentNameToId = {};

  void _onConfig(DocumentSnapshot<Map<String, dynamic>> snap) {
    if (snap.exists) {
      final data = snap.data()!;
      _hasSavedConfig = true;
      _pagePermissions = _parsePagePermissions(data['pagePermissions']);
      _featureMinRoles = (data['featureMinRoles'] is Map)
          ? (data['featureMinRoles'] as Map).map(
              (k, v) => MapEntry(k.toString(), v.toString()))
          : {};
      _departmentRules = (data['departmentAccessRules'] is List)
          ? (data['departmentAccessRules'] as List)
              .whereType<Map>()
              .map((m) =>
                  DepartmentAccessRule.fromMap(m.cast<String, dynamic>()))
              .toList()
          : [];
    } else {
      _hasSavedConfig = false;
    }
    notifyListeners();
  }

  void _onDepartments(QuerySnapshot<Map<String, dynamic>> snap) {
    departments = snap.docs
        .map((d) => Department.fromMap(d.id, d.data()))
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    departmentNameToId = {for (final d in departments) d.name: d.id};
    notifyListeners();
  }

  static Map<String, Map<String, String>> _parsePagePermissions(dynamic raw) {
    if (raw is! Map) return {};
    final out = <String, Map<String, String>>{};
    raw.forEach((page, roles) {
      if (roles is Map) {
        out[page.toString()] =
            roles.map((k, v) => MapEntry(k.toString(), v.toString()));
      }
    });
    return out;
  }

  // ─── Page access (mirror of getPageAccess) ────────────────────────────

  /// "edit" | "view" | "none"
  String pageAccess(String pageKey, String role) {
    if (role == 'SUPER_ADMIN') return 'edit';
    final saved = _hasSavedConfig ? _pagePermissions[pageKey] : null;
    final defaults = _defaultPagePermissions[pageKey];
    return saved?[role] ?? defaults?[role] ?? 'none';
  }

  bool canAccessPage(String pageKey, String role) {
    final a = pageAccess(pageKey, role);
    return a == 'edit' || a == 'view';
  }

  bool canEditPage(String pageKey, String role) =>
      pageAccess(pageKey, role) == 'edit';

  // ─── Feature access (mirror of checkFeatureAccess) ────────────────────

  bool checkFeature(UserProfile? profile, String featureKey) {
    if (profile == null) return false;
    final role = profile.role;
    if (role == 'SUPER_ADMIN') return true;

    final minRoles = _hasSavedConfig && _featureMinRoles.isNotEmpty
        ? {..._defaultFeatureMinRoles, ..._featureMinRoles}
        : _defaultFeatureMinRoles;
    final minRole = minRoles[featureKey] ?? 'SUPER_ADMIN';
    if ((roleHierarchy[role] ?? 0) >= (roleHierarchy[minRole] ?? 99)) {
      return true;
    }

    final rules = _mergedRules();
    for (final rule in rules.where((r) => r.featureKey == featureKey)) {
      final deptId = departmentNameToId[rule.departmentName];
      if (deptId == null) continue;
      final hasMembership = rule.requiresLeadership
          ? profile.leadsDepartmentIds.contains(deptId)
          : profile.departmentIds.contains(deptId);
      if (!hasMembership) continue;
      if (rule.allowedRoles.isEmpty || rule.allowedRoles.contains(role)) {
        return true;
      }
    }
    return false;
  }

  List<DepartmentAccessRule> _mergedRules() {
    if (!_hasSavedConfig || _departmentRules.isEmpty) {
      return _defaultDepartmentRules;
    }
    final covered = _departmentRules.map((r) => r.featureKey).toSet();
    return [
      ..._departmentRules,
      ..._defaultDepartmentRules.where((r) => !covered.contains(r.featureKey)),
    ];
  }

  @override
  void dispose() {
    _configSub?.cancel();
    _deptSub?.cancel();
    super.dispose();
  }
}

class DepartmentAccessRule {
  const DepartmentAccessRule({
    required this.featureKey,
    required this.departmentName,
    required this.requiresLeadership,
    required this.allowedRoles,
  });

  final String featureKey;
  final String departmentName;
  final bool requiresLeadership;
  final List<String> allowedRoles;

  factory DepartmentAccessRule.fromMap(Map<String, dynamic> m) {
    return DepartmentAccessRule(
      featureKey: m['featureKey']?.toString() ?? '',
      departmentName: m['departmentName']?.toString() ?? '',
      requiresLeadership: m['requiresLeadership'] == true,
      allowedRoles: (m['allowedRoles'] is List)
          ? (m['allowedRoles'] as List).map((e) => e.toString()).toList()
          : const [],
    );
  }
}

// ─── Defaults (verbatim from src/lib/access-control.ts) ──────────────────

const _defaultFeatureMinRoles = <String, String>{
  'approve_events': 'ADMIN',
  'vice_chair_approve_events': 'VICE_CHAIRPERSON',
  'chair_approve_events': 'SUPER_ADMIN',
  'submit_event_report': 'DEPARTMENT_LEAD',
  'review_event_reports': 'SUPER_ADMIN',
  'submit_follow_up': 'ADMIN',
  'manage_follow_ups': 'ADMIN',
  'view_assigned_follow_ups': 'ADMIN',
  'approve_follow_up': 'ADMIN',
  'manage_devotionals': 'ADMIN',
  'manage_life_group_devotionals': 'ADMIN',
  'submit_life_group_lead': 'ADMIN',
  'manage_members': 'ADMIN',
  'delete_members': 'SUPER_ADMIN',
  'change_user_roles': 'ADMIN',
  'create_service': 'ADMIN',
  'create_events': 'DEPARTMENT_LEAD',
  'manage_templates': 'ADMIN',
  'manage_affirmations': 'ADMIN',
  'manage_departments': 'ADMIN',
  'manage_institutions': 'ADMIN',
  'manage_settings': 'SUPER_ADMIN',
  'latreou_access': 'ADMIN',
  'manage_camp_registrations': 'ADMIN',
  'manage_communications': 'ADMIN',
  'view_communications_reports': 'ADMIN',
  'manage_fundraising': 'ADMIN',
  'view_fundraising_reports': 'ADMIN',
  'plan_fundraising_braai': 'ADMIN',
  'manage_fundraising_orders': 'ADMIN',
  'manage_transport_logistics': 'ADMIN',
  'view_transport_assignments': 'ADMIN',
  'manage_food_logistics': 'ADMIN',
  'view_food_logistics': 'ADMIN',
  'approve_accounts': 'ADMIN',
  'manage_media': 'ADMIN',
  'view_media_reports': 'ADMIN',
  'confirm_food': 'ADMIN',
};

const _defaultDepartmentRules = <DepartmentAccessRule>[
  DepartmentAccessRule(
      featureKey: 'approve_events',
      departmentName: 'Events & Fellowship',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'submit_follow_up',
      departmentName: 'Campus Ministry',
      requiresLeadership: false,
      allowedRoles: []),
  DepartmentAccessRule(
      featureKey: 'submit_follow_up',
      departmentName: 'Life Groups',
      requiresLeadership: false,
      allowedRoles: []),
  DepartmentAccessRule(
      featureKey: 'manage_follow_ups',
      departmentName: 'Discipleship & Follow-Up',
      requiresLeadership: true,
      allowedRoles: []),
  DepartmentAccessRule(
      featureKey: 'view_assigned_follow_ups',
      departmentName: 'Discipleship & Follow-Up',
      requiresLeadership: false,
      allowedRoles: ['YOUTH_LEADER', 'DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'submit_life_group_lead',
      departmentName: 'Life Groups',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'approve_follow_up',
      departmentName: 'Campus Ministry',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'approve_follow_up',
      departmentName: 'Life Groups',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'manage_devotionals',
      departmentName: 'Campus Ministry',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'manage_life_group_devotionals',
      departmentName: 'Life Groups',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'latreou_access',
      departmentName: 'Worship & Music',
      requiresLeadership: false,
      allowedRoles: []),
  DepartmentAccessRule(
      featureKey: 'manage_camp_registrations',
      departmentName: 'ROPs Camp',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'manage_communications',
      departmentName: 'Media',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'view_communications_reports',
      departmentName: 'Media',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'manage_fundraising',
      departmentName: 'Fundraising',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'view_fundraising_reports',
      departmentName: 'Fundraising',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'plan_fundraising_braai',
      departmentName: 'Fundraising',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'manage_fundraising_orders',
      departmentName: 'Fundraising',
      requiresLeadership: false,
      allowedRoles: []),
  DepartmentAccessRule(
      featureKey: 'manage_transport_logistics',
      departmentName: 'Transport & Logistics',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'view_transport_assignments',
      departmentName: 'Transport & Logistics',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'manage_food_logistics',
      departmentName: 'Food Logistics',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'view_food_logistics',
      departmentName: 'Food Logistics',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'approve_accounts',
      departmentName: 'Finance',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'manage_media',
      departmentName: 'Media',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
  DepartmentAccessRule(
      featureKey: 'view_media_reports',
      departmentName: 'Media',
      requiresLeadership: false,
      allowedRoles: ['DEPARTMENT_LEAD', 'YOUTH_LEADER']),
  DepartmentAccessRule(
      featureKey: 'confirm_food',
      departmentName: 'Food Logistics',
      requiresLeadership: true,
      allowedRoles: ['DEPARTMENT_LEAD']),
];

/// Default page permissions for the pages the mobile app gates on
/// (subset of DEFAULT_PAGE_PERMISSIONS — SUPER_ADMIN is handled in code).
const _defaultPagePermissions = <String, Map<String, String>>{
  'departments': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'view',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'members': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'view',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'services': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'view',
    'YOUTH_LEADER': 'view',
    'MEMBER': 'none',
  },
  'events_create': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'edit',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'events_approvals': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'view',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'event_reports_submit': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'edit',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'event_reports_review': {
    'VICE_CHAIRPERSON': 'view',
    'ADMIN': 'view',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'discipleship': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'view',
    'YOUTH_LEADER': 'view',
    'MEMBER': 'view',
  },
  'manage_affirmations': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'rops_camp': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'fundraising': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'transport_requests': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'accounts_approvals': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'media_requests': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
  'food_requests': {
    'VICE_CHAIRPERSON': 'edit',
    'ADMIN': 'edit',
    'DEPARTMENT_LEAD': 'none',
    'YOUTH_LEADER': 'none',
    'MEMBER': 'none',
  },
};
