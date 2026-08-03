import '../firestore/converters.dart';
import 'department.dart' show StatusHistoryEntry;

class CampGender {
  static const male = 'MALE';
  static const female = 'FEMALE';
  static const all = [male, female];
}

class CampPaymentStatus {
  static const unpaid = 'UNPAID';
  static const paid = 'PAID';
  static const refunded = 'REFUNDED';
}

class CampTShirtSize {
  static const all = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
}

class CampDropoffLocation {
  static const church = 'CHURCH';
  static const campsite = 'CAMPSITE';
  static const all = [church, campsite];
}

class CampRegistration {
  final String id;
  final String campId;
  final String firstName;
  final String lastName;
  final String dateOfBirth; // yyyy-mm-dd
  final String gender;
  final String phone;
  final String? email;
  final String churchOrSchool;
  final String emergencyContactName;
  final String emergencyContactPhone;
  final String? emergencyContactRelationship;
  final String? medicalNotes;
  final String? allergies;
  final String? medications;
  final String? tshirtSize;
  final String? dietaryPreference;
  final String? parentName;
  final String? parentRelationship;
  final String? parentAltPhone;
  final String? parentEmail;
  final String? address;
  final String? dropoffLocation;
  final String? notes;
  final bool consentGiven;
  final String? submittedByUid;
  final String? submittedByEmail;
  final String paymentStatus;
  final double? paymentAmount;
  final String? paymentReference;
  final String? paymentNotes;
  final String? paymentMarkedBy;
  final String? paymentMarkedByName;
  final DateTime? paymentMarkedAt;
  final String? sponsorshipId;
  final String? sponsorName;
  final String? sponsorshipAssignedBy;
  final String? sponsorshipAssignedByName;
  final DateTime? sponsorshipAssignedAt;
  final String? checkInCode;
  final bool checkedIn;
  final DateTime? checkedInAt;
  final String? checkedInBy;
  final String? checkedInByName;
  final DateTime? qrEmailSentAt;
  final String? qrEmailSentTo;
  final int qrEmailCount;
  final bool onPass;
  final String? activePassId;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CampRegistration({
    required this.id,
    required this.campId,
    required this.firstName,
    required this.lastName,
    required this.dateOfBirth,
    required this.gender,
    required this.phone,
    this.email,
    required this.churchOrSchool,
    required this.emergencyContactName,
    required this.emergencyContactPhone,
    this.emergencyContactRelationship,
    this.medicalNotes,
    this.allergies,
    this.medications,
    this.tshirtSize,
    this.dietaryPreference,
    this.parentName,
    this.parentRelationship,
    this.parentAltPhone,
    this.parentEmail,
    this.address,
    this.dropoffLocation,
    this.notes,
    this.consentGiven = false,
    this.submittedByUid,
    this.submittedByEmail,
    required this.paymentStatus,
    this.paymentAmount,
    this.paymentReference,
    this.paymentNotes,
    this.paymentMarkedBy,
    this.paymentMarkedByName,
    this.paymentMarkedAt,
    this.sponsorshipId,
    this.sponsorName,
    this.sponsorshipAssignedBy,
    this.sponsorshipAssignedByName,
    this.sponsorshipAssignedAt,
    this.checkInCode,
    this.checkedIn = false,
    this.checkedInAt,
    this.checkedInBy,
    this.checkedInByName,
    this.qrEmailSentAt,
    this.qrEmailSentTo,
    this.qrEmailCount = 0,
    this.onPass = false,
    this.activePassId,
    required this.createdAt,
    required this.updatedAt,
  });

  String get fullName => '$firstName $lastName'.trim();

  bool get isSponsored => sponsorshipId != null;

  factory CampRegistration.fromMap(Map<String, dynamic> map) =>
      CampRegistration(
        id: asString(map['id']),
        campId: asString(map['campId']),
        firstName: asString(map['firstName']),
        lastName: asString(map['lastName']),
        dateOfBirth: asString(map['dateOfBirth']),
        gender: asString(map['gender']),
        phone: asString(map['phone']),
        email: asStringOrNull(map['email']),
        churchOrSchool: asString(map['churchOrSchool']),
        emergencyContactName: asString(map['emergencyContactName']),
        emergencyContactPhone: asString(map['emergencyContactPhone']),
        emergencyContactRelationship:
            asStringOrNull(map['emergencyContactRelationship']),
        medicalNotes: asStringOrNull(map['medicalNotes']),
        allergies: asStringOrNull(map['allergies']),
        medications: asStringOrNull(map['medications']),
        tshirtSize: asStringOrNull(map['tshirtSize']),
        dietaryPreference: asStringOrNull(map['dietaryPreference']),
        parentName: asStringOrNull(map['parentName']),
        parentRelationship: asStringOrNull(map['parentRelationship']),
        parentAltPhone: asStringOrNull(map['parentAltPhone']),
        parentEmail: asStringOrNull(map['parentEmail']),
        address: asStringOrNull(map['address']),
        dropoffLocation: asStringOrNull(map['dropoffLocation']),
        notes: asStringOrNull(map['notes']),
        consentGiven: asBool(map['consentGiven']),
        submittedByUid: asStringOrNull(map['submittedByUid']),
        submittedByEmail: asStringOrNull(map['submittedByEmail']),
        paymentStatus:
            asString(map['paymentStatus'], CampPaymentStatus.unpaid),
        paymentAmount: asDoubleOrNull(map['paymentAmount']),
        paymentReference: asStringOrNull(map['paymentReference']),
        paymentNotes: asStringOrNull(map['paymentNotes']),
        paymentMarkedBy: asStringOrNull(map['paymentMarkedBy']),
        paymentMarkedByName: asStringOrNull(map['paymentMarkedByName']),
        paymentMarkedAt: parseDateOrNull(map['paymentMarkedAt']),
        sponsorshipId: asStringOrNull(map['sponsorshipId']),
        sponsorName: asStringOrNull(map['sponsorName']),
        sponsorshipAssignedBy: asStringOrNull(map['sponsorshipAssignedBy']),
        sponsorshipAssignedByName:
            asStringOrNull(map['sponsorshipAssignedByName']),
        sponsorshipAssignedAt: parseDateOrNull(map['sponsorshipAssignedAt']),
        checkInCode: asStringOrNull(map['checkInCode']),
        checkedIn: asBool(map['checkedIn']),
        checkedInAt: parseDateOrNull(map['checkedInAt']),
        checkedInBy: asStringOrNull(map['checkedInBy']),
        checkedInByName: asStringOrNull(map['checkedInByName']),
        qrEmailSentAt: parseDateOrNull(map['qrEmailSentAt']),
        qrEmailSentTo: asStringOrNull(map['qrEmailSentTo']),
        qrEmailCount: asInt(map['qrEmailCount']),
        onPass: asBool(map['onPass']),
        activePassId: asStringOrNull(map['activePassId']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class CampPassStatus {
  static const pendingAdmissions = 'PENDING_ADMISSIONS';
  static const pendingManager = 'PENDING_MANAGER';
  static const pendingChair = 'PENDING_CHAIR';
  static const approved = 'APPROVED';
  static const out = 'OUT';
  static const returned = 'RETURNED';
  static const rejected = 'REJECTED';
  static const cancelled = 'CANCELLED';
}

class CampPassStage {
  static const admissions = 'ADMISSIONS';
  static const manager = 'MANAGER';
  static const chair = 'CHAIR';
}

class CampPass {
  final String id;
  final String campId;
  final String registrationId;
  final String camperName;
  final String camperFirstName;
  final String? camperPhone;
  final String? contactEmail;
  final String reason;
  final String? destination;
  final String? escortName;
  final String? escortPhone;
  final DateTime expectedReturnAt;
  final String status;
  final String requestSource; // CAMPER | ADMISSIONS
  final String? requestedByUid;
  final String requestedByName;
  final String? admissionsId;
  final String? admissionsName;
  final DateTime? admissionsDecidedAt;
  final String? admissionsComments;
  final String? managerId;
  final String? managerName;
  final DateTime? managerDecidedAt;
  final String? managerComments;
  final String? chairId;
  final String? chairName;
  final DateTime? chairDecidedAt;
  final String? chairComments;
  final String? rejectedStage;
  final String? passCode;
  final DateTime? passIssuedAt;
  final DateTime? passEmailSentAt;
  final String? passEmailSentTo;
  final int passEmailCount;
  final DateTime? checkedOutAt;
  final String? checkedOutBy;
  final String? checkedOutByName;
  final DateTime? checkedInAt;
  final String? checkedInBy;
  final String? checkedInByName;
  final bool returnedLate;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CampPass({
    required this.id,
    required this.campId,
    required this.registrationId,
    required this.camperName,
    required this.camperFirstName,
    this.camperPhone,
    this.contactEmail,
    required this.reason,
    this.destination,
    this.escortName,
    this.escortPhone,
    required this.expectedReturnAt,
    required this.status,
    required this.requestSource,
    this.requestedByUid,
    required this.requestedByName,
    this.admissionsId,
    this.admissionsName,
    this.admissionsDecidedAt,
    this.admissionsComments,
    this.managerId,
    this.managerName,
    this.managerDecidedAt,
    this.managerComments,
    this.chairId,
    this.chairName,
    this.chairDecidedAt,
    this.chairComments,
    this.rejectedStage,
    this.passCode,
    this.passIssuedAt,
    this.passEmailSentAt,
    this.passEmailSentTo,
    this.passEmailCount = 0,
    this.checkedOutAt,
    this.checkedOutBy,
    this.checkedOutByName,
    this.checkedInAt,
    this.checkedInBy,
    this.checkedInByName,
    this.returnedLate = false,
    this.statusHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory CampPass.fromMap(Map<String, dynamic> map) => CampPass(
        id: asString(map['id']),
        campId: asString(map['campId']),
        registrationId: asString(map['registrationId']),
        camperName: asString(map['camperName']),
        camperFirstName: asString(map['camperFirstName']),
        camperPhone: asStringOrNull(map['camperPhone']),
        contactEmail: asStringOrNull(map['contactEmail']),
        reason: asString(map['reason']),
        destination: asStringOrNull(map['destination']),
        escortName: asStringOrNull(map['escortName']),
        escortPhone: asStringOrNull(map['escortPhone']),
        expectedReturnAt: parseDate(map['expectedReturnAt']),
        status: asString(map['status'], CampPassStatus.pendingAdmissions),
        requestSource: asString(map['requestSource'], 'ADMISSIONS'),
        requestedByUid: asStringOrNull(map['requestedByUid']),
        requestedByName: asString(map['requestedByName']),
        admissionsId: asStringOrNull(map['admissionsId']),
        admissionsName: asStringOrNull(map['admissionsName']),
        admissionsDecidedAt: parseDateOrNull(map['admissionsDecidedAt']),
        admissionsComments: asStringOrNull(map['admissionsComments']),
        managerId: asStringOrNull(map['managerId']),
        managerName: asStringOrNull(map['managerName']),
        managerDecidedAt: parseDateOrNull(map['managerDecidedAt']),
        managerComments: asStringOrNull(map['managerComments']),
        chairId: asStringOrNull(map['chairId']),
        chairName: asStringOrNull(map['chairName']),
        chairDecidedAt: parseDateOrNull(map['chairDecidedAt']),
        chairComments: asStringOrNull(map['chairComments']),
        rejectedStage: asStringOrNull(map['rejectedStage']),
        passCode: asStringOrNull(map['passCode']),
        passIssuedAt: parseDateOrNull(map['passIssuedAt']),
        passEmailSentAt: parseDateOrNull(map['passEmailSentAt']),
        passEmailSentTo: asStringOrNull(map['passEmailSentTo']),
        passEmailCount: asInt(map['passEmailCount']),
        checkedOutAt: parseDateOrNull(map['checkedOutAt']),
        checkedOutBy: asStringOrNull(map['checkedOutBy']),
        checkedOutByName: asStringOrNull(map['checkedOutByName']),
        checkedInAt: parseDateOrNull(map['checkedInAt']),
        checkedInBy: asStringOrNull(map['checkedInBy']),
        checkedInByName: asStringOrNull(map['checkedInByName']),
        returnedLate: asBool(map['returnedLate']),
        statusHistory: StatusHistoryEntry.listFrom(map['statusHistory']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class CampSponsorship {
  final String id;
  final String campId;
  final String sponsorName;
  final String? organization;
  final String phone;
  final String? email;
  final String pledgeType; // SLOTS | AMOUNT
  final int slotsPledged;
  final double amountPledged;
  final int slotsAssigned;
  final String? notes;
  final String paymentStatus; // UNPAID | PARTIAL | PAID
  final double? amountReceived;
  final String? paymentReference;
  final String? paymentNotes;
  final String? paymentMarkedBy;
  final String? paymentMarkedByName;
  final DateTime? paymentMarkedAt;
  final String? submittedByUid;
  final String? submittedByEmail;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CampSponsorship({
    required this.id,
    required this.campId,
    required this.sponsorName,
    this.organization,
    required this.phone,
    this.email,
    required this.pledgeType,
    required this.slotsPledged,
    required this.amountPledged,
    this.slotsAssigned = 0,
    this.notes,
    required this.paymentStatus,
    this.amountReceived,
    this.paymentReference,
    this.paymentNotes,
    this.paymentMarkedBy,
    this.paymentMarkedByName,
    this.paymentMarkedAt,
    this.submittedByUid,
    this.submittedByEmail,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CampSponsorship.fromMap(Map<String, dynamic> map) =>
      CampSponsorship(
        id: asString(map['id']),
        campId: asString(map['campId']),
        sponsorName: asString(map['sponsorName']),
        organization: asStringOrNull(map['organization']),
        phone: asString(map['phone']),
        email: asStringOrNull(map['email']),
        pledgeType: asString(map['pledgeType'], 'SLOTS'),
        slotsPledged: asInt(map['slotsPledged']),
        amountPledged: asDouble(map['amountPledged']),
        slotsAssigned: asInt(map['slotsAssigned']),
        notes: asStringOrNull(map['notes']),
        paymentStatus: asString(map['paymentStatus'], 'UNPAID'),
        amountReceived: asDoubleOrNull(map['amountReceived']),
        paymentReference: asStringOrNull(map['paymentReference']),
        paymentNotes: asStringOrNull(map['paymentNotes']),
        paymentMarkedBy: asStringOrNull(map['paymentMarkedBy']),
        paymentMarkedByName: asStringOrNull(map['paymentMarkedByName']),
        paymentMarkedAt: parseDateOrNull(map['paymentMarkedAt']),
        submittedByUid: asStringOrNull(map['submittedByUid']),
        submittedByEmail: asStringOrNull(map['submittedByEmail']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class CampDefinition {
  final String id;
  final String name;
  final String startDate;
  final String endDate;
  final int capacity;
  final double fee;
  final String currency;
  final String? venue;

  const CampDefinition({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.capacity,
    required this.fee,
    required this.currency,
    this.venue,
  });

  factory CampDefinition.fromMap(Map<String, dynamic> map) => CampDefinition(
        id: asString(map['id']),
        name: asString(map['name']),
        startDate: asString(map['startDate']),
        endDate: asString(map['endDate']),
        capacity: asInt(map['capacity']),
        fee: asDouble(map['fee']),
        currency: asString(map['currency'], 'ZMW'),
        venue: asStringOrNull(map['venue']),
      );
}

class CampBroadcastOutcome {
  final String registrationId;
  final String name;
  final String? to;
  final String status; // sent | skipped | failed
  final String? reason;

  const CampBroadcastOutcome({
    required this.registrationId,
    required this.name,
    this.to,
    required this.status,
    this.reason,
  });

  factory CampBroadcastOutcome.fromMap(Map<String, dynamic> map) =>
      CampBroadcastOutcome(
        registrationId: asString(map['registrationId']),
        name: asString(map['name']),
        to: asStringOrNull(map['to']),
        status: asString(map['status']),
        reason: asStringOrNull(map['reason']),
      );
}

class CampBroadcast {
  final String id;
  final String campId;
  final String subject;
  final String body;
  final String audience;
  final List<String> selectedIds;
  final String? ctaLabel;
  final String? ctaUrl;
  final String? replyTo;
  final String sentBy;
  final String sentByName;
  final DateTime sentAt;
  final int recipientCount;
  final int sentCount;
  final int skippedCount;
  final int failedCount;
  final List<CampBroadcastOutcome> outcomes;

  const CampBroadcast({
    required this.id,
    required this.campId,
    required this.subject,
    required this.body,
    required this.audience,
    this.selectedIds = const [],
    this.ctaLabel,
    this.ctaUrl,
    this.replyTo,
    required this.sentBy,
    required this.sentByName,
    required this.sentAt,
    this.recipientCount = 0,
    this.sentCount = 0,
    this.skippedCount = 0,
    this.failedCount = 0,
    this.outcomes = const [],
  });

  factory CampBroadcast.fromMap(Map<String, dynamic> map) => CampBroadcast(
        id: asString(map['id']),
        campId: asString(map['campId']),
        subject: asString(map['subject']),
        body: asString(map['body']),
        audience: asString(map['audience'], 'ALL'),
        selectedIds: asStringList(map['selectedIds']),
        ctaLabel: asStringOrNull(map['ctaLabel']),
        ctaUrl: asStringOrNull(map['ctaUrl']),
        replyTo: asStringOrNull(map['replyTo']),
        sentBy: asString(map['sentBy']),
        sentByName: asString(map['sentByName']),
        sentAt: parseDate(map['sentAt']),
        recipientCount: asInt(map['recipientCount']),
        sentCount: asInt(map['sentCount']),
        skippedCount: asInt(map['skippedCount']),
        failedCount: asInt(map['failedCount']),
        outcomes: asMapList(map['outcomes'])
            .map(CampBroadcastOutcome.fromMap)
            .toList(),
      );
}

class CampMealSlot {
  static const breakfast = 'BREAKFAST';
  static const lunch = 'LUNCH';
  static const dinner = 'DINNER';
  static const all = [breakfast, lunch, dinner];
}

class CampMealSitting {
  final String id; // `${campId}_${date}_${slot}`
  final String campId;
  final String date; // yyyy-MM-dd
  final String slot;
  final String label;
  final String opensAt; // HH:mm
  final String closesAt;

  const CampMealSitting({
    required this.id,
    required this.campId,
    required this.date,
    required this.slot,
    required this.label,
    required this.opensAt,
    required this.closesAt,
  });

  factory CampMealSitting.fromMap(Map<String, dynamic> map) =>
      CampMealSitting(
        id: asString(map['id']),
        campId: asString(map['campId']),
        date: asString(map['date']),
        slot: asString(map['slot']),
        label: asString(map['label']),
        opensAt: asString(map['opensAt']),
        closesAt: asString(map['closesAt']),
      );
}

class CampMealScan {
  final String id; // `${sittingId}_${registrationId}`
  final String campId;
  final String sittingId;
  final String date;
  final String slot;
  final String registrationId;
  final String camperName;
  final String? camperGender;
  final String? dietaryPreference;
  final String? allergies;
  final DateTime servedAt;
  final String servedBy;
  final String servedByName;
  final bool paymentFlagged;
  final bool queuedOffline;

  const CampMealScan({
    required this.id,
    required this.campId,
    required this.sittingId,
    required this.date,
    required this.slot,
    required this.registrationId,
    required this.camperName,
    this.camperGender,
    this.dietaryPreference,
    this.allergies,
    required this.servedAt,
    required this.servedBy,
    required this.servedByName,
    this.paymentFlagged = false,
    this.queuedOffline = false,
  });

  factory CampMealScan.fromMap(Map<String, dynamic> map) => CampMealScan(
        id: asString(map['id']),
        campId: asString(map['campId']),
        sittingId: asString(map['sittingId']),
        date: asString(map['date']),
        slot: asString(map['slot']),
        registrationId: asString(map['registrationId']),
        camperName: asString(map['camperName']),
        camperGender: asStringOrNull(map['camperGender']),
        dietaryPreference: asStringOrNull(map['dietaryPreference']),
        allergies: asStringOrNull(map['allergies']),
        servedAt: parseDate(map['servedAt']),
        servedBy: asString(map['servedBy']),
        servedByName: asString(map['servedByName']),
        paymentFlagged: asBool(map['paymentFlagged']),
        queuedOffline: asBool(map['queuedOffline']),
      );
}
