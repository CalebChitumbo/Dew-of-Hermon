import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/affirmation.dart';
import '../models/app_event.dart';
import '../models/app_notification.dart';
import '../models/department.dart';
import '../models/service_assignment.dart';

/// Thin wrappers around the Firestore collections used by the web app.
/// Collection names and field shapes mirror `src/lib/firebase.ts` so both
/// clients can read/write the same documents.
class FirestoreService {
  FirestoreService([FirebaseFirestore? db])
      : _db = db ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;

  Stream<List<Department>> watchDepartments() {
    return _db
        .collection('departments')
        .orderBy('order')
        .snapshots()
        .map((s) => s.docs.map((d) => Department.fromMap(d.id, d.data())).toList());
  }

  Stream<List<AppEvent>> watchUpcomingEvents({int limit = 20}) {
    return _db
        .collection('events')
        .where('startDate', isGreaterThanOrEqualTo: DateTime.now())
        .orderBy('startDate')
        .limit(limit)
        .snapshots()
        .map((s) => s.docs.map((d) => AppEvent.fromMap(d.id, d.data())).toList());
  }

  Stream<List<ServiceAssignment>> watchAssignmentsForUser(String userId) {
    return _db
        .collection('serviceAssignments')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (s) => s.docs
              .map((d) => ServiceAssignment.fromMap(d.id, d.data()))
              .toList(),
        );
  }

  Stream<List<AppNotification>> watchNotificationsForUser(String userId) {
    return _db
        .collection('notifications')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(100)
        .snapshots()
        .map(
          (s) => s.docs
              .map((d) => AppNotification.fromMap(d.id, d.data()))
              .toList(),
        );
  }

  Stream<List<Affirmation>> watchAffirmations({int limit = 50}) {
    return _db
        .collection('affirmations')
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map(
          (s) => s.docs.map((d) => Affirmation.fromMap(d.id, d.data())).toList(),
        );
  }

  Future<void> markNotificationRead(String notificationId) {
    return _db
        .collection('notifications')
        .doc(notificationId)
        .update({'isRead': true});
  }

  Future<void> updateAssignmentStatus(
    String assignmentId,
    String newStatus,
  ) {
    return _db.collection('serviceAssignments').doc(assignmentId).update({
      'status': newStatus,
      if (newStatus == 'CONFIRMED') 'confirmedAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}

final firestoreServiceProvider =
    Provider<FirestoreService>((ref) => FirestoreService());
