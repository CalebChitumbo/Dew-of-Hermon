import '../core/fire.dart';

// Dart ports of the documents in src/types/index.ts that the member-facing
// screens need. Enums stay as the same string constants Firestore stores so
// both clients read/write identical data.

// ─── Roles ───────────────────────────────────────────────────────────────

const roleHierarchy = <String, int>{
  'SUPER_ADMIN': 6,
  'VICE_CHAIRPERSON': 5,
  'ADMIN': 4,
  'DEPARTMENT_LEAD': 3,
  'YOUTH_LEADER': 2,
  'MEMBER': 1,
};

const roleLabels = <String, String>{
  'SUPER_ADMIN': 'Chairperson',
  'VICE_CHAIRPERSON': 'Vice Chairperson',
  'ADMIN': 'Secretary / Admin',
  'DEPARTMENT_LEAD': 'Department Lead',
  'YOUTH_LEADER': 'Youth Leader',
  'MEMBER': 'Member',
};

bool hasMinRole(String userRole, String requiredRole) =>
    (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 99);

const lifeGroups = <String>['BRIDGE', 'ANCHOR', 'CORNERSTONE'];

// ─── User ────────────────────────────────────────────────────────────────

class UserProfile {
  UserProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.departmentIds,
    required this.leadsDepartmentIds,
    required this.profileImage,
    required this.isActive,
    required this.pushEnabled,
    required this.lifeGroup,
    required this.isStudent,
    required this.institutionId,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final List<String> departmentIds;
  final List<String> leadsDepartmentIds;
  final String? profileImage;
  final bool isActive;
  final bool pushEnabled;
  final String? lifeGroup;
  final bool isStudent;
  final String? institutionId;

  String get firstName => name.trim().split(' ').first;
  String get roleLabel => roleLabels[role] ?? role;
  bool get isAdmin => hasMinRole(role, 'ADMIN');

  factory UserProfile.fromMap(String id, Map<String, dynamic> data) {
    return UserProfile(
      id: id,
      name: asString(data['name'], 'User'),
      email: asString(data['email']),
      phone: asStringOrNull(data['phone']),
      role: asString(data['role'], 'MEMBER'),
      departmentIds: asStringList(data['departmentIds']),
      leadsDepartmentIds: asStringList(data['leadsDepartmentIds']),
      profileImage: asStringOrNull(data['profileImage']),
      isActive: asBool(data['isActive'], true),
      pushEnabled: asBool(data['pushEnabled']),
      lifeGroup: asStringOrNull(data['lifeGroup']),
      isStudent: asBool(data['isStudent']),
      institutionId: asStringOrNull(data['institutionId']),
    );
  }
}

// ─── Events ──────────────────────────────────────────────────────────────

class EventTypeMeta {
  const EventTypeMeta(this.label);
  final String label;
}

const eventTypeMeta = <String, EventTypeMeta>{
  'POTTERS_WHEEL_SERVICE': EventTypeMeta('Service'),
  'ROPS_CAMP': EventTypeMeta('ROPS Camp'),
  'RETREAT': EventTypeMeta('Retreat'),
  'SPECIAL_EVENT': EventTypeMeta('Special'),
  'MEETING': EventTypeMeta('Meeting'),
  'OUTREACH': EventTypeMeta('Outreach'),
};

class AppEvent {
  AppEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.venue,
    required this.approvalStatus,
    required this.lifeGroupTarget,
    required this.speaker,
    required this.objective,
    required this.isPaid,
    required this.attendanceFee,
    required this.attendanceFeeCurrency,
  });

  final String id;
  final String title;
  final String? description;
  final String type;
  final DateTime startDate;
  final DateTime? endDate;
  final String venue;
  final String approvalStatus;
  final String? lifeGroupTarget;
  final String? speaker;
  final String? objective;
  final bool isPaid;
  final num? attendanceFee;
  final String? attendanceFeeCurrency;

  String get typeLabel => eventTypeMeta[type]?.label ?? type;
  bool get isApproved => approvalStatus == 'APPROVED';

  factory AppEvent.fromMap(String id, Map<String, dynamic> data) {
    return AppEvent(
      id: id,
      title: asString(data['title'], 'Untitled event'),
      description: asStringOrNull(data['description']),
      type: asString(data['type'], 'MEETING'),
      startDate: asDate(data['startDate']),
      endDate: asDateOrNull(data['endDate']),
      venue: asString(data['venue']),
      // Older docs predate the approval chain and are implicitly approved.
      approvalStatus: asString(data['approvalStatus'], 'APPROVED'),
      lifeGroupTarget: asStringOrNull(data['lifeGroupTarget']),
      speaker: asStringOrNull(data['speaker']),
      objective: asStringOrNull(data['objective']),
      isPaid: asBool(data['isPaid']),
      attendanceFee: asNumOrNull(data['attendanceFee']),
      attendanceFeeCurrency: asStringOrNull(data['attendanceFeeCurrency']),
    );
  }
}

// ─── My assignments (GET /api/my-assignments) ────────────────────────────

class MyAssignment {
  MyAssignment({
    required this.id,
    required this.kind,
    required this.parentId,
    required this.roleName,
    required this.status,
    required this.serviceDate,
    required this.serviceTime,
    required this.eventTitle,
    required this.venue,
    required this.theme,
    required this.notes,
  });

  /// "service" or "braai" — determines which endpoint updates it.
  final String kind;
  final String id;
  final String parentId;
  final String roleName;
  final String status;
  final DateTime? serviceDate;
  final String? serviceTime;
  final String? eventTitle;
  final String? venue;
  final String? theme;
  final String? notes;

  bool get isPending => status == 'PENDING';

  String get updateApiPath => kind == 'braai'
      ? '/api/fundraising/braai/events/$parentId/assignments/$id'
      : '/api/services/$parentId/assignments/$id';

  factory MyAssignment.fromJson(Map<String, dynamic> json) {
    return MyAssignment(
      id: asString(json['id']),
      kind: asString(json['kind'], 'service'),
      parentId: asString(json['parentId'], asString(json['serviceId'])),
      roleName: asString(json['roleName'], 'Role'),
      status: asString(json['status'], 'PENDING'),
      serviceDate: asDateOrNull(json['serviceDate']),
      serviceTime: asStringOrNull(json['serviceTime']),
      eventTitle: asStringOrNull(json['eventTitle']),
      venue: asStringOrNull(json['venue']),
      theme: asStringOrNull(json['theme']),
      notes: asStringOrNull(json['notes']),
    );
  }
}

// ─── Notifications ───────────────────────────────────────────────────────

class AppNotification {
  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.link,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String message;
  final String type; // reminder | assignment | event | announcement
  final bool isRead;
  final String? link;
  final DateTime createdAt;

  factory AppNotification.fromMap(String id, Map<String, dynamic> data) {
    return AppNotification(
      id: id,
      title: asString(data['title']),
      message: asString(data['message']),
      type: asString(data['type'], 'announcement'),
      isRead: asBool(data['isRead']),
      link: asStringOrNull(data['link']),
      createdAt: asDate(data['createdAt']),
    );
  }
}

// ─── Devotionals & Affirmations ──────────────────────────────────────────

class Devotional {
  Devotional({
    required this.id,
    required this.scope,
    required this.title,
    required this.content,
    required this.weekStartDate,
    required this.scriptureReference,
    required this.authorName,
  });

  final String id;
  final String scope;
  final String title;
  final String content;
  final String weekStartDate;
  final String? scriptureReference;
  final String authorName;

  factory Devotional.fromMap(String id, Map<String, dynamic> data) {
    return Devotional(
      id: id,
      scope: asString(data['scope'], 'CAMPUS_MINISTRY'),
      title: asString(data['title']),
      content: asString(data['content']),
      weekStartDate: asString(data['weekStartDate']),
      scriptureReference: asStringOrNull(data['scriptureReference']),
      authorName: asString(data['authorName']),
    );
  }
}

class Affirmation {
  Affirmation({
    required this.id,
    required this.title,
    required this.content,
    required this.authorName,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String content;
  final String authorName;
  final DateTime createdAt;

  factory Affirmation.fromMap(String id, Map<String, dynamic> data) {
    return Affirmation(
      id: id,
      title: asString(data['title']),
      content: asString(data['content']),
      authorName: asString(data['authorName']),
      createdAt: asDate(data['createdAt']),
    );
  }
}

// ─── Availability (users/{uid}/availability/{yyyy-MM-dd}) ────────────────

class UserAvailability {
  UserAvailability({
    required this.date,
    required this.available,
    required this.reason,
  });

  final String date; // yyyy-MM-dd doc id
  final bool available;
  final String? reason;

  factory UserAvailability.fromMap(String id, Map<String, dynamic> data) {
    return UserAvailability(
      date: id,
      available: asBool(data['available']),
      reason: asStringOrNull(data['reason']),
    );
  }
}
