"""Emit the Dart access-control tables straight from access-control.ts so the
two can never drift by a transcription slip."""
import json, re, pathlib

# Resolved from this file, not the working directory, so the generator runs
# the same from the repo root, from mobile/, or on a CI runner.
ROOT = pathlib.Path(__file__).resolve().parents[2]

src = (ROOT / "src/lib/access-control.ts").read_text()

def block(name, open_ch, close_ch):
    """Extract the balanced literal assigned to `name`."""
    m = re.search(rf"export const {name}\b[^=]*=\s*", src)
    if not m:
        raise ValueError(f"no assignment for {name}")
    i = src.index(open_ch, m.end() - 1)
    depth = 0
    for j in range(i, len(src)):
        if src[j] == open_ch: depth += 1
        elif src[j] == close_ch:
            depth -= 1
            if depth == 0:
                return src[i:j+1]
    raise ValueError(name)

def to_json(ts):
    # strip // comments (none contain quotes/URLs in this file)
    ts = re.sub(r'^\s*//.*$', '', ts, flags=re.M)
    # quote bare keys
    ts = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', ts)
    # drop trailing commas
    ts = re.sub(r',(\s*[}\]])', r'\1', ts)
    # join implicitly-concatenated string literals across lines:
    #   "a" +\n  "b"  ->  "ab"
    prev = None
    while prev != ts:
        prev = ts
        ts = re.sub(r'"((?:[^"\\]|\\.)*)"\s*\+\s*"((?:[^"\\]|\\.)*)"', r'"\1\2"', ts)
    return json.loads(ts)

PAGE_DEFS   = to_json(block("PAGE_DEFINITIONS", "[", "]"))
PAGE_PERMS  = to_json(block("DEFAULT_PAGE_PERMISSIONS", "{", "}"))
FEAT_DEFS   = to_json(block("FEATURE_DEFINITIONS", "[", "]"))
FEAT_MIN    = to_json(block("DEFAULT_FEATURE_MIN_ROLES", "{", "}"))
DEPT_RULES  = to_json(block("DEFAULT_DEPARTMENT_ACCESS_RULES", "[", "]"))
DEPT_MGRS   = to_json(block("DEPARTMENTAL_MANAGERS", "[", "]"))

ROLE = {
  "SUPER_ADMIN": "UserRole.superAdmin",
  "VICE_CHAIRPERSON": "UserRole.viceChairperson",
  "ADMIN": "UserRole.admin",
  "DEPARTMENT_LEAD": "UserRole.departmentLead",
  "YOUTH_LEADER": "UserRole.youthLeader",
  "MEMBER": "UserRole.member",
}
LEVEL = {"edit": "AccessLevel.edit", "view": "AccessLevel.view", "none": "AccessLevel.none"}

def q(s):
    return json.dumps(s, ensure_ascii=False)

out = []
w = out.append

w("""// GENERATED FROM src/lib/access-control.ts — keep the two in step.
//
// Line-for-line port of the web's access-control tables and the three merge
// functions. The semantics are identical: SUPER_ADMIN always wins, locked
// roles override saved config, and unknown page/feature keys deny.

import '../../data/models/enums.dart';

/// Metadata about a configurable page.
class PageDefinition {
  const PageDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.route,
    this.lockedRoles = const {},
  });

  final String key;
  final String label;
  final String description;
  final String route;

  /// Roles that can never lose access (e.g. SUPER_ADMIN always has edit).
  final Map<UserRole, AccessLevel> lockedRoles;
}

/// Metadata about a configurable feature permission.
class FeatureDefinition {
  const FeatureDefinition({
    required this.key,
    required this.label,
    required this.description,
    required this.category,
    this.lockedMinRole,
    required this.supportsDepartmentRules,
  });

  final String key;
  final String label;
  final String description;
  final String category;

  /// If set, the minimum role cannot be lowered below this.
  final UserRole? lockedMinRole;

  /// Whether this feature supports department-based access rules.
  final bool supportsDepartmentRules;
}

/// A department-based rule granting a feature to users in a department.
class DepartmentAccessRule {
  const DepartmentAccessRule({
    required this.featureKey,
    required this.departmentName,
    required this.requiresLeadership,
    this.allowedRoles = const [],
  });

  factory DepartmentAccessRule.fromMap(Map<String, dynamic> map) {
    return DepartmentAccessRule(
      featureKey: (map['featureKey'] ?? '').toString(),
      departmentName: (map['departmentName'] ?? '').toString(),
      requiresLeadership: map['requiresLeadership'] == true,
      allowedRoles: (map['allowedRoles'] is List)
          ? (map['allowedRoles'] as List)
              .map((e) => UserRole.fromWire(e))
              .toList()
          : const <UserRole>[],
    );
  }

  final String featureKey;
  final String departmentName;

  /// true = the user must lead this department; false = membership is enough.
  final bool requiresLeadership;

  /// If non-empty, only these roles get department-based access.
  final List<UserRole> allowedRoles;

  Map<String, dynamic> toMap() => {
        'featureKey': featureKey,
        'departmentName': departmentName,
        'requiresLeadership': requiresLeadership,
        'allowedRoles': allowedRoles.map((r) => r.wire).toList(),
      };
}

/// A department whose lead is treated as a departmental manager in the
/// Super Admin role-management UI.
class DepartmentalManager {
  const DepartmentalManager(this.departmentName, [this.displayName]);
  final String departmentName;
  final String? displayName;
  String get label => displayName ?? departmentName;
}

typedef PagePermissions = Map<String, Map<UserRole, AccessLevel>>;
typedef FeatureMinRoles = Map<String, UserRole>;
""")

# ── PAGE_DEFINITIONS ──
w("/// All configurable pages in the system. Settings is excluded — it is")
w("/// always SUPER_ADMIN only.")
w("const List<PageDefinition> kPageDefinitions = [")
for p in PAGE_DEFS:
    w("  PageDefinition(")
    w(f"    key: {q(p['key'])},")
    w(f"    label: {q(p['label'])},")
    w(f"    description: {q(p['description'])},")
    w(f"    route: {q(p['route'])},")
    if p.get("lockedRoles"):
        pairs = ", ".join(f"{ROLE[k]}: {LEVEL[v]}" for k, v in p["lockedRoles"].items())
        w(f"    lockedRoles: {{{pairs}}},")
    w("  ),")
w("];\n")

# ── DEFAULT_PAGE_PERMISSIONS ──
w("/// The default permissions that match the web's hardcoded behaviour.")
w("final PagePermissions kDefaultPagePermissions = {")
for key, roles in PAGE_PERMS.items():
    w(f"  {q(key)}: {{")
    for r, lvl in roles.items():
        w(f"    {ROLE[r]}: {LEVEL[lvl]},")
    w("  },")
w("};\n")

# ── FEATURE_DEFINITIONS ──
w("/// All configurable feature permissions — what actions users can perform,")
w("/// beyond page access.")
w("const List<FeatureDefinition> kFeatureDefinitions = [")
for f in FEAT_DEFS:
    w("  FeatureDefinition(")
    w(f"    key: {q(f['key'])},")
    w(f"    label: {q(f['label'])},")
    w(f"    description: {q(f['description'])},")
    w(f"    category: {q(f['category'])},")
    if f.get("lockedMinRole"):
        w(f"    lockedMinRole: {ROLE[f['lockedMinRole']]},")
    w(f"    supportsDepartmentRules: {str(f['supportsDepartmentRules']).lower()},")
    w("  ),")
w("];\n")

# ── DEFAULT_FEATURE_MIN_ROLES ──
w("/// Default minimum role for each feature.")
w("final FeatureMinRoles kDefaultFeatureMinRoles = {")
for k, v in FEAT_MIN.items():
    w(f"  {q(k)}: {ROLE[v]},")
w("};\n")

# ── DEFAULT_DEPARTMENT_ACCESS_RULES ──
w("/// Default department access rules.")
w("const List<DepartmentAccessRule> kDefaultDepartmentAccessRules = [")
for r in DEPT_RULES:
    w("  DepartmentAccessRule(")
    w(f"    featureKey: {q(r['featureKey'])},")
    w(f"    departmentName: {q(r['departmentName'])},")
    w(f"    requiresLeadership: {str(r['requiresLeadership']).lower()},")
    if r.get("allowedRoles"):
        w(f"    allowedRoles: [{', '.join(ROLE[x] for x in r['allowedRoles'])}],")
    w("  ),")
w("];\n")

# ── DEPARTMENTAL_MANAGERS ──
w("/// Departments tracked in the Super Admin role-management UI, in the order")
w("/// the Chairperson listed them.")
w("const List<DepartmentalManager> kDepartmentalManagers = [")
for m in DEPT_MGRS:
    if m.get("displayName"):
        w(f"  DepartmentalManager({q(m['departmentName'])}, {q(m['displayName'])}),")
    else:
        w(f"  DepartmentalManager({q(m['departmentName'])}),")
w("];")

(ROOT / "mobile/lib/core/access/access_tables.dart").write_text("\n".join(out) + "\n")
print(f"pages={len(PAGE_DEFS)} perms={len(PAGE_PERMS)} features={len(FEAT_DEFS)} "
      f"minRoles={len(FEAT_MIN)} rules={len(DEPT_RULES)} managers={len(DEPT_MGRS)}")
