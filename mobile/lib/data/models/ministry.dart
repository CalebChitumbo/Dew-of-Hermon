import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// A task on a department's board. Mirrors `DepartmentTask`.
class DepartmentTask {
  const DepartmentTask({
    required this.id,
    required this.departmentId,
    required this.title,
    required this.status,
    required this.priority,
    required this.createdBy,
    required this.createdByName,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.assigneeId,
    this.assigneeName,
    this.dueDate,
    this.completedAt,
  });

  factory DepartmentTask.fromMap(Map<String, dynamic> map) => DepartmentTask(
        id: parseStringOr(map['id']),
        departmentId: parseStringOr(map['departmentId']),
        title: parseStringOr(map['title']),
        description: parseString(map['description']),
        status: TaskStatus.fromWire(map['status']),
        priority: TaskPriority.fromWire(map['priority']),
        assigneeId: parseString(map['assigneeId']),
        assigneeName: parseString(map['assigneeName']),
        dueDate: parseDate(map['dueDate']),
        createdBy: parseStringOr(map['createdBy']),
        createdByName: parseStringOr(map['createdByName']),
        completedAt: parseDate(map['completedAt']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String departmentId;
  final String title;
  final String? description;
  final TaskStatus status;
  final TaskPriority priority;
  final String? assigneeId;
  final String? assigneeName;
  final DateTime? dueDate;
  final String createdBy;
  final String createdByName;
  final DateTime? completedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isOverdue =>
      dueDate != null &&
      status != TaskStatus.done &&
      dueDate!.isBefore(DateTime.now());
}

/// Someone the ministry is following up. Mirrors `FollowUpCard`.
class FollowUpCard {
  const FollowUpCard({
    required this.id,
    required this.name,
    required this.phone,
    required this.source,
    required this.sourceDetail,
    required this.status,
    required this.notes,
    required this.dateOfContact,
    required this.createdBy,
    required this.createdByName,
    required this.createdAt,
    required this.updatedAt,
    this.reason,
    this.assigneeId,
    this.assigneeName,
    this.submittedByRole,
    this.approvedByName,
    this.approvedAt,
    this.rejectionReason,
  });

  factory FollowUpCard.fromMap(Map<String, dynamic> map) => FollowUpCard(
        id: parseStringOr(map['id']),
        name: parseStringOr(map['name']),
        phone: parseStringOr(map['phone']),
        source: FollowUpSource.fromWire(map['source']),
        sourceDetail: parseStringOr(map['sourceDetail']),
        status: FollowUpStatus.fromWire(map['status']),
        reason: FollowUpReason.fromWireOrNull(map['reason']),
        notes: parseStringOr(map['notes']),
        dateOfContact: parseDateOr(map['dateOfContact']),
        assigneeId: parseString(map['assigneeId']),
        assigneeName: parseString(map['assigneeName']),
        createdBy: parseStringOr(map['createdBy']),
        createdByName: parseStringOr(map['createdByName']),
        submittedByRole: map['submittedByRole'] == null
            ? null
            : UserRole.fromWire(map['submittedByRole']),
        approvedByName: parseString(map['approvedByName']),
        approvedAt: parseDate(map['approvedAt']),
        rejectionReason: parseString(map['rejectionReason']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String name;
  final String phone;
  final FollowUpSource source;

  /// Which campus or life group they came from.
  final String sourceDetail;

  final FollowUpStatus status;
  final FollowUpReason? reason;
  final String notes;
  final DateTime dateOfContact;
  final String? assigneeId;
  final String? assigneeName;
  final String createdBy;
  final String createdByName;

  /// The role of whoever submitted, which gates the lead-approval step.
  final UserRole? submittedByRole;

  final String? approvedByName;
  final DateTime? approvedAt;
  final String? rejectionReason;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get awaitingApproval =>
      status == FollowUpStatus.pendingLeadApproval;
  bool get isAssigned => (assigneeId ?? '').isNotEmpty;
}

/// The weekly devotional focus posted to campuses or life groups.
class Devotional {
  const Devotional({
    required this.id,
    required this.scope,
    required this.title,
    required this.content,
    required this.weekStartDate,
    required this.authorId,
    required this.authorName,
    required this.createdAt,
    required this.updatedAt,
    this.scriptureReference,
  });

  factory Devotional.fromMap(Map<String, dynamic> map) => Devotional(
        id: parseStringOr(map['id']),
        scope: DevotionalScope.fromWire(map['scope']),
        title: parseStringOr(map['title']),
        content: parseStringOr(map['content']),
        weekStartDate: parseStringOr(map['weekStartDate']),
        scriptureReference: parseString(map['scriptureReference']),
        authorId: parseStringOr(map['authorId']),
        authorName: parseStringOr(map['authorName']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final DevotionalScope scope;
  final String title;
  final String content;

  /// ISO date (yyyy-MM-dd) for the start of the week this covers.
  final String weekStartDate;

  final String? scriptureReference;
  final String authorId;
  final String authorName;
  final DateTime createdAt;
  final DateTime updatedAt;
}

/// A member putting a talent forward. Mirrors `TalentSubmission`.
class TalentSubmission {
  const TalentSubmission({
    required this.id,
    required this.userId,
    required this.userName,
    required this.category,
    required this.title,
    required this.description,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.userEmail,
    this.categoryOther,
    this.experience,
    this.sampleLink,
    this.availabilityNote,
    this.reviewedByName,
    this.reviewedAt,
    this.reviewComments,
    this.opportunityTitle,
    this.opportunityDate,
    this.opportunityNotes,
    this.slottedByName,
    this.slottedAt,
  });

  factory TalentSubmission.fromMap(Map<String, dynamic> map) =>
      TalentSubmission(
        id: parseStringOr(map['id']),
        userId: parseStringOr(map['userId']),
        userName: parseStringOr(map['userName']),
        userEmail: parseString(map['userEmail']),
        category: TalentCategory.fromWire(map['category']),
        categoryOther: parseString(map['categoryOther']),
        title: parseStringOr(map['title']),
        description: parseStringOr(map['description']),
        experience: parseString(map['experience']),
        sampleLink: parseString(map['sampleLink']),
        availabilityNote: parseString(map['availabilityNote']),
        status: TalentSubmissionStatus.fromWire(map['status']),
        reviewedByName: parseString(map['reviewedByName']),
        reviewedAt: parseDate(map['reviewedAt']),
        reviewComments: parseString(map['reviewComments']),
        opportunityTitle: parseString(map['opportunityTitle']),
        opportunityDate: parseDate(map['opportunityDate']),
        opportunityNotes: parseString(map['opportunityNotes']),
        slottedByName: parseString(map['slottedByName']),
        slottedAt: parseDate(map['slottedAt']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String userId;
  final String userName;
  final String? userEmail;
  final TalentCategory category;

  /// What the talent is, when the category is OTHER.
  final String? categoryOther;

  final String title;
  final String description;
  final String? experience;
  final String? sampleLink;
  final String? availabilityNote;
  final TalentSubmissionStatus status;
  final String? reviewedByName;
  final DateTime? reviewedAt;
  final String? reviewComments;
  final String? opportunityTitle;
  final DateTime? opportunityDate;
  final String? opportunityNotes;
  final String? slottedByName;
  final DateTime? slottedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  String get categoryLabel => category == TalentCategory.other
      ? (categoryOther ?? category.label)
      : category.label;

  bool get canWithdraw =>
      status == TalentSubmissionStatus.pendingReview ||
      status == TalentSubmissionStatus.shortlisted;
}

/// A short encouragement posted for the ministry. Mirrors `Affirmation`.
class Affirmation {
  const Affirmation({
    required this.id,
    required this.title,
    required this.content,
    required this.authorId,
    required this.authorName,
    required this.createdAt,
    required this.updatedAt,
    this.serviceId,
  });

  factory Affirmation.fromMap(Map<String, dynamic> map) => Affirmation(
        id: parseStringOr(map['id']),
        title: parseStringOr(map['title']),
        content: parseStringOr(map['content']),
        serviceId: parseString(map['serviceId']),
        authorId: parseStringOr(map['authorId']),
        authorName: parseStringOr(map['authorName']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String title;
  final String content;
  final String? serviceId;
  final String authorId;
  final String authorName;
  final DateTime createdAt;
  final DateTime updatedAt;
}
