import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// A member of the ministry. Mirrors `User` in `src/types/index.ts`.
class AppUser {
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
    this.pushEnabled,
    this.lifeGroup,
    this.isStudent = false,
    this.institutionId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AppUser.fromMap(Map<String, dynamic> map) {
    return AppUser(
      id: parseStringOr(map['id']),
      name: parseStringOr(map['name']),
      email: parseStringOr(map['email']),
      phone: parseString(map['phone']),
      role: UserRole.fromWire(map['role']),
      departmentIds: parseStringList(map['departmentIds']),
      leadsDepartmentIds: parseStringList(map['leadsDepartmentIds']),
      profileImage: parseString(map['profileImage']),
      isActive: parseBool(map['isActive'], fallback: true),
      pushEnabled: map['pushEnabled'] == null
          ? null
          : parseBool(map['pushEnabled']),
      lifeGroup: LifeGroup.fromWireOrNull(map['lifeGroup']),
      isStudent: parseBool(map['isStudent']),
      institutionId: parseString(map['institutionId']),
      createdAt: parseDateOr(map['createdAt'], DateTime.now()),
      updatedAt: parseDateOr(map['updatedAt'], DateTime.now()),
    );
  }

  final String id;
  final String name;
  final String email;
  final String? phone;
  final UserRole role;
  final List<String> departmentIds;
  final List<String> leadsDepartmentIds;
  final String? profileImage;
  final bool isActive;
  final bool? pushEnabled;
  final LifeGroup? lifeGroup;
  final bool isStudent;
  final String? institutionId;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, dynamic> toMap() => {
        'name': name,
        'email': email,
        'phone': phone,
        'role': role.wire,
        'departmentIds': departmentIds,
        'leadsDepartmentIds': leadsDepartmentIds,
        'profileImage': profileImage,
        'isActive': isActive,
        if (pushEnabled != null) 'pushEnabled': pushEnabled,
        'lifeGroup': lifeGroup?.wire,
        'isStudent': isStudent,
        'institutionId': institutionId,
      };

  /// First name, for greetings ("Good morning, Caleb").
  String get firstName {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'there';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  /// Two-letter monogram for the avatar fallback.
  String get initials {
    final parts =
        name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  bool get isAdmin =>
      role == UserRole.superAdmin ||
      role == UserRole.admin ||
      role == UserRole.viceChairperson;

  bool leads(String departmentId) => leadsDepartmentIds.contains(departmentId);
  bool belongsTo(String departmentId) => departmentIds.contains(departmentId);
}

/// A ministry department. Mirrors `Department`.
class Department {
  const Department({
    required this.id,
    required this.name,
    this.description,
    this.icon = 'Users',
    this.order = 0,
    required this.createdAt,
  });

  factory Department.fromMap(Map<String, dynamic> map) {
    return Department(
      id: parseStringOr(map['id']),
      name: parseStringOr(map['name']),
      description: parseString(map['description']),
      icon: parseStringOr(map['icon'], 'Users'),
      order: parseIntOr(map['order']),
      createdAt: parseDateOr(map['createdAt']),
    );
  }

  final String id;
  final String name;
  final String? description;
  final String icon;
  final int order;
  final DateTime createdAt;

  Map<String, dynamic> toMap() => {
        'name': name,
        'description': description,
        'icon': icon,
        'order': order,
      };
}

/// A school/college a student member belongs to. Mirrors `Institution`.
class Institution {
  const Institution({
    required this.id,
    required this.name,
    this.isActive = true,
    this.order = 0,
    required this.createdAt,
  });

  factory Institution.fromMap(Map<String, dynamic> map) => Institution(
        id: parseStringOr(map['id']),
        name: parseStringOr(map['name']),
        isActive: parseBool(map['isActive'], fallback: true),
        order: parseIntOr(map['order']),
        createdAt: parseDateOr(map['createdAt']),
      );

  final String id;
  final String name;
  final bool isActive;
  final int order;
  final DateTime createdAt;

  Map<String, dynamic> toMap() =>
      {'name': name, 'isActive': isActive, 'order': order};
}
