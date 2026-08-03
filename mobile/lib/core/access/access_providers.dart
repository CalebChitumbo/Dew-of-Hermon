import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/enums.dart';
import '../../data/models/user.dart';
import '../auth/auth_providers.dart';
import '../utils/firestore_parse.dart';
import 'access_control.dart';

/// The live access-control configuration — the Dart counterpart of
/// `AccessControlContext`. A change the Chairperson makes in Settings lands
/// on every device without a restart.
class AccessConfig {
  const AccessConfig({
    required this.pagePermissions,
    required this.featureMinRoles,
    required this.departmentAccessRules,
  });

  factory AccessConfig.defaults() => AccessConfig(
        pagePermissions: kDefaultPagePermissions,
        featureMinRoles: kDefaultFeatureMinRoles,
        departmentAccessRules: kDefaultDepartmentAccessRules,
      );

  factory AccessConfig.fromMap(Map<String, dynamic> data) {
    final savedPages = parsePagePermissions(data['pagePermissions']);
    final savedRoles = parseFeatureMinRoles(data['featureMinRoles']);
    final savedRules = parseDepartmentAccessRules(data['departmentAccessRules']);
    return AccessConfig(
      pagePermissions: savedPages.isEmpty
          ? kDefaultPagePermissions
          : mergeWithDefaults(savedPages),
      featureMinRoles: savedRoles.isEmpty
          ? kDefaultFeatureMinRoles
          : mergeFeatureMinRoles(savedRoles),
      departmentAccessRules: data['departmentAccessRules'] == null
          ? kDefaultDepartmentAccessRules
          : mergeDepartmentAccessRules(savedRules),
    );
  }

  final PagePermissions pagePermissions;
  final FeatureMinRoles featureMinRoles;
  final List<DepartmentAccessRule> departmentAccessRules;
}

final accessConfigProvider = StreamProvider<AccessConfig>((ref) {
  return FirebaseFirestore.instance
      .collection('settings')
      .doc('accessControl')
      .snapshots()
      .map((snap) => snap.exists
          ? AccessConfig.fromMap(snap.data() ?? const {})
          : AccessConfig.defaults())
      // A read failure must never lock everyone out — fall back to the same
      // defaults the web ships with.
      .handleError((_) => AccessConfig.defaults());
});

/// Department name → Firestore id, needed to evaluate department rules.
final departmentNameToIdProvider = StreamProvider<Map<String, String>>((ref) {
  return FirebaseFirestore.instance
      .collection('departments')
      .snapshots()
      .map((snap) => {
            for (final doc in snap.docs)
              parseStringOr(doc.data()['name']): doc.id,
          }..remove(''))
      .handleError((_) => <String, String>{});
});

/// All departments, ordered as the web orders them.
final departmentsProvider = StreamProvider<List<Department>>((ref) {
  return FirebaseFirestore.instance
      .collection('departments')
      .snapshots()
      .map((snap) {
    final list = snap.docs.map((d) => Department.fromMap(withId(d))).toList()
      ..sort((a, b) {
        final byOrder = a.order.compareTo(b.order);
        return byOrder != 0 ? byOrder : a.name.compareTo(b.name);
      });
    return list;
  }).handleError((_) => <Department>[]);
});

/// Everything a screen needs to decide what this user may see and do.
class Access {
  const Access({
    required this.user,
    required this.config,
    required this.departmentNameToId,
  });

  final AppUser? user;
  final AccessConfig config;
  final Map<String, String> departmentNameToId;

  UserRole get role => user?.role ?? UserRole.member;
  bool get signedIn => user != null;

  AccessLevel pageAccess(String pageKey) =>
      getPageAccess(pageKey, role, config.pagePermissions);

  bool canView(String pageKey) => pageAccess(pageKey).canView;
  bool canEdit(String pageKey) => pageAccess(pageKey).canEdit;

  /// Feature check, combining the minimum role with department rules.
  bool can(String featureKey) {
    final u = user;
    if (u == null) return false;
    return checkFeatureAccess(
      featureKey,
      u.role,
      u.departmentIds,
      u.leadsDepartmentIds,
      departmentNameToId,
      minRoles: config.featureMinRoles,
      rules: config.departmentAccessRules,
    );
  }

  /// Whether the user leads the named department (by name, not id).
  bool leadsDepartmentNamed(String name) {
    final id = departmentNameToId[name];
    return id != null && (user?.leads(id) ?? false);
  }

  /// Whether the user belongs to the named department.
  bool inDepartmentNamed(String name) {
    final id = departmentNameToId[name];
    return id != null && (user?.belongsTo(id) ?? false);
  }
}

final accessProvider = Provider<Access>((ref) {
  return Access(
    user: ref.watch(userOrNullProvider),
    config: ref.watch(accessConfigProvider).valueOrNull ??
        AccessConfig.defaults(),
    departmentNameToId:
        ref.watch(departmentNameToIdProvider).valueOrNull ?? const {},
  );
});
