import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/utils/dates.dart';
import '../models/enums.dart';
import '../models/ministry.dart';

/// Departments, their task boards, the follow-up pipeline, devotionals,
/// talents and affirmations.
class MinistryRepository {
  MinistryRepository(this._api);

  final ApiClient _api;

  // ── Departments ──

  Future<void> createDepartment({
    required String name,
    String? description,
    String icon = 'Users',
  }) =>
      _api.post('/api/departments', body: {
        'name': name,
        if (description != null && description.isNotEmpty)
          'description': description,
        'icon': icon,
      });

  /// Add or remove a member. The server checks the caller may do it for this
  /// department — a lead can manage their own, an admin any.
  Future<void> setDepartmentMembership({
    required String departmentId,
    required String userId,
    required bool member,
  }) =>
      _api.patch('/api/departments', body: {
        'departmentId': departmentId,
        'userId': userId,
        'action': member ? 'ADD' : 'REMOVE',
      });

  // ── Department tasks ──

  Future<List<DepartmentTask>> tasks(String departmentId) async {
    final rows = await _api.getList('/api/department-tasks',
        query: {'departmentId': departmentId}, key: 'tasks');
    return rows.map(DepartmentTask.fromMap).toList();
  }

  Future<void> createTask({
    required String departmentId,
    required String title,
    String? description,
    TaskPriority priority = TaskPriority.medium,
    String? assigneeId,
    String? assigneeName,
    DateTime? dueDate,
  }) =>
      _api.post('/api/department-tasks', body: {
        'departmentId': departmentId,
        'title': title,
        if (description != null && description.isNotEmpty)
          'description': description,
        'priority': priority.wire,
        if (assigneeId != null) 'assigneeId': assigneeId,
        if (assigneeName != null) 'assigneeName': assigneeName,
        if (dueDate != null) 'dueDate': dueDate.toUtc().toIso8601String(),
      });

  Future<void> updateTask(String taskId, Map<String, dynamic> updates) =>
      _api.patch('/api/department-tasks', body: {'id': taskId, ...updates});

  Future<void> moveTask(String taskId, TaskStatus status) =>
      updateTask(taskId, {'status': status.wire});

  Future<void> deleteTask(String taskId) =>
      _api.delete('/api/department-tasks', query: {'id': taskId});

  // ── Follow-up pipeline ──

  Future<List<FollowUpCard>> followUps({
    FollowUpStatus? status,
    FollowUpSource? source,
    String? assigneeId,
  }) async {
    final rows = await _api.getList('/api/follow-up-cards', query: {
      if (status != null) 'status': status.wire,
      if (source != null) 'source': source.wire,
      if (assigneeId != null) 'assigneeId': assigneeId,
    }, key: 'cards');
    return rows.map(FollowUpCard.fromMap).toList();
  }

  Future<void> createFollowUp({
    required String name,
    required String phone,
    required FollowUpSource source,
    required String sourceDetail,
    FollowUpReason? reason,
    String? notes,
    DateTime? dateOfContact,
  }) =>
      _api.post('/api/follow-up-cards', body: {
        'name': name,
        'phone': phone,
        'source': source.wire,
        'sourceDetail': sourceDetail,
        if (reason != null) 'reason': reason.wire,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'dateOfContact':
            (dateOfContact ?? DateTime.now()).toUtc().toIso8601String(),
      });

  Future<void> updateFollowUp(
    String id, {
    FollowUpStatus? status,
    String? assigneeId,
    String? assigneeName,
    String? notes,
  }) =>
      _api.patch('/api/follow-up-cards/$id', body: {
        if (status != null) 'status': status.wire,
        if (assigneeId != null) 'assigneeId': assigneeId,
        if (assigneeName != null) 'assigneeName': assigneeName,
        if (notes != null) 'notes': notes,
      });

  /// The dept-lead gate on cards submitted by youth leaders.
  Future<void> approveFollowUp(
    String id, {
    required bool approve,
    String? rejectionReason,
  }) =>
      _api.post('/api/follow-up-cards/$id/approve', body: {
        'action': approve ? 'APPROVE' : 'REJECT',
        if (rejectionReason != null && rejectionReason.isNotEmpty)
          'rejectionReason': rejectionReason,
      });

  // ── Devotionals ──

  Future<List<Devotional>> devotionals({
    required DevotionalScope scope,
    int limit = 20,
  }) async {
    final rows = await _api.getList('/api/devotionals',
        query: {'scope': scope.wire, 'limit': '$limit'}, key: 'devotionals');
    return rows.map(Devotional.fromMap).toList();
  }

  Future<void> postDevotional({
    required DevotionalScope scope,
    required String title,
    required String content,
    required DateTime weekStart,
    String? scriptureReference,
  }) =>
      _api.post('/api/devotionals', body: {
        'scope': scope.wire,
        'title': title,
        'content': content,
        'weekStartDate': D.iso(weekStart),
        if (scriptureReference != null && scriptureReference.isNotEmpty)
          'scriptureReference': scriptureReference,
      });

  Future<void> deleteDevotional(String id) =>
      _api.delete('/api/devotionals/$id');

  // ── Talents ──

  Future<List<TalentSubmission>> talents() async {
    final rows = await _api.getList('/api/talents', key: 'submissions');
    return rows.map(TalentSubmission.fromMap).toList();
  }

  Future<void> submitTalent({
    required TalentCategory category,
    required String title,
    required String description,
    String? categoryOther,
    String? experience,
    String? sampleLink,
    String? availabilityNote,
  }) =>
      _api.post('/api/talents', body: {
        'category': category.wire,
        if (categoryOther != null && categoryOther.isNotEmpty)
          'categoryOther': categoryOther,
        'title': title,
        'description': description,
        if (experience != null && experience.isNotEmpty)
          'experience': experience,
        if (sampleLink != null && sampleLink.isNotEmpty)
          'sampleLink': sampleLink,
        if (availabilityNote != null && availabilityNote.isNotEmpty)
          'availabilityNote': availabilityNote,
      });

  /// Leadership moves a submission along, or the member withdraws it.
  /// [action] is SHORTLIST | DECLINE | SLOT | COMPLETE | WITHDRAW.
  Future<void> decideTalent(
    String id, {
    required String action,
    String? comments,
    String? opportunityTitle,
    DateTime? opportunityDate,
    String? opportunityNotes,
  }) =>
      _api.patch('/api/talents/$id/decision', body: {
        'action': action,
        if (comments != null && comments.isNotEmpty) 'comments': comments,
        if (opportunityTitle != null && opportunityTitle.isNotEmpty)
          'opportunityTitle': opportunityTitle,
        if (opportunityDate != null)
          'opportunityDate': opportunityDate.toUtc().toIso8601String(),
        if (opportunityNotes != null && opportunityNotes.isNotEmpty)
          'opportunityNotes': opportunityNotes,
      });

  // ── Affirmations ──

  Future<List<Affirmation>> affirmations({int limit = 50}) async {
    final rows = await _api
        .getList('/api/affirmations', query: {'limit': '$limit'},
            key: 'affirmations');
    return rows.map(Affirmation.fromMap).toList();
  }

  Future<void> createAffirmation({
    required String title,
    required String content,
    String? serviceId,
  }) =>
      _api.post('/api/affirmations', body: {
        'title': title,
        'content': content,
        if (serviceId != null) 'serviceId': serviceId,
      });

  // ── Institutions ──

  Future<void> createInstitution(String name) =>
      _api.post('/api/institutions', body: {'name': name});

  Future<void> updateInstitution(
          String id, Map<String, dynamic> updates) =>
      _api.patch('/api/institutions', body: {'id': id, ...updates});
}

final ministryRepositoryProvider = Provider<MinistryRepository>(
  (ref) => MinistryRepository(ref.watch(apiClientProvider)),
);
