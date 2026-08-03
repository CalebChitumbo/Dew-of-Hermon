import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// An in-app notification. Mirrors `Notification` in `src/types/index.ts`.
/// Named `AppNotification` because `Notification` is taken by Flutter.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.type,
    this.isRead = false,
    this.link,
    this.emailStatus = EmailDeliveryStatus.pending,
    this.emailDocId,
    this.emailError,
    required this.createdAt,
  });

  factory AppNotification.fromMap(Map<String, dynamic> map) {
    return AppNotification(
      id: parseStringOr(map['id']),
      userId: parseStringOr(map['userId']),
      title: parseStringOr(map['title']),
      message: parseStringOr(map['message']),
      type: NotificationType.fromWire(map['type']),
      isRead: parseBool(map['isRead']),
      link: parseString(map['link']),
      emailStatus: EmailDeliveryStatus.fromWire(map['emailStatus']),
      emailDocId: parseString(map['emailDocId']),
      emailError: parseString(map['emailError']),
      createdAt: parseDateOr(map['createdAt']),
    );
  }

  final String id;
  final String userId;
  final String title;
  final String message;
  final NotificationType type;
  final bool isRead;

  /// An in-app path — the same value a push notification carries, so tapping
  /// either lands on the same screen.
  final String? link;

  final EmailDeliveryStatus emailStatus;
  final String? emailDocId;
  final String? emailError;
  final DateTime createdAt;
}
