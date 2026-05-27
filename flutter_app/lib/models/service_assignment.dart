import '../core/firebase_helpers.dart';
import 'enums.dart';

class ServiceAssignment {
  ServiceAssignment({
    required this.id,
    required this.serviceId,
    required this.roleId,
    required this.roleName,
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.status,
    required this.emailSent,
    required this.createdAt,
    required this.updatedAt,
    this.userPhone,
    this.emailSentAt,
    this.confirmedAt,
    this.notes,
  });

  final String id;
  final String serviceId;
  final String roleId;
  final String roleName;
  final String userId;
  final String userName;
  final String userEmail;
  final String? userPhone;
  final AssignmentStatus status;
  final bool emailSent;
  final DateTime? emailSentAt;
  final DateTime? confirmedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory ServiceAssignment.fromMap(String id, Map<String, dynamic> data) {
    return ServiceAssignment(
      id: id,
      serviceId: data['serviceId'] as String? ?? '',
      roleId: data['roleId'] as String? ?? '',
      roleName: data['roleName'] as String? ?? '',
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String? ?? '',
      userEmail: data['userEmail'] as String? ?? '',
      userPhone: data['userPhone'] as String?,
      status: parseEnum(
        data['status'],
        AssignmentStatus.values,
        AssignmentStatus.PENDING,
      ),
      emailSent: data['emailSent'] as bool? ?? false,
      emailSentAt: readTimestamp(data['emailSentAt']),
      confirmedAt: readTimestamp(data['confirmedAt']),
      notes: data['notes'] as String?,
      createdAt: readTimestampOrNow(data['createdAt']),
      updatedAt: readTimestampOrNow(data['updatedAt']),
    );
  }
}
