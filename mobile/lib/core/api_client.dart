import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:path_provider/path_provider.dart';

import 'config.dart';

/// HTTP client for the Next.js REST API — the same endpoints the website
/// uses, with the same auth model:
///
///  1. Sign in with Firebase Auth on-device.
///  2. POST the ID token to `/api/auth/login`, which sets the `session`
///     cookie all API routes accept. The cookie is persisted in a cookie
///     jar so it survives app restarts.
///  3. Every request also carries `Authorization: Bearer <idToken>` for the
///     routes that prefer it (e.g. /api/my-assignments).
///  4. On a 401 (expired session cookie) the session is recreated from a
///     fresh ID token and the request retried once — mirroring the web
///     app's fetchWithAuth helper.
class ApiClient {
  ApiClient._(this._dio, this._cookieJar);

  final Dio _dio;
  final PersistCookieJar _cookieJar;

  Dio get dio => _dio;

  static const _kRetried = 'pw_retried';
  static const _loginPath = '/api/auth/login';

  static Future<ApiClient> create() async {
    final supportDir = await getApplicationSupportDirectory();
    final cookieJar = PersistCookieJar(
      storage: FileStorage('${supportDir.path}/cookies'),
    );

    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.backendBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        contentType: 'application/json',
      ),
    );
    dio.interceptors.add(CookieManager(cookieJar));

    final client = ApiClient._(dio, cookieJar);

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final user = FirebaseAuth.instance.currentUser;
          if (user != null && !options.headers.containsKey('Authorization')) {
            try {
              final token = await user.getIdToken();
              if (token != null) {
                options.headers['Authorization'] = 'Bearer $token';
              }
            } catch (_) {
              // Proceed without the header; the session cookie may suffice.
            }
          }
          handler.next(options);
        },
      ),
    );

    dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onError: (error, handler) async {
          final response = error.response;
          final request = error.requestOptions;
          final isLoginCall = request.path == _loginPath;
          if (response?.statusCode == 401 &&
              !isLoginCall &&
              request.extra[_kRetried] != true &&
              FirebaseAuth.instance.currentUser != null) {
            try {
              await client.createSession(forceRefresh: true);
              final retry = request..extra[_kRetried] = true;
              final user = FirebaseAuth.instance.currentUser;
              final token = await user?.getIdToken();
              if (token != null) {
                retry.headers['Authorization'] = 'Bearer $token';
              }
              final retried = await dio.fetch<dynamic>(retry);
              return handler.resolve(retried);
            } catch (_) {
              // Fall through to the original 401.
            }
          }
          handler.next(error);
        },
      ),
    );

    return client;
  }

  /// Exchanges the current Firebase ID token for the backend session cookie.
  /// Mirrors the website's AuthContext.createSession. Throws [ApiException]
  /// with the server's message on failure (e.g. deactivated account).
  Future<Map<String, dynamic>> createSession({
    bool forceRefresh = false,
    String? registrationName,
    String? lifeGroup,
    bool? isStudent,
    String? institutionId,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw StateError('Cannot create a session without a signed-in user.');
    }
    final idToken = await user.getIdToken(forceRefresh);
    try {
      final res = await _dio.post<dynamic>(
        _loginPath,
        data: {
          'idToken': idToken,
          'registrationName': ?registrationName,
          'lifeGroup': ?lifeGroup,
          'isStudent': ?isStudent,
          'institutionId': ?institutionId,
        },
      );
      return (res.data as Map).cast<String, dynamic>();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> getJson(String path,
      {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get<dynamic>(path, queryParameters: query);
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> postJson(String path, Object? body) async {
    try {
      final res = await _dio.post<dynamic>(path, data: body);
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> putJson(String path, Object? body) async {
    try {
      final res = await _dio.put<dynamic>(path, data: body);
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> deleteJson(String path, {Object? body}) async {
    try {
      await _dio.delete<dynamic>(path, data: body);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Clears the backend session and local cookies (used on sign-out).
  Future<void> destroySession() async {
    try {
      await _dio.delete<dynamic>('/api/auth/session');
    } catch (_) {
      // Best effort — clearing local cookies below is what matters.
    }
    await _cookieJar.deleteAll();
  }

  static Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map) return data.cast<String, dynamic>();
    return <String, dynamic>{};
  }
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    String? serverMessage;
    if (data is Map && data['error'] is String) {
      serverMessage = data['error'] as String;
    }
    return ApiException(
      serverMessage ??
          (e.type == DioExceptionType.connectionError ||
                  e.type == DioExceptionType.connectionTimeout
              ? 'Could not reach the server. Check your connection.'
              : 'Something went wrong. Please try again.'),
      statusCode: e.response?.statusCode,
    );
  }

  @override
  String toString() => message;
}
