import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/app_user.dart';

class AuthService {
  AuthService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    GoogleSignIn? googleSignIn,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _db = firestore ?? FirebaseFirestore.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn();

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  final GoogleSignIn _googleSignIn;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<UserCredential> signInWithEmail({
    required String email,
    required String password,
  }) {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<UserCredential> registerWithEmail({
    required String name,
    required String email,
    required String password,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await cred.user?.updateDisplayName(name);
    await _bootstrapUserDoc(cred.user!, displayNameOverride: name);
    return cred;
  }

  Future<UserCredential?> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) return null;

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    final cred = await _auth.signInWithCredential(credential);
    await _bootstrapUserDoc(cred.user!);
    return cred;
  }

  Future<void> sendPasswordReset(String email) {
    return _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }

  /// Reads the Firestore user document for the signed-in user. Returns null
  /// if the document hasn't been created yet (e.g. mid-bootstrap).
  Stream<AppUser?> userDocStream(String uid) {
    return _db.collection('users').doc(uid).snapshots().map((snap) {
      final data = snap.data();
      if (data == null) return null;
      return AppUser.fromMap(snap.id, data);
    });
  }

  /// Ensures a `users/{uid}` document exists for the signed-in account. This
  /// mirrors the web app's POST /api/auth/login bootstrap.
  Future<void> _bootstrapUserDoc(
    User firebaseUser, {
    String? displayNameOverride,
  }) async {
    final ref = _db.collection('users').doc(firebaseUser.uid);
    final snap = await ref.get();
    if (snap.exists) return;

    final now = FieldValue.serverTimestamp();
    await ref.set({
      'name': displayNameOverride ??
          firebaseUser.displayName ??
          firebaseUser.email?.split('@').first ??
          'New Member',
      'email': firebaseUser.email ?? '',
      'phone': firebaseUser.phoneNumber,
      'role': 'MEMBER',
      'departmentIds': <String>[],
      'leadsDepartmentIds': <String>[],
      'profileImage': firebaseUser.photoURL,
      'isActive': true,
      'isStudent': false,
      'institutionId': null,
      'lifeGroup': null,
      'createdAt': now,
      'updatedAt': now,
    });
  }
}
