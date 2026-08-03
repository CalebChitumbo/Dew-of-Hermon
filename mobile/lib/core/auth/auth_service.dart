import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api_client.dart';

/// Sign-in, registration and sign-out.
///
/// The flow mirrors `AuthContext.tsx`: Firebase Auth mints the credential,
/// then `POST /api/auth/login` is called with the ID token in the **body** so
/// the server can create the user profile on first sign-in. That route already
/// verifies the body token, so mobile needs nothing from it but a 2xx — the
/// `Set-Cookie` it returns is meaningless here and simply ignored.
class AuthService {
  AuthService({
    FirebaseAuth? auth,
    GoogleSignIn? googleSignIn,
    ApiClient? api,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _google = googleSignIn ?? GoogleSignIn(scopes: const ['email']),
        _api = api ?? ApiClient();

  final FirebaseAuth _auth;
  final GoogleSignIn _google;
  final ApiClient _api;

  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  Future<void> _createProfile(
    User user, {
    bool isGoogleSignIn = false,
    String? registrationName,
    String? lifeGroup,
    bool? isStudent,
    String? institutionId,
  }) async {
    final idToken = await user.getIdToken();
    await _api.post('/api/auth/login', body: {
      'idToken': idToken,
      'isGoogleSignIn': isGoogleSignIn,
      if (registrationName != null) 'registrationName': registrationName,
      if (lifeGroup != null) 'lifeGroup': lifeGroup,
      if (isStudent != null) 'isStudent': isStudent,
      if (institutionId != null) 'institutionId': institutionId,
    });
  }

  Future<void> signIn(String email, String password) async {
    final cred = await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = cred.user;
    if (user != null) await _createProfile(user);
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    String? lifeGroup,
    bool? isStudent,
    String? institutionId,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = cred.user;
    if (user == null) {
      throw FirebaseAuthException(
        code: 'user-null',
        message: 'Account creation did not return a user.',
      );
    }
    try {
      await user.updateDisplayName(name);
      // The profile document is created server-side, avoiding client-side
      // Firestore permission issues on a brand-new account.
      await _createProfile(
        user,
        registrationName: name,
        lifeGroup: lifeGroup,
        isStudent: isStudent,
        institutionId: institutionId,
      );
    } catch (_) {
      // If anything fails after the auth user exists, remove it so the
      // person can retry without hitting "email already in use".
      await user.delete();
      rethrow;
    }
  }

  Future<void> signInWithGoogle() async {
    final account = await _google.signIn();
    if (account == null) {
      // The person backed out of the Google sheet — not an error.
      throw const AuthCancelled();
    }
    final googleAuth = await account.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    final cred = await _auth.signInWithCredential(credential);
    final user = cred.user;
    if (user != null) await _createProfile(user, isGoogleSignIn: true);
  }

  Future<void> sendPasswordReset(String email) =>
      _auth.sendPasswordResetEmail(email: email.trim());

  Future<void> signOut() async {
    try {
      await _google.signOut();
    } catch (_) {
      // Not signed in with Google — nothing to do.
    }
    await _auth.signOut();
  }

  /// Turn a Firebase error code into the wording the web shows.
  static String describeError(Object error) {
    if (error is AuthCancelled) return 'Sign-in cancelled.';
    if (error is FirebaseAuthException) {
      return switch (error.code) {
        'invalid-email' => 'That email address does not look right.',
        'user-disabled' => 'This account has been disabled.',
        'user-not-found' ||
        'wrong-password' ||
        'invalid-credential' =>
          'Wrong email or password.',
        'email-already-in-use' =>
          'An account already exists with that email. Sign in instead.',
        'weak-password' => 'Choose a password of at least 6 characters.',
        'too-many-requests' =>
          'Too many attempts. Wait a moment and try again.',
        'network-request-failed' =>
          'No connection. Check your network and try again.',
        'operation-not-allowed' =>
          'That sign-in method is not enabled for this project.',
        _ => error.message ?? 'Sign-in failed. Please try again.',
      };
    }
    if (error is ApiException) return error.message;
    return 'Something went wrong. Please try again.';
  }
}

/// The person dismissed the Google account picker.
class AuthCancelled implements Exception {
  const AuthCancelled();
  @override
  String toString() => 'Sign-in cancelled';
}
