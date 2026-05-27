import '../core/firebase_helpers.dart';

class Affirmation {
  Affirmation({
    required this.id,
    required this.title,
    required this.content,
    required this.authorId,
    required this.authorName,
    required this.createdAt,
    required this.updatedAt,
    this.serviceId,
  });

  final String id;
  final String title;
  final String content;
  final String? serviceId;
  final String authorId;
  final String authorName;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Affirmation.fromMap(String id, Map<String, dynamic> data) {
    return Affirmation(
      id: id,
      title: data['title'] as String? ?? '',
      content: data['content'] as String? ?? '',
      serviceId: data['serviceId'] as String?,
      authorId: data['authorId'] as String? ?? '',
      authorName: data['authorName'] as String? ?? '',
      createdAt: readTimestampOrNow(data['createdAt']),
      updatedAt: readTimestampOrNow(data['updatedAt']),
    );
  }
}
