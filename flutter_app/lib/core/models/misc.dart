import '../firestore/converters.dart';

class AppNotification {
  final String id;
  final String userId;
  final String title;
  final String message;
  final String type; // reminder | assignment | event | announcement
  final bool isRead;
  final String? link;
  final String emailStatus; // pending | queued | delivered | failed | skipped
  final String? emailDocId;
  final String? emailError;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.type,
    this.isRead = false,
    this.link,
    this.emailStatus = 'pending',
    this.emailDocId,
    this.emailError,
    required this.createdAt,
  });

  factory AppNotification.fromMap(Map<String, dynamic> map) =>
      AppNotification(
        id: asString(map['id']),
        userId: asString(map['userId']),
        title: asString(map['title']),
        message: asString(map['message']),
        type: asString(map['type'], 'announcement'),
        isRead: asBool(map['isRead']),
        link: asStringOrNull(map['link']),
        emailStatus: asString(map['emailStatus'], 'pending'),
        emailDocId: asStringOrNull(map['emailDocId']),
        emailError: asStringOrNull(map['emailError']),
        createdAt: parseDate(map['createdAt']),
      );
}

class Affirmation {
  final String id;
  final String title;
  final String content;
  final String? serviceId;
  final String authorId;
  final String authorName;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Affirmation({
    required this.id,
    required this.title,
    required this.content,
    this.serviceId,
    required this.authorId,
    required this.authorName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Affirmation.fromMap(Map<String, dynamic> map) => Affirmation(
        id: asString(map['id']),
        title: asString(map['title']),
        content: asString(map['content']),
        serviceId: asStringOrNull(map['serviceId']),
        authorId: asString(map['authorId']),
        authorName: asString(map['authorName']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class BibleHighlightColor {
  static const gold = 'gold';
  static const sage = 'sage';
  static const blue = 'blue';
  static const rose = 'rose';
  static const lavender = 'lavender';
  static const all = [gold, sage, blue, rose, lavender];
}

class BibleBookmark {
  final String id;
  final String userId;
  final String translation;
  final int bookId;
  final String bookName;
  final int chapter;
  final int verse;
  final String text;
  final String? color;
  final String? note;
  final DateTime createdAt;

  const BibleBookmark({
    required this.id,
    required this.userId,
    required this.translation,
    required this.bookId,
    required this.bookName,
    required this.chapter,
    required this.verse,
    required this.text,
    this.color,
    this.note,
    required this.createdAt,
  });

  factory BibleBookmark.fromMap(Map<String, dynamic> map) => BibleBookmark(
        id: asString(map['id']),
        userId: asString(map['userId']),
        translation: asString(map['translation']),
        bookId: asInt(map['bookId']),
        bookName: asString(map['bookName']),
        chapter: asInt(map['chapter']),
        verse: asInt(map['verse']),
        text: asString(map['text']),
        color: asStringOrNull(map['color']),
        note: asStringOrNull(map['note']),
        createdAt: parseDate(map['createdAt']),
      );
}

class FollowUpStatus {
  static const pendingLeadApproval = 'PENDING_LEAD_APPROVAL';
  static const rejected = 'REJECTED';
  static const newContact = 'NEW_CONTACT';
  static const assigned = 'ASSIGNED';
  static const contacted = 'CONTACTED';
  static const firstVisit = 'FIRST_VISIT';
  static const regularAttendee = 'REGULAR_ATTENDEE';
  static const member = 'MEMBER';
}

class FollowUpCard {
  final String id;
  final String name;
  final String phone;
  final String source; // CAMPUS_MINISTRY | LIFE_GROUPS
  final String sourceDetail;
  final String status;
  final String? reason;
  final String notes;
  final DateTime dateOfContact;
  final String? assigneeId;
  final String? assigneeName;
  final String createdBy;
  final String createdByName;
  final String? submittedByRole;
  final String? approvedBy;
  final String? approvedByName;
  final DateTime? approvedAt;
  final String? rejectionReason;
  final List<Map<String, dynamic>> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const FollowUpCard({
    required this.id,
    required this.name,
    required this.phone,
    required this.source,
    required this.sourceDetail,
    required this.status,
    this.reason,
    this.notes = '',
    required this.dateOfContact,
    this.assigneeId,
    this.assigneeName,
    required this.createdBy,
    required this.createdByName,
    this.submittedByRole,
    this.approvedBy,
    this.approvedByName,
    this.approvedAt,
    this.rejectionReason,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory FollowUpCard.fromMap(Map<String, dynamic> map) => FollowUpCard(
        id: asString(map['id']),
        name: asString(map['name']),
        phone: asString(map['phone']),
        source: asString(map['source']),
        sourceDetail: asString(map['sourceDetail']),
        status: asString(map['status'], FollowUpStatus.newContact),
        reason: asStringOrNull(map['reason']),
        notes: asString(map['notes']),
        dateOfContact: parseDate(map['dateOfContact']),
        assigneeId: asStringOrNull(map['assigneeId']),
        assigneeName: asStringOrNull(map['assigneeName']),
        createdBy: asString(map['createdBy']),
        createdByName: asString(map['createdByName']),
        submittedByRole: asStringOrNull(map['submittedByRole']),
        approvedBy: asStringOrNull(map['approvedBy']),
        approvedByName: asStringOrNull(map['approvedByName']),
        approvedAt: parseDateOrNull(map['approvedAt']),
        rejectionReason: asStringOrNull(map['rejectionReason']),
        statusHistory: asMapList(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class Devotional {
  final String id;
  final String scope; // CAMPUS_MINISTRY | LIFE_GROUPS
  final String title;
  final String content;
  final String weekStartDate; // yyyy-mm-dd
  final String? scriptureReference;
  final String authorId;
  final String authorName;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Devotional({
    required this.id,
    required this.scope,
    required this.title,
    required this.content,
    required this.weekStartDate,
    this.scriptureReference,
    required this.authorId,
    required this.authorName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Devotional.fromMap(Map<String, dynamic> map) => Devotional(
        id: asString(map['id']),
        scope: asString(map['scope'], 'CAMPUS_MINISTRY'),
        title: asString(map['title']),
        content: asString(map['content']),
        weekStartDate: asString(map['weekStartDate']),
        scriptureReference: asStringOrNull(map['scriptureReference']),
        authorId: asString(map['authorId']),
        authorName: asString(map['authorName']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class TalentSubmissionStatus {
  static const pendingReview = 'PENDING_REVIEW';
  static const shortlisted = 'SHORTLISTED';
  static const slotted = 'SLOTTED';
  static const completed = 'COMPLETED';
  static const declined = 'DECLINED';
  static const withdrawn = 'WITHDRAWN';
}

class TalentCategory {
  static const all = [
    'SINGING',
    'INSTRUMENTS',
    'DANCE',
    'DRAMA',
    'POETRY_SPOKEN_WORD',
    'PREACHING_TEACHING',
    'MEDIA_CREATIVE',
    'ART_DESIGN',
    'TECH',
    'OTHER',
  ];

  static const labels = <String, String>{
    'SINGING': 'Singing',
    'INSTRUMENTS': 'Instruments',
    'DANCE': 'Dance',
    'DRAMA': 'Drama',
    'POETRY_SPOKEN_WORD': 'Poetry / Spoken Word',
    'PREACHING_TEACHING': 'Preaching / Teaching',
    'MEDIA_CREATIVE': 'Media / Creative',
    'ART_DESIGN': 'Art & Design',
    'TECH': 'Tech',
    'OTHER': 'Other',
  };
}

class TalentSubmission {
  final String id;
  final String userId;
  final String userName;
  final String? userEmail;
  final String category;
  final String? categoryOther;
  final String title;
  final String description;
  final String? experience;
  final String? sampleLink;
  final String? availabilityNote;
  final String status;
  final String? reviewedBy;
  final String? reviewedByName;
  final DateTime? reviewedAt;
  final String? reviewComments;
  final String? opportunityTitle;
  final DateTime? opportunityDate;
  final String? opportunityNotes;
  final String? slottedBy;
  final String? slottedByName;
  final DateTime? slottedAt;
  final List<Map<String, dynamic>> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const TalentSubmission({
    required this.id,
    required this.userId,
    required this.userName,
    this.userEmail,
    required this.category,
    this.categoryOther,
    required this.title,
    required this.description,
    this.experience,
    this.sampleLink,
    this.availabilityNote,
    required this.status,
    this.reviewedBy,
    this.reviewedByName,
    this.reviewedAt,
    this.reviewComments,
    this.opportunityTitle,
    this.opportunityDate,
    this.opportunityNotes,
    this.slottedBy,
    this.slottedByName,
    this.slottedAt,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory TalentSubmission.fromMap(Map<String, dynamic> map) =>
      TalentSubmission(
        id: asString(map['id']),
        userId: asString(map['userId']),
        userName: asString(map['userName']),
        userEmail: asStringOrNull(map['userEmail']),
        category: asString(map['category'], 'OTHER'),
        categoryOther: asStringOrNull(map['categoryOther']),
        title: asString(map['title']),
        description: asString(map['description']),
        experience: asStringOrNull(map['experience']),
        sampleLink: asStringOrNull(map['sampleLink']),
        availabilityNote: asStringOrNull(map['availabilityNote']),
        status: asString(map['status'], TalentSubmissionStatus.pendingReview),
        reviewedBy: asStringOrNull(map['reviewedBy']),
        reviewedByName: asStringOrNull(map['reviewedByName']),
        reviewedAt: parseDateOrNull(map['reviewedAt']),
        reviewComments: asStringOrNull(map['reviewComments']),
        opportunityTitle: asStringOrNull(map['opportunityTitle']),
        opportunityDate: parseDateOrNull(map['opportunityDate']),
        opportunityNotes: asStringOrNull(map['opportunityNotes']),
        slottedBy: asStringOrNull(map['slottedBy']),
        slottedByName: asStringOrNull(map['slottedByName']),
        slottedAt: parseDateOrNull(map['slottedAt']),
        statusHistory: asMapList(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

/// Access-control config documents (see `src/types` — AccessControlConfig).
class DepartmentAccessRule {
  final String featureKey;
  final String departmentName;
  final bool requiresLeadership;
  final List<String> allowedRoles;

  const DepartmentAccessRule({
    required this.featureKey,
    required this.departmentName,
    required this.requiresLeadership,
    this.allowedRoles = const [],
  });

  factory DepartmentAccessRule.fromMap(Map<String, dynamic> map) =>
      DepartmentAccessRule(
        featureKey: asString(map['featureKey']),
        departmentName: asString(map['departmentName']),
        requiresLeadership: asBool(map['requiresLeadership']),
        allowedRoles: asStringList(map['allowedRoles']),
      );

  Map<String, dynamic> toMap() => {
        'featureKey': featureKey,
        'departmentName': departmentName,
        'requiresLeadership': requiresLeadership,
        'allowedRoles': allowedRoles,
      };
}

/// pageKey → role → 'edit' | 'view' | 'none'
typedef PagePermissions = Map<String, Map<String, String>>;

/// featureKey → minimum role
typedef FeatureMinRoles = Map<String, String>;

PagePermissions pagePermissionsFrom(dynamic value) {
  final result = <String, Map<String, String>>{};
  if (value is Map) {
    value.forEach((pageKey, rolesValue) {
      if (rolesValue is Map) {
        final roles = <String, String>{};
        rolesValue.forEach((role, level) {
          roles[role.toString()] = level.toString();
        });
        result[pageKey.toString()] = roles;
      }
    });
  }
  return result;
}

FeatureMinRoles featureMinRolesFrom(dynamic value) {
  final result = <String, String>{};
  if (value is Map) {
    value.forEach((k, v) => result[k.toString()] = v.toString());
  }
  return result;
}

List<DepartmentAccessRule> accessRulesFrom(dynamic value) =>
    asMapList(value).map(DepartmentAccessRule.fromMap).toList();
