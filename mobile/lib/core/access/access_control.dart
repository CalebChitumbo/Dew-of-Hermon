import '../../data/models/enums.dart';
import 'access_tables.dart';

export 'access_tables.dart';

/// Port of the three access-control functions in `src/lib/access-control.ts`,
/// with identical semantics. Everything here is pure — the live
/// `settings/accessControl` config is streamed in by `access_providers.dart`
/// and passed as arguments, exactly as `AccessControlContext` does on the web.

final Map<String, PageDefinition> _pagesByKey = {
  for (final p in kPageDefinitions) p.key: p,
};

/// Get the access level for a role on a page, respecting locked roles.
/// Falls back to defaults if no custom config exists.
AccessLevel getPageAccess(
  String pageKey,
  UserRole role, [
  PagePermissions? customPermissions,
]) {
  // SUPER_ADMIN always has edit access.
  if (role == UserRole.superAdmin) return AccessLevel.edit;

  final pageDef = _pagesByKey[pageKey];
  if (pageDef == null) return AccessLevel.none;

  // Check locked roles first.
  final locked = pageDef.lockedRoles[role];
  if (locked != null) return locked;

  final permissions = customPermissions ?? kDefaultPagePermissions;
  return permissions[pageKey]?[role] ?? AccessLevel.none;
}

/// Find the page key for a given route path.
String? getPageKeyFromRoute(String pathname) {
  // Exact match first.
  for (final p in kPageDefinitions) {
    if (p.route == pathname) return p.key;
  }

  // Prefix match (e.g. /manage/members/123 → members), longest route wins.
  PageDefinition? best;
  for (final p in kPageDefinitions) {
    if (!pathname.startsWith('${p.route}/')) continue;
    if (best == null || p.route.length > best.route.length) best = p;
  }
  return best?.key;
}

/// Whether a role can see a page in navigation (view or edit).
bool canAccessPage(
  String pageKey,
  UserRole role, [
  PagePermissions? customPermissions,
]) =>
    getPageAccess(pageKey, role, customPermissions).canView;

/// Whether a role can edit (not just view) a page.
bool canEditPage(
  String pageKey,
  UserRole role, [
  PagePermissions? customPermissions,
]) =>
    getPageAccess(pageKey, role, customPermissions).canEdit;

/// Merge saved permissions with defaults for any page added since the config
/// was last saved.
PagePermissions mergeWithDefaults(PagePermissions saved) {
  final merged = <String, Map<UserRole, AccessLevel>>{
    for (final entry in kDefaultPagePermissions.entries)
      entry.key: Map<UserRole, AccessLevel>.from(entry.value),
  };
  for (final pageKey in saved.keys) {
    final existing = merged[pageKey];
    if (existing != null) {
      merged[pageKey] = {...existing, ...saved[pageKey]!};
    }
  }
  return merged;
}

/// Whether a user has access to a feature, considering both the minimum role
/// and any department-based access rules.
///
/// [departmentNameToId] maps a department name to its Firestore id.
bool checkFeatureAccess(
  String featureKey,
  UserRole userRole,
  List<String> userDepartmentIds,
  List<String> userLeadsDepartmentIds,
  Map<String, String> departmentNameToId, {
  FeatureMinRoles? minRoles,
  List<DepartmentAccessRule>? rules,
}) {
  // SUPER_ADMIN always has access.
  if (userRole == UserRole.superAdmin) return true;

  final effectiveMinRoles = minRoles ?? kDefaultFeatureMinRoles;
  final effectiveRules = rules ?? kDefaultDepartmentAccessRules;

  // An unlisted feature defaults to SUPER_ADMIN — i.e. denied here.
  final minRole = effectiveMinRoles[featureKey] ?? UserRole.superAdmin;
  if (userRole.atLeast(minRole)) return true;

  for (final rule in effectiveRules) {
    if (rule.featureKey != featureKey) continue;

    final deptId = departmentNameToId[rule.departmentName];
    if (deptId == null) continue;

    final hasMembership = rule.requiresLeadership
        ? userLeadsDepartmentIds.contains(deptId)
        : userDepartmentIds.contains(deptId);
    if (!hasMembership) continue;

    // An empty allowedRoles list means any role with the membership qualifies.
    if (rule.allowedRoles.isEmpty || rule.allowedRoles.contains(userRole)) {
      return true;
    }
  }

  return false;
}

/// Merge saved feature min roles with defaults for any new feature.
FeatureMinRoles mergeFeatureMinRoles(FeatureMinRoles saved) =>
    {...kDefaultFeatureMinRoles, ...saved};

/// Merge saved department access rules with defaults for any feature not yet
/// covered by saved rules. Saved rules win for features they already cover
/// (so customisations are never overwritten), but features added in code
/// after the last save still get their defaults.
List<DepartmentAccessRule> mergeDepartmentAccessRules(
  List<DepartmentAccessRule> saved,
) {
  final covered = saved.map((r) => r.featureKey).toSet();
  return [
    ...saved,
    ...kDefaultDepartmentAccessRules.where((r) => !covered.contains(r.featureKey)),
  ];
}

// ─── Parsing the stored config ───

/// Read `settings/accessControl.pagePermissions` into typed form.
PagePermissions parsePagePermissions(dynamic raw) {
  if (raw is! Map) return {};
  final out = <String, Map<UserRole, AccessLevel>>{};
  raw.forEach((pageKey, roleMap) {
    if (roleMap is! Map) return;
    final levels = <UserRole, AccessLevel>{};
    roleMap.forEach((roleWire, levelWire) {
      final role = UserRole.fromWire(roleWire);
      // fromWire falls back to MEMBER, so guard against a bogus key silently
      // rewriting the member row.
      if (roleWire is String && role.wire != roleWire) return;
      levels[role] = AccessLevel.fromWire(levelWire);
    });
    out[pageKey.toString()] = levels;
  });
  return out;
}

/// Read `settings/accessControl.featureMinRoles` into typed form.
FeatureMinRoles parseFeatureMinRoles(dynamic raw) {
  if (raw is! Map) return {};
  final out = <String, UserRole>{};
  raw.forEach((featureKey, roleWire) {
    if (roleWire is! String) return;
    final role = UserRole.fromWire(roleWire);
    if (role.wire != roleWire) return;
    out[featureKey.toString()] = role;
  });
  return out;
}

/// Read `settings/accessControl.departmentAccessRules` into typed form.
List<DepartmentAccessRule> parseDepartmentAccessRules(dynamic raw) {
  if (raw is! List) return const [];
  return raw
      .whereType<Map>()
      .map((m) => DepartmentAccessRule.fromMap(Map<String, dynamic>.from(m)))
      .where((r) => r.featureKey.isNotEmpty)
      .toList();
}
