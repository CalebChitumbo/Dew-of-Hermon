import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/utils/firestore_parse.dart';

/// Live Firestore reads.
///
/// The mobile app reads collections directly with `snapshots()` — the same
/// pattern the web uses with `onSnapshot`, guarded by the already-deployed
/// `firestore.rules`. Writes never go through here; they go through the API
/// routes so all the server-side validation stays in one place.

FirebaseFirestore get db => FirebaseFirestore.instance;

/// Map a query snapshot to models, tolerating a single malformed document.
List<T> mapDocs<T>(
  QuerySnapshot<Map<String, dynamic>> snap,
  T Function(Map<String, dynamic>) fromMap,
) {
  final out = <T>[];
  for (final doc in snap.docs) {
    try {
      out.add(fromMap({...doc.data(), 'id': doc.id}));
    } catch (_) {
      // One bad row must not blank the whole list.
    }
  }
  return out;
}

/// A live collection stream, mapped and sorted.
Stream<List<T>> collectionStream<T>(
  Query<Map<String, dynamic>> query,
  T Function(Map<String, dynamic>) fromMap, {
  int Function(T, T)? sort,
}) {
  return query.snapshots().map((snap) {
    final items = mapDocs(snap, fromMap);
    if (sort != null) items.sort(sort);
    return items;
  });
}

/// A live single-document stream.
Stream<T?> documentStream<T>(
  DocumentReference<Map<String, dynamic>> ref,
  T Function(Map<String, dynamic>) fromMap,
) {
  return ref.snapshots().map((snap) {
    if (!snap.exists) return null;
    try {
      return fromMap(withId(snap));
    } catch (_) {
      return null;
    }
  });
}

// ─── Notifications ───

/// Unread notification count for the bell badge.
final unreadNotificationCountProvider = StreamProvider<int>((ref) {
  final user = ref.watch(userOrNullProvider);
  if (user == null) return Stream.value(0);
  return db
      .collection('notifications')
      .where('userId', isEqualTo: user.id)
      .where('isRead', isEqualTo: false)
      .snapshots()
      .map((s) => s.docs.length)
      .handleError((_) => 0);
});
