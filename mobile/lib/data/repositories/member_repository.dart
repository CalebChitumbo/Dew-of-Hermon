import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../firestore/streams.dart';
import '../models/enums.dart';
import '../models/user.dart';

/// The member roll, and the admin edits to it.
///
/// Reads come straight from Firestore — `users` is readable by any signed-in
/// member, the same as on the web — while every write goes through
/// `/api/members`, which enforces who may change whose role.
class MemberRepository {
  MemberRepository(this._api);

  final ApiClient _api;

  Stream<List<AppUser>> membersStream() {
    return collectionStream(
      db.collection('users'),
      AppUser.fromMap,
      sort: (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
    );
  }

  Stream<AppUser?> memberStream(String id) =>
      documentStream(db.collection('users').doc(id), AppUser.fromMap);

  /// Institutions in the order the Chairperson arranged them, name-sorted
  /// within an equal `order`.
  Stream<List<Institution>> institutionsStream() {
    return collectionStream(
      db.collection('institutions'),
      Institution.fromMap,
      sort: (a, b) {
        final byOrder = a.order.compareTo(b.order);
        return byOrder != 0
            ? byOrder
            : a.name.toLowerCase().compareTo(b.name.toLowerCase());
      },
    ).handleError((_) => <Institution>[]);
  }

  /// Create the member record. The server also provisions the Firebase Auth
  /// user and emails them a set-password link.
  Future<void> create({
    required String name,
    required String email,
    required UserRole role,
    String? phone,
    List<String> departmentIds = const [],
    bool isStudent = false,
    String? institutionId,
    LifeGroup? lifeGroup,
  }) =>
      _api.post('/api/members', body: {
        'name': name,
        'email': email,
        'role': role.wire,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'departmentIds': departmentIds,
        'isStudent': isStudent,
        if (institutionId != null) 'institutionId': institutionId,
        if (lifeGroup != null) 'lifeGroup': lifeGroup.wire,
      });

  /// A full replace of the editable fields — the route takes a PUT, and a
  /// field left out is cleared, so send the whole shape.
  Future<void> update(
    String id, {
    required String name,
    required String email,
    required UserRole role,
    required List<String> departmentIds,
    required List<String> leadsDepartmentIds,
    required bool isActive,
    required bool isStudent,
    String? phone,
    String? institutionId,
    LifeGroup? lifeGroup,
  }) =>
      _api.put('/api/members/$id', body: {
        'name': name,
        'email': email,
        'role': role.wire,
        'phone': phone ?? '',
        'departmentIds': departmentIds,
        'leadsDepartmentIds': leadsDepartmentIds,
        'isActive': isActive,
        'isStudent': isStudent,
        'institutionId': institutionId,
        'lifeGroup': lifeGroup?.wire,
      });

  Future<void> setInstitution(String id, String? institutionId) =>
      _api.patch('/api/members/$id/institution',
          body: {'institutionId': institutionId});

  Future<void> remove(String id) => _api.delete('/api/members/$id');
}

final memberRepositoryProvider = Provider<MemberRepository>(
  (ref) => MemberRepository(ref.watch(apiClientProvider)),
);

/// Every member, live. Used by the roll, the assign pickers and the reports.
final membersProvider = StreamProvider<List<AppUser>>((ref) {
  return ref.watch(memberRepositoryProvider).membersStream();
});

final memberProvider = StreamProvider.family<AppUser?, String>((ref, id) {
  return ref.watch(memberRepositoryProvider).memberStream(id);
});

final institutionsProvider = StreamProvider<List<Institution>>((ref) {
  return ref.watch(memberRepositoryProvider).institutionsStream();
});

/// Just the ones still in use — what every picker should offer.
final activeInstitutionsProvider = Provider<List<Institution>>((ref) {
  final list = ref.watch(institutionsProvider).valueOrNull ?? const [];
  return list.where((i) => i.isActive).toList();
});

/// Institution id → name, for rendering a member's school without a lookup
/// at every call site.
final institutionNamesProvider = Provider<Map<String, String>>((ref) {
  final list = ref.watch(institutionsProvider).valueOrNull ?? const [];
  return {for (final i in list) i.id: i.name};
});
