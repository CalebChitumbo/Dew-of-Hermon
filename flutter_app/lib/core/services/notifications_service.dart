import 'package:cloud_firestore/cloud_firestore.dart';

import '../firestore/converters.dart';
import '../models/misc.dart';

/// Port of `src/hooks/useNotifications.ts` — a realtime stream of the
/// caller's notifications, newest first.
class NotificationsService {
  NotificationsService._();

  static Stream<List<AppNotification>> streamForUser(String uid) =>
      FirebaseFirestore.instance
          .collection('notifications')
          .where('userId', isEqualTo: uid)
          .orderBy('createdAt', descending: true)
          .snapshots()
          .map((snapshot) => snapshot.docs
              .map((doc) => AppNotification.fromMap(docData(doc)))
              .toList());

  static Future<void> markRead(String id) => FirebaseFirestore.instance
      .collection('notifications')
      .doc(id)
      .update({'isRead': true});

  static Future<void> markAllRead(List<AppNotification> unread) async {
    final batch = FirebaseFirestore.instance.batch();
    for (final n in unread) {
      batch.update(
        FirebaseFirestore.instance.collection('notifications').doc(n.id),
        {'isRead': true},
      );
    }
    await batch.commit();
  }
}
