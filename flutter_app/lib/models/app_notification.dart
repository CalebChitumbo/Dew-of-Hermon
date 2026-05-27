import '../core/firebase_helpers.dart';
import 'enums.dart';

class AppNotification {
  AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.emailStatus,
    required this.createdAt,
    this.link,
    this.emailDocId,
    this.emailError,
  });

  final String id;
  final String userId;
  final String title;
  final String message;
  final NotificationType type;
  final bool isRead;
  final String? link;
  final EmailDeliveryStatus emailStatus;
  final String? emailDocId;
  final String? emailError;
  final DateTime createdAt;

  factory AppNotification.fromMap(String id, Map<String, dynamic> data) {
    return AppNotification(
      id: id,
      userId: data['userId'] as String? ?? '',
      title: data['title'] as String? ?? '',
      message: data['message'] as String? ?? '',
      type: parseEnum(
        data['type'],
        NotificationType.values,
        NotificationType.announcement,
      ),
      isRead: data['isRead'] as bool? ?? false,
      link: data['link'] as String?,
      emailStatus: parseEnum(
        data['emailStatus'],
        EmailDeliveryStatus.values,
        EmailDeliveryStatus.pending,
      ),
      emailDocId: data['emailDocId'] as String?,
      emailError: data['emailError'] as String?,
      createdAt: readTimestampOrNow(data['createdAt']),
    );
  }
}
