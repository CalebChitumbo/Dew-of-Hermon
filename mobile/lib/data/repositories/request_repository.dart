import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../firestore/streams.dart';
import '../models/requests.dart';

/// The five stakeholder queues and the department join chain.
///
/// Each queue has its own endpoint and its own action verbs — the server keeps
/// them distinct because the workflows genuinely differ (a Treasurer approves
/// money; a Media coordinator assigns three named people) — so this wraps each
/// rather than pretending they are one.
class RequestRepository {
  RequestRepository(this._api);

  final ApiClient _api;

  // ── Transport ──

  Future<List<TransportRequest>> transport({String? status}) async {
    final rows = await _api.getList('/api/transport-requests',
        query: {if (status != null) 'status': status}, key: 'requests');
    return rows.map(TransportRequest.fromMap).toList();
  }

  /// The coordinator prices the job, which sends it on to the Treasurer.
  Future<void> submitTransportDetails(
    String id, {
    required String vehicleType,
    required int vehicleCount,
    required double estimatedCost,
    required String currency,
    String? pickupLocation,
    String? dropoffLocation,
    DateTime? pickupTime,
    DateTime? returnTime,
    String? coordinatorNotes,
  }) =>
      _api.patch('/api/transport-requests/$id/submit-details', body: {
        'vehicleType': vehicleType,
        'vehicleCount': vehicleCount,
        'estimatedCost': estimatedCost,
        'currency': currency,
        if (pickupLocation != null && pickupLocation.isNotEmpty)
          'pickupLocation': pickupLocation,
        if (dropoffLocation != null && dropoffLocation.isNotEmpty)
          'dropoffLocation': dropoffLocation,
        if (pickupTime != null)
          'pickupTime': pickupTime.toUtc().toIso8601String(),
        if (returnTime != null)
          'returnTime': returnTime.toUtc().toIso8601String(),
        if (coordinatorNotes != null && coordinatorNotes.isNotEmpty)
          'coordinatorNotes': coordinatorNotes,
      });

  /// Treasurer decision on a transport request.
  /// [action] is APPROVE | REQUEST_CHANGES | REJECT.
  Future<void> decideTransport(
    String id, {
    required String action,
    String? comments,
  }) =>
      _api.patch('/api/transport-requests/$id/treasurer-decision', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  // ── Budget ──

  Future<List<BudgetRequest>> budgets({String? status}) async {
    final rows = await _api.getList('/api/budget-requests',
        query: {if (status != null) 'status': status}, key: 'requests');
    return rows.map(BudgetRequest.fromMap).toList();
  }

  Future<void> decideBudget(
    String id, {
    required String action,
    String? comments,
    double? approvedAmount,
  }) =>
      _api.patch('/api/budget-requests/$id/treasurer-decision', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (approvedAmount != null) 'approvedAmount': approvedAmount,
      });

  // ── Media ──

  Future<List<MediaRequest>> media({String? status}) async {
    final rows = await _api.getList('/api/media-requests',
        query: {if (status != null) 'status': status}, key: 'requests');
    return rows.map(MediaRequest.fromMap).toList();
  }

  /// Confirming media means naming all three people — the server rejects a
  /// confirmation with any of them missing, so the coverage is never half
  /// arranged.
  Future<void> confirmMedia(
    String id, {
    required String soundUserId,
    required String soundUserName,
    required String publicityUserId,
    required String publicityUserName,
    required String coverageUserId,
    required String coverageUserName,
    String? comments,
  }) =>
      _api.patch('/api/media-requests/$id/confirm', body: {
        'action': 'CONFIRM',
        'soundUserId': soundUserId,
        'soundUserName': soundUserName,
        'publicityUserId': publicityUserId,
        'publicityUserName': publicityUserName,
        'coverageUserId': coverageUserId,
        'coverageUserName': coverageUserName,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  Future<void> declineMedia(String id, {required String comments}) =>
      _api.patch('/api/media-requests/$id/confirm',
          body: {'action': 'DECLINE', 'comments': comments});

  // ── Food ──

  Future<List<FoodRequest>> food({String? status}) async {
    final rows = await _api.getList('/api/food-requests',
        query: {if (status != null) 'status': status}, key: 'requests');
    return rows.map(FoodRequest.fromMap).toList();
  }

  /// Confirming food can also raise a catering budget request in the same
  /// step, which is how the kitchen asks the Treasurer for money.
  Future<void> confirmFood(
    String id, {
    int? headcount,
    String? menuPlan,
    String? comments,
    double? budgetAmount,
    String? budgetCurrency,
    String? budgetPurpose,
  }) =>
      _api.patch('/api/food-requests/$id/confirm', body: {
        'action': 'CONFIRM',
        if (headcount != null) 'headcount': headcount,
        if (menuPlan != null && menuPlan.isNotEmpty) 'menuPlan': menuPlan,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (budgetAmount != null && budgetAmount > 0)
          'raiseBudget': {
            'amount': budgetAmount,
            'currency': budgetCurrency ?? 'ZMW',
            'purpose': budgetPurpose ?? 'Catering',
          },
      });

  Future<void> declineFood(String id, {required String comments}) =>
      _api.patch('/api/food-requests/$id/confirm',
          body: {'action': 'DECLINE', 'comments': comments});

  // ── Department join requests ──

  /// `/api/department-join-requests` only accepts writes, so the queue is read
  /// straight from Firestore the way the web page does. The rules scope the
  /// collection to the requester or a department lead.
  Stream<List<DepartmentJoinRequest>> departmentJoinRequestsStream() {
    return collectionStream(
      db.collection('departmentJoinRequests'),
      DepartmentJoinRequest.fromMap,
      sort: (a, b) => b.createdAt.compareTo(a.createdAt),
    );
  }

  /// A member asking to join a department.
  Future<void> requestToJoin({
    required String departmentId,
    String? message,
  }) =>
      _api.post('/api/department-join-requests', body: {
        'departmentId': departmentId,
        if (message != null && message.isNotEmpty) 'message': message,
      });

  /// [action] is RECOMMEND | DECLINE (manager stage) or
  /// APPROVE | REJECT (chair stage), or CANCEL by the requester.
  Future<void> decideJoinRequest(
    String id, {
    required String action,
    String? comments,
  }) =>
      _api.post('/api/department-join-requests/$id/decision', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  // ── Event reports ──

  Future<List<EventReport>> eventReports({String? status}) async {
    final rows = await _api.getList('/api/event-reports',
        query: {if (status != null) 'status': status}, key: 'reports');
    return rows.map(EventReport.fromMap).toList();
  }

  Future<EventReport?> eventReport(String eventId) async {
    final data = await _api.getMap('/api/event-reports/$eventId');
    final report = data['report'];
    if (report is Map) {
      return EventReport.fromMap(Map<String, dynamic>.from(report));
    }
    return null;
  }

  /// Events this person initiated that are over and still need a report.
  Future<List<Map<String, dynamic>>> reportableEvents() =>
      _api.getList('/api/event-reports/eligible-events', key: 'events');

  Future<List<EventReport>> overdueReports() async {
    final rows =
        await _api.getList('/api/event-reports/overdue', key: 'reports');
    return rows.map(EventReport.fromMap).toList();
  }

  /// Save a draft, or submit for the Chairperson's review. The whole
  /// questionnaire goes in `payload`; the server sanitises it and decides the
  /// resulting status from `action`.
  Future<void> saveEventReport({
    required String eventId,
    required Map<String, dynamic> body,
    bool submit = false,
  }) =>
      _api.put('/api/event-reports/$eventId', body: {
        'action': submit ? 'SUBMIT' : 'SAVE_DRAFT',
        'payload': body,
      });

  /// Chairperson review: MARK_REVIEWED or REQUEST_CHANGES.
  Future<void> reviewEventReport(
    String eventId, {
    required String action,
    String? comments,
  }) =>
      _api.patch('/api/event-reports/$eventId/review', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  Future<void> remindOverdueReports() =>
      _api.post('/api/event-reports/remind');
}

final requestRepositoryProvider = Provider<RequestRepository>(
  (ref) => RequestRepository(ref.watch(apiClientProvider)),
);
