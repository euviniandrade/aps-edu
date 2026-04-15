import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';

const String kBaseUrl = 'http://10.0.2.2:3000/api'; // Android emulator → localhost

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late final Dio _dio;

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final box = Hive.box('auth');
        final token = box.get('accessToken');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            final box = Hive.box('auth');
            final token = box.get('accessToken');
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(error.requestOptions);
            handler.resolve(response);
            return;
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _refreshToken() async {
    try {
      final box = Hive.box('auth');
      final refreshToken = box.get('refreshToken');
      if (refreshToken == null) return false;
      final response = await Dio().post('$kBaseUrl/auth/refresh', data: {'refreshToken': refreshToken});
      box.put('accessToken', response.data['accessToken']);
      return true;
    } catch (_) {
      return false;
    }
  }

  Dio get dio => _dio;

  // Auth
  Future<Response> login(String email, String password) =>
      _dio.post('/auth/login', data: {'email': email, 'password': password});

  Future<Response> getMe() => _dio.get('/auth/me');

  // Tasks
  Future<Response> getTasks({Map<String, dynamic>? params}) =>
      _dio.get('/tasks', queryParameters: params);
  Future<Response> getTask(String id) => _dio.get('/tasks/$id');
  Future<Response> createTask(Map<String, dynamic> data) =>
      _dio.post('/tasks', data: data);
  Future<Response> updateTask(String id, Map<String, dynamic> data) =>
      _dio.put('/tasks/$id', data: data);
  Future<Response> updateChecklist(String taskId, String checkId, Map<String, dynamic> data) =>
      _dio.put('/tasks/$taskId/checklists/$checkId', data: data);
  Future<Response> addComment(String taskId, String content) =>
      _dio.post('/tasks/$taskId/comments', data: {'content': content});

  // Events
  Future<Response> getEvents({Map<String, dynamic>? params}) =>
      _dio.get('/events', queryParameters: params);
  Future<Response> getEvent(String id) => _dio.get('/events/$id');
  Future<Response> getEventReport(String id) => _dio.get('/events/$id/report');
  Future<Response> createEvent(Map<String, dynamic> data) =>
      _dio.post('/events', data: data);
  Future<Response> updateTimeline(String eventId, String itemId, Map<String, dynamic> data) =>
      _dio.put('/events/$eventId/timeline/$itemId', data: data);

  // Announcements
  Future<Response> getAnnouncements({Map<String, dynamic>? params}) =>
      _dio.get('/announcements', queryParameters: params);
  Future<Response> readAnnouncement(String id) =>
      _dio.post('/announcements/$id/read');

  // Gamification
  Future<Response> getRanking({String scope = 'global'}) =>
      _dio.get('/gamification/ranking', queryParameters: {'scope': scope});
  Future<Response> getMyStats() => _dio.get('/gamification/my-stats');
  Future<Response> getBadges({String? category}) =>
      _dio.get('/gamification/badges', queryParameters: category != null ? {'category': category} : null);

  // Notifications
  Future<Response> getNotifications({Map<String, dynamic>? params}) =>
      _dio.get('/notifications', queryParameters: params);
  Future<Response> markNotificationRead(String id) =>
      _dio.put('/notifications/$id/read');
  Future<Response> markAllNotificationsRead() =>
      _dio.put('/notifications/read-all');

  // Feedback
  Future<Response> sendFeedback(Map<String, dynamic> data) =>
      _dio.post('/feedback', data: data);

  // Users
  Future<Response> getUsers({Map<String, dynamic>? params}) =>
      _dio.get('/users', queryParameters: params);

  // Reports
  Future<Response> getUserReport(String userId, {Map<String, dynamic>? params}) =>
      _dio.get('/reports/user/$userId', queryParameters: params);
  Future<Response> getUnitReport(String unitId, {Map<String, dynamic>? params}) =>
      _dio.get('/reports/unit/$unitId', queryParameters: params);
  Future<Response> getDashboardReport() => _dio.get('/reports/dashboard');
}

final api = ApiClient();
