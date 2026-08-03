import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/utils/dates.dart';
import '../models/enums.dart';
import '../models/event.dart';

/// Services, rotas, assignments and the pre-service checklist.
class ServiceRepository {
  ServiceRepository(this._api);

  final ApiClient _api;

  Future<List<Service>> list({bool archived = false, int limit = 30}) async {
    final rows = await _api.getList('/api/services',
        query: {'archived': '$archived', 'limit': '$limit'},
        key: 'services');
    return rows.map(Service.fromMap).toList();
  }

  Future<Map<String, dynamic>> detail(String serviceId) =>
      _api.getMap('/api/services/$serviceId');

  /// Open (or reopen) the rota for a Sunday. The server provisions
  /// idempotently — asking twice for the same date returns the existing rota
  /// rather than creating a duplicate.
  Future<Map<String, dynamic>> create({
    required DateTime date,
    required String venue,
    required String serviceTime,
    String? theme,
  }) async {
    final data = await _api.post('/api/services', body: {
      'date': D.iso(date),
      'venue': venue,
      'serviceTime': serviceTime,
      if (theme != null && theme.isNotEmpty) 'theme': theme,
    });
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  Future<void> update(String serviceId, Map<String, dynamic> updates) =>
      _api.patch('/api/services/$serviceId', body: updates);

  Future<void> archive(String serviceId) =>
      _api.patch('/api/services/$serviceId', body: {'isArchived': true});

  /// Provision the next few Sundays' rotas ahead of time.
  Future<void> ensureUpcoming() =>
      _api.post('/api/services/ensure-upcoming');

  Future<void> remind(String serviceId) =>
      _api.post('/api/services/$serviceId/remind');

  // ── Assignments ──

  Future<List<ServiceAssignment>> assignments(String serviceId) async {
    final rows = await _api.getList('/api/services/$serviceId/assignments',
        key: 'assignments');
    return rows.map(ServiceAssignment.fromMap).toList();
  }

  Future<void> assign({
    required String serviceId,
    required String roleId,
    required String userId,
    String? notes,
  }) =>
      _api.post('/api/services/$serviceId/assignments', body: {
        'roleId': roleId,
        'userId': userId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });

  /// Confirm or decline a duty. The server allows either the assigned member
  /// themselves or an admin, so this one call covers both.
  Future<void> setAssignmentStatus({
    required String serviceId,
    required String assignmentId,
    required AssignmentStatus status,
    String? notes,
  }) =>
      _api.patch('/api/services/$serviceId/assignments/$assignmentId', body: {
        'status': status.wire,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });

  Future<void> removeAssignment({
    required String serviceId,
    required String assignmentId,
  }) =>
      _api.delete('/api/services/$serviceId/assignments/$assignmentId');
}

final serviceRepositoryProvider = Provider<ServiceRepository>(
  (ref) => ServiceRepository(ref.watch(apiClientProvider)),
);

/// Events, and the calendar built from them.
class EventRepository {
  EventRepository(this._api);

  final ApiClient _api;

  Future<List<AppEvent>> list({
    DateTime? startDate,
    DateTime? endDate,
    EventType? type,
    EventApprovalStatus? approvalStatus,
  }) async {
    final rows = await _api.getList('/api/events', query: {
      if (startDate != null) 'startDate': D.iso(startDate),
      if (endDate != null) 'endDate': D.iso(endDate),
      if (type != null) 'type': type.wire,
      if (approvalStatus != null) 'approvalStatus': approvalStatus.wire,
    }, key: 'events');
    return rows.map(AppEvent.fromMap).toList();
  }

  Future<AppEvent?> detail(String eventId) async {
    final data = await _api.getMap('/api/events/$eventId');
    final event = data['event'];
    if (event is Map) {
      return AppEvent.fromMap(Map<String, dynamic>.from(event));
    }
    return data.isEmpty ? null : AppEvent.fromMap(data);
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> body) async {
    final data = await _api.post('/api/events', body: body);
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  Future<void> update(String eventId, Map<String, dynamic> updates) =>
      _api.patch('/api/events/$eventId', body: updates);

  Future<void> delete(String eventId) => _api.delete('/api/events/$eventId');

  /// Events Lead: send the stakeholder requests this event raised.
  Future<void> dispatch(String eventId) =>
      _api.post('/api/events/$eventId/dispatch');

  /// Events Lead sign-off, passing the event up the chain.
  Future<void> approve(String eventId, {String? comments}) =>
      _api.post('/api/events/$eventId/approve', body: {
        'action': 'APPROVE',
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  Future<void> reject(String eventId, {required String comments}) =>
      _api.post('/api/events/$eventId/approve',
          body: {'action': 'REJECT', 'comments': comments});

  Future<void> requestChanges(String eventId, {required String comments}) =>
      _api.post('/api/events/$eventId/approve',
          body: {'action': 'CHANGES_REQUESTED', 'comments': comments});

  /// Vice Chair / Chairperson tier approval.
  Future<void> tierApprove(
    String eventId, {
    required String action,
    String? comments,
  }) =>
      _api.post('/api/events/$eventId/tier-approve', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
      });

  /// How each stakeholder request on an event is doing. Resolved server-side
  /// with the Admin SDK — a POST, because it takes a list of event ids — so
  /// the approvals screen never depends on client read rules for the four
  /// request collections. Returns `{ eventId: {transport, budget, media,
  /// food} }`.
  Future<Map<String, dynamic>> stakeholderStatuses(
      List<String> eventIds) async {
    if (eventIds.isEmpty) return <String, dynamic>{};
    final data = await _api.post('/api/events/stakeholder-statuses',
        body: {'eventIds': eventIds});
    final statuses = data is Map ? data['statuses'] : null;
    return statuses is Map
        ? Map<String, dynamic>.from(statuses)
        : <String, dynamic>{};
  }

  // ── Event roles ──

  Future<List<EventDepartmentRole>> departmentRoles(String eventId) async {
    final rows = await _api.getList('/api/events/$eventId/department-roles',
        key: 'roles');
    return rows.map(EventDepartmentRole.fromMap).toList();
  }

  Future<void> generateDepartmentRoles(String eventId) =>
      _api.post('/api/events/$eventId/department-roles/generate');

  Future<void> assignDepartmentRole({
    required String eventId,
    required String roleId,
    required String? userId,
  }) =>
      _api.patch('/api/events/$eventId/department-roles',
          body: {'roleId': roleId, 'assignedUserId': userId});

  Future<void> assignCoreRole({
    required String eventId,
    required String role,
    required String? userId,
    String? userName,
  }) =>
      _api.patch('/api/events/$eventId', body: {
        'coreRoleAssignment': {
          'role': role,
          'assignedUserId': userId,
          'assignedUserName': userName,
        },
      });

  Future<List<Map<String, dynamic>>> assignableMembers(
    String eventId, {
    String? departmentId,
  }) =>
      _api.getList('/api/events/$eventId/assignable-members',
          query: {if (departmentId != null) 'departmentId': departmentId},
          key: 'members');

  Future<void> remindRoles(String eventId) =>
      _api.post('/api/events/$eventId/remind-roles');
}

final eventRepositoryProvider = Provider<EventRepository>(
  (ref) => EventRepository(ref.watch(apiClientProvider)),
);
