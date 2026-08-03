import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';

/// Thrown for any non-2xx response from the API, carrying the server's own
/// `{ error }` message so screens can surface exactly what the web would.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message, {this.data});

  final int? statusCode;
  final String message;
  final dynamic data;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isConflict => statusCode == 409;

  /// True when the request never reached the server — the caller can retry
  /// later rather than treating it as a rejection.
  bool get isNetwork => statusCode == null;

  @override
  String toString() => message;
}

/// The app's single HTTP client for the Next.js API.
///
/// Every request carries the caller's Firebase ID token as a Bearer header;
/// the server resolves it through `getCallerToken()` exactly as it resolves
/// the web's session cookie. A 401 is retried once against a force-refreshed
/// token, which covers the one-hour token expiry without bouncing anyone to
/// the login screen mid-scan.
class ApiClient {
  ApiClient({Dio? dio, FirebaseAuth? auth})
      : _auth = auth ?? FirebaseAuth.instance,
        _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: AppConfig.connectTimeout,
              receiveTimeout: AppConfig.receiveTimeout,
              contentType: 'application/json',
              // We interpret every status ourselves so the error body is
              // never swallowed by Dio's own exception.
              validateStatus: (_) => true,
            ));

  final Dio _dio;
  final FirebaseAuth _auth;

  Future<String?> _idToken({bool forceRefresh = false}) async {
    final user = _auth.currentUser;
    if (user == null) return null;
    try {
      return await user.getIdToken(forceRefresh);
    } catch (_) {
      return null;
    }
  }

  Future<Response<dynamic>> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool forceRefresh = false,
    bool requireAuth = true,
  }) async {
    final token = await _idToken(forceRefresh: forceRefresh);
    if (token == null && requireAuth) {
      throw ApiException(401, 'You are signed out. Sign in and try again.');
    }
    return _dio.request<dynamic>(
      path,
      data: body,
      queryParameters: query,
      options: Options(
        method: method,
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ),
    );
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool requireAuth = true,
  }) async {
    Response<dynamic> res;
    try {
      res = await _send(method, path,
          body: body, query: query, requireAuth: requireAuth);

      // An expired ID token looks exactly like a revoked one from here, so
      // give a force-refreshed token one chance before surfacing the 401.
      if (res.statusCode == 401 && requireAuth) {
        res = await _send(method, path,
            body: body,
            query: query,
            forceRefresh: true,
            requireAuth: requireAuth);
      }
    } on DioException catch (e) {
      throw ApiException(null, _networkMessage(e));
    }

    final status = res.statusCode ?? 0;
    if (status >= 200 && status < 300) return res.data;

    throw ApiException(status, _errorMessage(res), data: res.data);
  }

  static String _networkMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'The request timed out. Check your connection and try again.';
      case DioExceptionType.connectionError:
        return 'No connection. Your work is saved and will sync when you are back online.';
      default:
        return e.message ?? 'Something went wrong. Please try again.';
    }
  }

  static String _errorMessage(Response<dynamic> res) {
    final data = res.data;
    if (data is Map) {
      for (final key in ['error', 'message', 'detail']) {
        final value = data[key];
        if (value is String && value.trim().isNotEmpty) return value;
      }
    }
    if (data is String && data.trim().isNotEmpty && data.length < 300) {
      return data;
    }
    return switch (res.statusCode) {
      401 => 'You are not signed in.',
      403 => 'You do not have permission to do that.',
      404 => 'Not found.',
      409 => 'That conflicts with something already recorded.',
      _ => 'Request failed (${res.statusCode}).',
    };
  }

  // ── Verbs ──

  Future<dynamic> get(String path,
          {Map<String, dynamic>? query, bool requireAuth = true}) =>
      _request('GET', path, query: query, requireAuth: requireAuth);

  Future<dynamic> post(String path,
          {Object? body,
          Map<String, dynamic>? query,
          bool requireAuth = true}) =>
      _request('POST', path,
          body: body, query: query, requireAuth: requireAuth);

  Future<dynamic> patch(String path,
          {Object? body,
          Map<String, dynamic>? query,
          bool requireAuth = true}) =>
      _request('PATCH', path,
          body: body, query: query, requireAuth: requireAuth);

  Future<dynamic> put(String path,
          {Object? body,
          Map<String, dynamic>? query,
          bool requireAuth = true}) =>
      _request('PUT', path, body: body, query: query, requireAuth: requireAuth);

  Future<dynamic> delete(String path,
          {Object? body,
          Map<String, dynamic>? query,
          bool requireAuth = true}) =>
      _request('DELETE', path,
          body: body, query: query, requireAuth: requireAuth);

  /// GET returning a map, with an empty map for a null or unexpected body.
  Future<Map<String, dynamic>> getMap(String path,
      {Map<String, dynamic>? query, bool requireAuth = true}) async {
    final data = await get(path, query: query, requireAuth: requireAuth);
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  /// GET returning a list, unwrapping the `{ key: [...] }` envelope the API
  /// routes use (e.g. `{ registrations: [...] }`).
  Future<List<Map<String, dynamic>>> getList(String path,
      {Map<String, dynamic>? query,
      String? key,
      bool requireAuth = true}) async {
    final data = await get(path, query: query, requireAuth: requireAuth);
    return unwrapList(data, key: key);
  }

  static List<Map<String, dynamic>> unwrapList(dynamic data, {String? key}) {
    dynamic raw = data;
    if (raw is Map) {
      if (key != null && raw[key] is List) {
        raw = raw[key];
      } else {
        // Fall back to the first list-valued entry — the routes are
        // consistent about wrapping in exactly one collection key.
        List<dynamic>? listEntry;
        for (final value in raw.values) {
          if (value is List) {
            listEntry = value;
            break;
          }
        }
        raw = listEntry ?? const [];
      }
    }
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
