import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/user.dart';
import '../utils/firestore_parse.dart';
import 'auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) => AuthService());

/// The raw Firebase credential. Null when signed out.
final firebaseUserProvider = StreamProvider<fb.User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

/// The signed-in member's profile document, live.
///
/// Mirrors `AuthContext`: the auth state gives us a uid, then we subscribe to
/// `users/{uid}` so a role or department change lands on the device without a
/// restart — which matters when the Chairperson grants camp access mid-camp.
final currentUserProvider = StreamProvider<AppUser?>((ref) {
  final auth = ref.watch(firebaseUserProvider);

  return auth.when(
    loading: () => const Stream<AppUser?>.empty(),
    error: (_, __) => Stream<AppUser?>.value(null),
    data: (user) {
      if (user == null) return Stream<AppUser?>.value(null);
      return FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .snapshots()
          .map((snap) => snap.exists ? AppUser.fromMap(withId(snap)) : null)
          .handleError((_) => null);
    },
  );
});

/// True once we know whether someone is signed in — used to hold the router
/// on the splash screen rather than flashing the login page.
final authReadyProvider = Provider<bool>((ref) {
  final auth = ref.watch(firebaseUserProvider);
  if (auth.isLoading) return false;
  // Signed out: nothing more to wait for.
  if (auth.valueOrNull == null) return true;
  // Signed in: wait for the profile document too, so role-dependent nav is
  // right on the very first frame.
  return !ref.watch(currentUserProvider).isLoading;
});

/// Convenience: the profile, or null while loading/signed out.
final userOrNullProvider = Provider<AppUser?>(
  (ref) => ref.watch(currentUserProvider).valueOrNull,
);
