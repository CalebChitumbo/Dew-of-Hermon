import '../core/firebase_helpers.dart';

class Department {
  Department({
    required this.id,
    required this.name,
    required this.icon,
    required this.order,
    required this.createdAt,
    this.description,
  });

  final String id;
  final String name;
  final String? description;
  final String icon;
  final int order;
  final DateTime createdAt;

  factory Department.fromMap(String id, Map<String, dynamic> data) {
    return Department(
      id: id,
      name: data['name'] as String? ?? '',
      description: data['description'] as String?,
      icon: data['icon'] as String? ?? '',
      order: (data['order'] as num?)?.toInt() ?? 0,
      createdAt: readTimestampOrNow(data['createdAt']),
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'description': description,
        'icon': icon,
        'order': order,
        'createdAt': createdAt,
      };
}
