import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../auth/auth_provider.dart';
import '../models/misc.dart';
import '../models/user.dart';
import 'access_control.dart' as ac;

/// Port of `src/contexts/AccessControlContext.tsx` — listens to the
/// `settings/accessControl` document and merges saved config with defaults.
class AccessControlProvider extends ChangeNotifier {
  AccessControlProvider() {
    _sub = FirebaseFirestore.instance
        .collection('settings')
        .doc('accessControl')
        .snapshots()
        .listen((snapshot) {
      if (snapshot.exists) {
        final data = snapshot.data() ?? {};
        if (data['pagePermissions'] != null) {
          pagePermissions =
              ac.mergeWithDefaults(pagePermissionsFrom(data['pagePermissions']));
        }
        if (data['featureMinRoles'] != null) {
          featureMinRoles =
              ac.mergeFeatureMinRoles(featureMinRolesFrom(data['featureMinRoles']));
        }
        if (data['departmentAccessRules'] != null) {
          departmentAccessRules = ac.mergeDepartmentAccessRules(
              accessRulesFrom(data['departmentAccessRules']));
        }
      }
      loading = false;
      notifyListeners();
    }, onError: (Object error) {
      debugPrint('Error loading access control config: $error');
      loading = false;
      notifyListeners();
    });
  }

  PagePermissions pagePermissions = ac.defaultPagePermissions;
  FeatureMinRoles featureMinRoles = ac.defaultFeatureMinRoles;
  List<DepartmentAccessRule> departmentAccessRules =
      ac.defaultDepartmentAccessRules;
  bool loading = true;

  StreamSubscription? _sub;

  bool canAccessPage(String pageKey, String role) =>
      ac.canAccessPage(pageKey, role, pagePermissions);

  bool canEditPage(String pageKey, String role) =>
      ac.canEditPage(pageKey, role, pagePermissions);

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

/// Port of `src/hooks/useFeatureAccess.ts` (plus the feature-specific hooks
/// built on it). Resolves feature keys for the signed-in user, including
/// department-membership rules via a session-cached department name→id map.
class FeatureAccessProvider extends ChangeNotifier {
  FeatureAccessProvider(this._auth, this._accessControl) {
    _auth.addListener(_recompute);
    _accessControl.addListener(_recompute);
    _recompute();
  }

  final AuthProvider _auth;
  final AccessControlProvider _accessControl;

  Map<String, String>? _deptMap; // department name → id
  bool _fetchingDeptMap = false;

  bool get loading {
    final user = _auth.userData;
    if (_auth.loading || _accessControl.loading || user == null) return true;
    return _needsDeptLookup(user) && _deptMap == null;
  }

  bool _needsDeptLookup(AppUser user) =>
      user.role != UserRole.superAdmin && user.role != UserRole.admin;

  void _recompute() {
    final user = _auth.userData;
    if (user != null && _needsDeptLookup(user) && _deptMap == null) {
      _fetchDeptMap();
    }
    notifyListeners();
  }

  Future<void> _fetchDeptMap() async {
    if (_fetchingDeptMap) return;
    _fetchingDeptMap = true;
    try {
      final snap =
          await FirebaseFirestore.instance.collection('departments').get();
      final map = <String, String>{};
      for (final doc in snap.docs) {
        final name = doc.data()['name'];
        if (name is String && name.isNotEmpty) map[name] = doc.id;
      }
      _deptMap = map;
    } catch (_) {
      _deptMap = {};
    } finally {
      _fetchingDeptMap = false;
      notifyListeners();
    }
  }

  /// Clear the cached department map (after renaming/creating departments).
  void invalidateDepartmentMap() {
    _deptMap = null;
    _recompute();
  }

  /// Check a feature key against the current user, config and rules.
  bool can(String featureKey) {
    final user = _auth.userData;
    if (loading || user == null) return false;
    return ac.checkFeatureAccess(
      featureKey,
      user.role,
      user.departmentIds,
      user.leadsDepartmentIds,
      _deptMap ?? {},
      minRoles: _accessControl.featureMinRoles,
      rules: _accessControl.departmentAccessRules,
    );
  }

  // ── Named shortcuts mirroring the web app's per-feature hooks ──

  /// `useCampLeadAccess` — full camp management page.
  bool get canManageCamp => can('manage_camp_registrations');

  /// `useCampLeadAccess` — read-only camp status page.
  bool get canViewCampStatus => can('view_camp_registrations');

  /// `useFundraisingAccess`
  bool get canPlanBraai => can('plan_fundraising_braai');

  /// `useFundraisingOrdersAccess`
  bool get canManageOrders => can('manage_fundraising_orders');

  /// `useTransportAccess`
  bool get canManageTransport => can('manage_transport_logistics');
  bool get canApproveAccounts => can('approve_accounts');

  /// `useMediaAccess`
  bool get canManageMedia => can('manage_media');

  /// `useFoodAccess`
  bool get canConfirmFood => can('confirm_food');

  /// `useCampPassAccess`
  bool get canPassAdmissions => can('camp_pass_admissions');
  bool get canPassManager => can('camp_pass_manager');
  bool get canPassChair => can('camp_pass_chair');
  bool get canScanPasses => can('scan_camp_passes');

  /// `useCampMealAccess`
  bool get canServeMeals => can('serve_camp_meals');

  @override
  void dispose() {
    _auth.removeListener(_recompute);
    _accessControl.removeListener(_recompute);
    super.dispose();
  }
}
