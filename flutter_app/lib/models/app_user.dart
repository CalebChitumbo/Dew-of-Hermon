import '../core/firebase_helpers.dart';
import 'enums.dart';

class AppUser {
  AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.departmentIds,
    required this.leadsDepartmentIds,
    required this.isActive,
    required this.isStudent,
    required this.createdAt,
    required this.updatedAt,
    this.phone,
    this.profileImage,
    this.pushEnabled,
    this.lifeGroup,
    this.institutionId,
  });

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

  factory AppUser.fromMap(String id, Map<String, dynamic> data) {
    return AppUser(
      id: id,
      name: data['name'] as String? ?? '',
      email: data['email'] as String? ?? '',
      phone: data['phone'] as String?,
      role: parseEnum(data['role'], UserRole.values, UserRole.MEMBER),
      departmentIds: readStringList(data['departmentIds']),
      leadsDepartmentIds: readStringList(data['leadsDepartmentIds']),
      profileImage: data['profileImage'] as String?,
      isActive: data['isActive'] as bool? ?? true,
      pushEnabled: data['pushEnabled'] as bool?,
      lifeGroup: data['lifeGroup'] is String
          ? parseEnum<LifeGroup>(
              data['lifeGroup'],
              LifeGroup.values,
              LifeGroup.BRIDGE,
            )
          : null,
      isStudent: data['isStudent'] as bool? ?? false,
      institutionId: data['institutionId'] as String?,
      createdAt: readTimestampOrNow(data['createdAt']),
      updatedAt: readTimestampOrNow(data['updatedAt']),
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'email': email,
        'phone': phone,
        'role': role.name,
        'departmentIds': departmentIds,
        'leadsDepartmentIds': leadsDepartmentIds,
        'profileImage': profileImage,
        'isActive': isActive,
        'pushEnabled': pushEnabled,
        'lifeGroup': lifeGroup?.name,
        'isStudent': isStudent,
        'institutionId': institutionId,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  bool get isAdmin =>
      role == UserRole.SUPER_ADMIN || role == UserRole.ADMIN;
}
