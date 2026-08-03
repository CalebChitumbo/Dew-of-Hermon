import '../firestore/converters.dart';

/// Roles, mirrored from `src/types/index.ts` (`UserRole`). Values are the
/// exact wire strings used in Firestore and the API.
class UserRole {
  static const superAdmin = 'SUPER_ADMIN';
  static const viceChairperson = 'VICE_CHAIRPERSON';
  static const admin = 'ADMIN';
  static const departmentLead = 'DEPARTMENT_LEAD';
  static const youthLeader = 'YOUTH_LEADER';
  static const member = 'MEMBER';

  static const all = [
    superAdmin,
    viceChairperson,
    admin,
    departmentLead,
    youthLeader,
    member,
  ];

  /// SUPER_ADMIN: 6 … MEMBER: 1 (from `access-control.ts` ROLE_HIERARCHY).
  static const hierarchy = <String, int>{
    superAdmin: 6,
    viceChairperson: 5,
    admin: 4,
    departmentLead: 3,
    youthLeader: 2,
    member: 1,
  };

  static String label(String role) => role.replaceAll('_', ' ');
}

class LifeGroup {
  static const bridge = 'BRIDGE';
  static const anchor = 'ANCHOR';
  static const cornerstone = 'CORNERSTONE';
  static const all = [bridge, anchor, cornerstone];
}

class AppUser {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final List<String> departmentIds;
  final List<String> leadsDepartmentIds;
  final String? profileImage;
  final bool isActive;
  final bool pushEnabled;
  final String? lifeGroup;
  final bool isStudent;
  final String? institutionId;
  final DateTime createdAt;
  final DateTime updatedAt;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    this.departmentIds = const [],
    this.leadsDepartmentIds = const [],
    this.profileImage,
    this.isActive = true,
    this.pushEnabled = false,
    this.lifeGroup,
    this.isStudent = false,
    this.institutionId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AppUser.fromMap(Map<String, dynamic> map) => AppUser(
        id: asString(map['id']),
        name: asString(map['name']),
        email: asString(map['email']),
        phone: asStringOrNull(map['phone']),
        role: asString(map['role'], UserRole.member),
        departmentIds: asStringList(map['departmentIds']),
        leadsDepartmentIds: asStringList(map['leadsDepartmentIds']),
        profileImage: asStringOrNull(map['profileImage']),
        isActive: asBool(map['isActive'], true),
        pushEnabled: asBool(map['pushEnabled']),
        lifeGroup: asStringOrNull(map['lifeGroup']),
        isStudent: asBool(map['isStudent']),
        institutionId: asStringOrNull(map['institutionId']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );

  String get initial => name.isEmpty ? '?' : name[0].toUpperCase();
}

class Institution {
  final String id;
  final String name;
  final bool isActive;
  final int order;
  final DateTime createdAt;

  const Institution({
    required this.id,
    required this.name,
    this.isActive = true,
    this.order = 0,
    required this.createdAt,
  });

  factory Institution.fromMap(Map<String, dynamic> map) => Institution(
        id: asString(map['id']),
        name: asString(map['name']),
        isActive: asBool(map['isActive'], true),
        order: asInt(map['order']),
        createdAt: parseDate(map['createdAt']),
      );
}
