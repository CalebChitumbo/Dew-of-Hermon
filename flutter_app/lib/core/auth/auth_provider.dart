import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api_client.dart';
import '../config.dart';
import '../firestore/converters.dart';
import '../models/user.dart';

/// Port of `src/contexts/AuthContext.tsx`.
///
/// Holds the Firebase user, streams the caller's `users/{uid}` document in
/// realtime, and runs the session-cookie handshake against the API on every
/// sign-in (which also creates the user document on first registration).
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api) {
    _authSub = fb.FirebaseAuth.instance.authStateChanges().listen(_onAuth);
  }

  final ApiClient _api;

  fb.User? firebaseUser;
  AppUser? userData;
  bool loading = true;

  StreamSubscription<fb.User?>? _authSub;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _userDocSub;

  bool get isSignedIn => firebaseUser != null;

  void _onAuth(fb.User? user) {
    firebaseUser = user;
    _userDocSub?.cancel();
    _userDocSub = null;

    if (user == null) {
      userData = null;
      loading = false;
      notifyListeners();
      return;
    }

    _userDocSub = FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .snapshots()
        .listen((snapshot) {
      userData = snapshot.exists ? AppUser.fromMap(docData(snapshot)) : null;
      loading = false;
      notifyListeners();
    }, onError: (Object error) {
      debugPrint('Error listening to user document: $error');
      userData = null;
      loading = false;
      notifyListeners();
    });
    notifyListeners();
  }

  Future<void> _createSession(
    fb.User user, {
    bool isGoogleSignIn = false,
    String? registrationName,
    Map<String, dynamic>? extra,
  }) async {
    final idToken = await user.getIdToken();
    await _api.createSession(
      idToken: idToken!,
      isGoogleSignIn: isGoogleSignIn,
      registrationName: registrationName,
      extra: extra,
    );
  }

  Future<void> signIn(String email, String password) async {
    final cred = await fb.FirebaseAuth.instance
        .signInWithEmailAndPassword(email: email, password: password);
    await _createSession(cred.user!);
  }

  /// Mirrors web sign-up: create the auth user, then let the server create
  /// the user document; on any failure the auth user is deleted so the email
  /// can be retried.
  Future<void> signUp(
    String email,
    String password,
    String name, {
    String? lifeGroup,
    bool? isStudent,
    String? institutionId,
  }) async {
    final cred = await fb.FirebaseAuth.instance
        .createUserWithEmailAndPassword(email: email, password: password);
    try {
      await cred.user!.updateDisplayName(name);
      await _createSession(
        cred.user!,
        registrationName: name,
        extra: {
          if (lifeGroup != null) 'lifeGroup': lifeGroup,
          if (isStudent != null) 'isStudent': isStudent,
          if (institutionId != null) 'institutionId': institutionId,
        },
      );
    } catch (e) {
      await cred.user!.delete();
      rethrow;
    }
  }

  Future<void> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn(
      serverClientId: AppConfig.googleServerClientId.isEmpty
          ? null
          : AppConfig.googleServerClientId,
    );
    final account = await googleSignIn.signIn();
    if (account == null) return; // user cancelled
    final auth = await account.authentication;
    final credential = fb.GoogleAuthProvider.credential(
      idToken: auth.idToken,
      accessToken: auth.accessToken,
    );
    final cred =
        await fb.FirebaseAuth.instance.signInWithCredential(credential);
    await _createSession(cred.user!, isGoogleSignIn: true);
  }

  Future<void> sendPasswordReset(String email) =>
      fb.FirebaseAuth.instance.sendPasswordResetEmail(email: email);

  Future<void> signOut() async {
    await _api.destroySession();
    await fb.FirebaseAuth.instance.signOut();
    userData = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _userDocSub?.cancel();
    super.dispose();
  }
}
