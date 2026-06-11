import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/models.dart';

/// Mirrors the website's AuthContext:
///  - Firebase Auth holds the identity (same users as the web app).
///  - A real-time listener on users/{uid} supplies the profile/role.
///  - Signing in also POSTs the ID token to /api/auth/login so the REST
///    API session cookie exists (and the user doc is auto-created on first
///    registration, server-side, exactly like the website).
class AuthService extends ChangeNotifier {
  AuthService(this.api) {
    _authSub = fb.FirebaseAuth.instance.authStateChanges().listen(_onAuth);
  }

  final ApiClient api;

  fb.User? firebaseUser;
  UserProfile? profile;
  bool loading = true;

  StreamSubscription<fb.User?>? _authSub;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _profileSub;

  void _onAuth(fb.User? user) {
    firebaseUser = user;
    _profileSub?.cancel();
    _profileSub = null;

    if (user == null) {
      profile = null;
      loading = false;
      notifyListeners();
      return;
    }

    loading = profile == null;
    notifyListeners();

    _profileSub = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots()
        .listen(
      (snapshot) {
        profile = snapshot.exists
            ? UserProfile.fromMap(snapshot.id, snapshot.data()!)
            : null;
        loading = false;
        notifyListeners();
      },
      onError: (Object error) {
        debugPrint('users/${user.uid} listener error: $error');
        profile = null;
        loading = false;
        notifyListeners();
      },
    );
  }

  Future<void> signIn(String email, String password) async {
    final auth = fb.FirebaseAuth.instance;
    await auth.signInWithEmailAndPassword(email: email, password: password);
    try {
      await api.createSession();
    } on ApiException catch (_) {
      // The backend refused the session (e.g. deactivated account).
      // Leave no half-signed-in state behind.
      await auth.signOut();
      rethrow;
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    String? lifeGroup,
    bool isStudent = false,
    String? institutionId,
  }) async {
    final auth = fb.FirebaseAuth.instance;
    final cred = await auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    try {
      await cred.user?.updateDisplayName(name);
      // The user doc is created server-side by /api/auth/login, exactly
      // like web registration.
      await api.createSession(
        registrationName: name,
        lifeGroup: lifeGroup,
        isStudent: isStudent,
        institutionId: institutionId,
      );
    } catch (e) {
      // Roll back the auth user so the email can be reused on retry.
      try {
        await cred.user?.delete();
      } catch (_) {}
      rethrow;
    }
  }

  Future<void> sendPasswordReset(String email) =>
      fb.FirebaseAuth.instance.sendPasswordResetEmail(email: email);

  Future<void> signOut() async {
    await api.destroySession();
    await fb.FirebaseAuth.instance.signOut();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _profileSub?.cancel();
    super.dispose();
  }
}
