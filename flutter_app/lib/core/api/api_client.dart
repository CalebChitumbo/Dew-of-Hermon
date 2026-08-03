import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:path_provider/path_provider.dart';

import '../config.dart';

/// Thrown for non-2xx API responses, carrying the server's `{ error }` text.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? body;

  ApiException(this.statusCode, this.message, [this.body]);

  @override
  String toString() => message;
}

/// HTTP client for the deployed web app's API.
///
/// Mirrors the web client exactly:
/// - a `session` cookie (minted by `POST /api/auth/login` from a Firebase ID
///   token) authenticates every call;
/// - on a 401 with a signed-in Firebase user, the cookie is refreshed with a
///   fresh ID token and the request retried once (`src/lib/fetchWithAuth.ts`).
class ApiClient {
  ApiClient._(this._dio, this._cookieJar);

  final Dio _dio;
  final CookieJar _cookieJar;

  static Future<ApiClient> create() async {
    Directory? dir;
    try {
      dir = await getApplicationSupportDirectory();
    } catch (_) {
      dir = null; // e.g. tests — fall back to an in-memory jar
    }
    final jar = dir == null
        ? CookieJar()
        : PersistCookieJar(storage: FileStorage('${dir.path}/cookies'));

    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json'},
        // Let us surface the server's JSON error body ourselves.
        validateStatus: (_) => true,
      ),
    );
    dio.interceptors.add(CookieManager(jar));
    return ApiClient._(dio, jar);
  }

  /// Exchange a Firebase ID token for the API session cookie.
  /// Also creates the user document on first login (server-side).
  Future<Map<String, dynamic>> createSession({
    required String idToken,
    bool isGoogleSignIn = false,
    String? registrationName,
    Map<String, dynamic>? extra,
  }) async {
    final res = await _dio.post<dynamic>('/api/auth/login', data: {
      'idToken': idToken,
      'isGoogleSignIn': isGoogleSignIn,
      if (registrationName != null) 'registrationName': registrationName,
      ...?extra,
    });
    return _unwrap(res);
  }

  /// `DELETE /api/auth/session` then clear the local cookie store.
  Future<void> destroySession() async {
    try {
      await _dio.delete<dynamic>('/api/auth/session');
    } catch (_) {
      // Best effort — sign-out must always succeed locally.
    }
    await _cookieJar.deleteAll();
  }

  Future<Map<String, dynamic>> get(String path,
          {Map<String, dynamic>? query}) =>
      _request('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, {Object? body}) =>
      _request('POST', path, body: body);

  Future<Map<String, dynamic>> patch(String path, {Object? body}) =>
      _request('PATCH', path, body: body);

  Future<Map<String, dynamic>> put(String path, {Object? body}) =>
      _request('PUT', path, body: body);

  Future<Map<String, dynamic>> delete(String path, {Object? body}) =>
      _request('DELETE', path, body: body);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
  }) async {
    Future<Response<dynamic>> send() => _dio.request<dynamic>(
          path,
          queryParameters: query,
          data: body,
          options: Options(method: method),
        );

    var res = await send();

    // Session cookie likely expired — refresh it and retry once.
    if (res.statusCode == 401) {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        try {
          final idToken = await user.getIdToken(true);
          final login = await _dio.post<dynamic>('/api/auth/login',
              data: {'idToken': idToken});
          if ((login.statusCode ?? 500) < 300) {
            res = await send();
          }
        } catch (_) {
          // fall through with the original 401
        }
      }
    }

    return _unwrap(res);
  }

  Map<String, dynamic> _unwrap(Response<dynamic> res) {
    final status = res.statusCode ?? 0;
    final data = res.data;
    final map = data is Map
        ? Map<String, dynamic>.from(data)
        : <String, dynamic>{if (data != null) 'data': data};
    if (status >= 200 && status < 300) return map;
    final message = (map['error'] ?? 'Request failed ($status)').toString();
    throw ApiException(status, message, map);
  }
}
