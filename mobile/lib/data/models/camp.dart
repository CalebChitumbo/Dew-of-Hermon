import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// The static catalog entry for a camp. Port of `CampDefinition` and the
/// `CAMPS` list in `src/lib/camps.ts`.
class CampDefinition {
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

  final String id;
  final String name;

  /// yyyy-MM-dd.
  final String startDate;
  final String endDate;
  final int capacity;
  final double fee;
  final String currency;
  final String? venue;

  DateTime? get start => DateTime.tryParse(startDate);
  DateTime? get end => DateTime.tryParse(endDate);
}

/// The camps people can register for. The id is the Firestore `campId` that
/// scopes registrations.
const List<CampDefinition> kCamps = [
  CampDefinition(
    id: 'rops-x-2026',
    name: 'ROPs X Camp 2026',
    startDate: '2026-08-27',
    endDate: '2026-08-31',
    capacity: 80,
    fee: 400,
    currency: 'ZMW',
    venue: 'Crested Crane Academy',
  ),
];

const String kDefaultCampId = 'rops-x-2026';

/// Mobile money number campers send payment + proof of payment to.
const String kCampPaymentNumber = '0975088939';

/// Name of the Firestore department whose lead is a ROPs Camp Admin Lead.
const String kRopsCampDepartmentName = 'ROPs Camp';

CampDefinition? getCamp(String campId) {
  for (final c in kCamps) {
    if (c.id == campId) return c;
  }
  return null;
}

/// Short payment reference derived from the registration document id.
String buildCampPaymentReference(String registrationId) {
  final upper = registrationId.toUpperCase();
  return upper.length <= 8 ? upper : upper.substring(upper.length - 8);
}

/// People to contact for camp questions, shown in public page footers.
class CampContact {
  const CampContact(this.name, this.role, this.phone);
  final String name;
  final String role;
  final String phone;
}

const List<CampContact> kCampContacts = [
  CampContact('Caleb Chitumbo', 'Chairperson', '0979 414 477'),
  CampContact('Joseph Mizinga', 'ROPs Manager', '0972 894 046'),
  CampContact('Mercy Kosta Kaonda', 'Vice Chairperson', '0977 806 404'),
];

/// A camper's registration. Mirrors `CampRegistration`.
class CampRegistration {
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
    required this.tshirtSize,
    this.dietaryPreference,
    this.parentName,
    this.parentRelationship,
    this.parentAltPhone,
    this.parentEmail,
    this.address,
    this.dropoffLocation,
    this.notes,
    this.consentGiven = false,
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

  factory CampRegistration.fromMap(Map<String, dynamic> map) {
    return CampRegistration(
      id: parseStringOr(map['id']),
      campId: parseStringOr(map['campId'], kDefaultCampId),
      firstName: parseStringOr(map['firstName']),
      lastName: parseStringOr(map['lastName']),
      dateOfBirth: parseStringOr(map['dateOfBirth']),
      gender: CampGender.fromWire(map['gender']),
      phone: parseStringOr(map['phone']),
      email: parseString(map['email']),
      churchOrSchool: parseStringOr(map['churchOrSchool']),
      emergencyContactName: parseStringOr(map['emergencyContactName']),
      emergencyContactPhone: parseStringOr(map['emergencyContactPhone']),
      emergencyContactRelationship:
          parseString(map['emergencyContactRelationship']),
      medicalNotes: parseString(map['medicalNotes']),
      allergies: parseString(map['allergies']),
      medications: parseString(map['medications']),
      tshirtSize: CampTShirtSize.fromWire(map['tshirtSize']),
      dietaryPreference: parseString(map['dietaryPreference']),
      parentName: parseString(map['parentName']),
      parentRelationship: parseString(map['parentRelationship']),
      parentAltPhone: parseString(map['parentAltPhone']),
      parentEmail: parseString(map['parentEmail']),
      address: parseString(map['address']),
      dropoffLocation:
          CampDropoffLocation.fromWireOrNull(map['dropoffLocation']),
      notes: parseString(map['notes']),
      consentGiven: parseBool(map['consentGiven']),
      paymentStatus: CampPaymentStatus.fromWire(map['paymentStatus']),
      paymentAmount: parseDouble(map['paymentAmount']),
      paymentReference: parseString(map['paymentReference']),
      paymentNotes: parseString(map['paymentNotes']),
      paymentMarkedBy: parseString(map['paymentMarkedBy']),
      paymentMarkedByName: parseString(map['paymentMarkedByName']),
      paymentMarkedAt: parseDate(map['paymentMarkedAt']),
      sponsorshipId: parseString(map['sponsorshipId']),
      sponsorName: parseString(map['sponsorName']),
      sponsorshipAssignedBy: parseString(map['sponsorshipAssignedBy']),
      sponsorshipAssignedByName: parseString(map['sponsorshipAssignedByName']),
      sponsorshipAssignedAt: parseDate(map['sponsorshipAssignedAt']),
      checkInCode: parseString(map['checkInCode']),
      checkedIn: parseBool(map['checkedIn']),
      checkedInAt: parseDate(map['checkedInAt']),
      checkedInBy: parseString(map['checkedInBy']),
      checkedInByName: parseString(map['checkedInByName']),
      qrEmailSentAt: parseDate(map['qrEmailSentAt']),
      qrEmailSentTo: parseString(map['qrEmailSentTo']),
      qrEmailCount: parseIntOr(map['qrEmailCount']),
      onPass: parseBool(map['onPass']),
      activePassId: parseString(map['activePassId']),
      createdAt: parseDateOr(map['createdAt']),
      updatedAt: parseDateOr(map['updatedAt']),
    );
  }

  final String id;
  final String campId;
  final String firstName;
  final String lastName;

  /// yyyy-MM-dd.
  final String dateOfBirth;
  final CampGender gender;
  final String phone;
  final String? email;
  final String churchOrSchool;
  final String emergencyContactName;
  final String emergencyContactPhone;
  final String? emergencyContactRelationship;
  final String? medicalNotes;
  final String? allergies;
  final String? medications;
  final CampTShirtSize tshirtSize;
  final String? dietaryPreference;
  final String? parentName;
  final String? parentRelationship;
  final String? parentAltPhone;
  final String? parentEmail;
  final String? address;
  final CampDropoffLocation? dropoffLocation;
  final String? notes;
  final bool consentGiven;

  final CampPaymentStatus paymentStatus;
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

  /// Secret code embedded in the camper's QR pass.
  final String? checkInCode;
  final bool checkedIn;
  final DateTime? checkedInAt;
  final String? checkedInBy;
  final String? checkedInByName;

  final DateTime? qrEmailSentAt;
  final String? qrEmailSentTo;
  final int qrEmailCount;

  /// True while the camper is off-site on an approved exit pass.
  final bool onPass;
  final String? activePassId;

  final DateTime createdAt;
  final DateTime updatedAt;

  String get fullName => '$firstName $lastName'.trim();
  bool get isPaid => paymentStatus == CampPaymentStatus.paid;
  bool get isSponsored => (sponsorshipId ?? '').isNotEmpty;

  /// Neither paid nor sponsored — flagged for the manager, never a reason to
  /// refuse a camper food or a bed.
  bool get isPaymentFlagged => !isPaid && !isSponsored;

  /// Age at the start of the camp, for the medical and dorm lists.
  int? ageAt(DateTime when) {
    final dob = DateTime.tryParse(dateOfBirth);
    if (dob == null) return null;
    var age = when.year - dob.year;
    if (when.month < dob.month ||
        (when.month == dob.month && when.day < dob.day)) {
      age--;
    }
    return age < 0 || age > 120 ? null : age;
  }

  int? get age => ageAt(DateTime.now());

  /// True when a guardian must sign the camper out.
  bool get isMinor {
    final a = age;
    return a != null && a < 18;
  }
}

/// One approval step recorded on a pass. Mirrors `CampPassStatusHistoryEntry`.
class StatusHistoryEntry {
  const StatusHistoryEntry({
    required this.status,
    required this.changedBy,
    required this.changedByName,
    required this.changedAt,
    this.comments,
  });

  factory StatusHistoryEntry.fromMap(Map<String, dynamic> map) =>
      StatusHistoryEntry(
        status: parseStringOr(map['status']),
        changedBy: parseStringOr(map['changedBy']),
        changedByName: parseStringOr(map['changedByName']),
        changedAt: parseDateOr(map['changedAt']),
        comments: parseString(map['comments']),
      );

  final String status;
  final String changedBy;
  final String changedByName;
  final DateTime changedAt;
  final String? comments;
}

/// A camper's request to leave camp temporarily. Mirrors `CampPass`.
class CampPass {
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
        id: parseStringOr(map['id']),
        campId: parseStringOr(map['campId'], kDefaultCampId),
        registrationId: parseStringOr(map['registrationId']),
        camperName: parseStringOr(map['camperName']),
        camperFirstName: parseStringOr(map['camperFirstName']),
        camperPhone: parseString(map['camperPhone']),
        contactEmail: parseString(map['contactEmail']),
        reason: parseStringOr(map['reason']),
        destination: parseString(map['destination']),
        escortName: parseString(map['escortName']),
        escortPhone: parseString(map['escortPhone']),
        expectedReturnAt: parseDateOr(map['expectedReturnAt']),
        status: CampPassStatus.fromWire(map['status']),
        requestSource: CampPassRequestSource.fromWire(map['requestSource']),
        requestedByUid: parseString(map['requestedByUid']),
        requestedByName: parseStringOr(map['requestedByName']),
        admissionsId: parseString(map['admissionsId']),
        admissionsName: parseString(map['admissionsName']),
        admissionsDecidedAt: parseDate(map['admissionsDecidedAt']),
        admissionsComments: parseString(map['admissionsComments']),
        managerId: parseString(map['managerId']),
        managerName: parseString(map['managerName']),
        managerDecidedAt: parseDate(map['managerDecidedAt']),
        managerComments: parseString(map['managerComments']),
        chairId: parseString(map['chairId']),
        chairName: parseString(map['chairName']),
        chairDecidedAt: parseDate(map['chairDecidedAt']),
        chairComments: parseString(map['chairComments']),
        rejectedStage: CampPassStage.fromWireOrNull(map['rejectedStage']),
        passCode: parseString(map['passCode']),
        passIssuedAt: parseDate(map['passIssuedAt']),
        passEmailSentAt: parseDate(map['passEmailSentAt']),
        passEmailSentTo: parseString(map['passEmailSentTo']),
        passEmailCount: parseIntOr(map['passEmailCount']),
        checkedOutAt: parseDate(map['checkedOutAt']),
        checkedOutBy: parseString(map['checkedOutBy']),
        checkedOutByName: parseString(map['checkedOutByName']),
        checkedInAt: parseDate(map['checkedInAt']),
        checkedInBy: parseString(map['checkedInBy']),
        checkedInByName: parseString(map['checkedInByName']),
        returnedLate: parseBool(map['returnedLate']),
        statusHistory: parseMapList(map['statusHistory'])
            .map(StatusHistoryEntry.fromMap)
            .toList(),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

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
  final CampPassStatus status;
  final CampPassRequestSource requestSource;
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

  final CampPassStage? rejectedStage;

  /// Minted only on the Chairperson's approval — nothing scannable exists
  /// before that.
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

  /// The stage that must sign off next, or null once the chain is done.
  CampPassStage? get awaitingStage => switch (status) {
        CampPassStatus.pendingAdmissions => CampPassStage.admissions,
        CampPassStatus.pendingManager => CampPassStage.manager,
        CampPassStatus.pendingChair => CampPassStage.chair,
        _ => null,
      };

  bool get isOverdue =>
      status == CampPassStatus.out &&
      DateTime.now().isAfter(expectedReturnAt);
}

/// A sponsorship pledge for a camp. Mirrors `CampSponsorship`.
class CampSponsorship {
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

  factory CampSponsorship.fromMap(Map<String, dynamic> map) => CampSponsorship(
        id: parseStringOr(map['id']),
        campId: parseStringOr(map['campId'], kDefaultCampId),
        sponsorName: parseStringOr(map['sponsorName']),
        organization: parseString(map['organization']),
        phone: parseStringOr(map['phone']),
        email: parseString(map['email']),
        pledgeType: CampSponsorshipPledgeType.fromWire(map['pledgeType']),
        slotsPledged: parseIntOr(map['slotsPledged']),
        amountPledged: parseDoubleOr(map['amountPledged']),
        slotsAssigned: parseIntOr(map['slotsAssigned']),
        notes: parseString(map['notes']),
        paymentStatus:
            CampSponsorshipPaymentStatus.fromWire(map['paymentStatus']),
        amountReceived: parseDouble(map['amountReceived']),
        paymentReference: parseString(map['paymentReference']),
        paymentNotes: parseString(map['paymentNotes']),
        paymentMarkedBy: parseString(map['paymentMarkedBy']),
        paymentMarkedByName: parseString(map['paymentMarkedByName']),
        paymentMarkedAt: parseDate(map['paymentMarkedAt']),
        submittedByUid: parseString(map['submittedByUid']),
        submittedByEmail: parseString(map['submittedByEmail']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String campId;
  final String sponsorName;
  final String? organization;
  final String phone;
  final String? email;
  final CampSponsorshipPledgeType pledgeType;
  final int slotsPledged;
  final double amountPledged;
  final int slotsAssigned;
  final String? notes;
  final CampSponsorshipPaymentStatus paymentStatus;
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

  int get slotsRemaining =>
      (slotsPledged - slotsAssigned).clamp(0, slotsPledged);
  bool get isFullyAssigned => slotsAssigned >= slotsPledged;
  String get displayName =>
      organization == null || organization!.isEmpty
          ? sponsorName
          : '$sponsorName · $organization';
}

/// A camper served at a sitting. Mirrors `CampMealScan`.
class CampMealScan {
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
        id: parseStringOr(map['id']),
        campId: parseStringOr(map['campId'], kDefaultCampId),
        sittingId: parseStringOr(map['sittingId']),
        date: parseStringOr(map['date']),
        slot: CampMealSlot.fromWire(map['slot']),
        registrationId: parseStringOr(map['registrationId']),
        camperName: parseStringOr(map['camperName']),
        camperGender: CampGender.fromWireOrNull(map['camperGender']),
        dietaryPreference: parseString(map['dietaryPreference']),
        allergies: parseString(map['allergies']),
        servedAt: parseDateOr(map['servedAt']),
        servedBy: parseStringOr(map['servedBy']),
        servedByName: parseStringOr(map['servedByName']),
        paymentFlagged: parseBool(map['paymentFlagged']),
        queuedOffline: parseBool(map['queuedOffline']),
      );

  final String id;
  final String campId;
  final String sittingId;
  final String date;
  final CampMealSlot slot;
  final String registrationId;
  final String camperName;
  final CampGender? camperGender;
  final String? dietaryPreference;
  final String? allergies;
  final DateTime servedAt;
  final String servedBy;
  final String servedByName;

  /// Recorded when the camper was neither paid nor sponsored at serving time.
  final bool paymentFlagged;

  /// True when the scan was taken offline and synced later.
  final bool queuedOffline;
}

/// One announcement, delivered as a personalised copy to every camper in the
/// chosen audience. Mirrors `CampBroadcast`.
class CampBroadcast {
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
        id: parseStringOr(map['id']),
        campId: parseStringOr(map['campId'], kDefaultCampId),
        subject: parseStringOr(map['subject']),
        body: parseStringOr(map['body']),
        audience: CampBroadcastAudience.fromWire(map['audience']),
        selectedIds: parseStringList(map['selectedIds']),
        ctaLabel: parseString(map['ctaLabel']),
        ctaUrl: parseString(map['ctaUrl']),
        replyTo: parseString(map['replyTo']),
        sentBy: parseStringOr(map['sentBy']),
        sentByName: parseStringOr(map['sentByName']),
        sentAt: parseDateOr(map['sentAt']),
        recipientCount: parseIntOr(map['recipientCount']),
        sentCount: parseIntOr(map['sentCount']),
        skippedCount: parseIntOr(map['skippedCount']),
        failedCount: parseIntOr(map['failedCount']),
        outcomes: parseMapList(map['outcomes'])
            .map(CampBroadcastOutcome.fromMap)
            .toList(),
      );

  final String id;
  final String campId;
  final String subject;
  final String body;
  final CampBroadcastAudience audience;
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
}

/// What happened to one camper's copy of a broadcast.
class CampBroadcastOutcome {
  const CampBroadcastOutcome({
    required this.registrationId,
    required this.name,
    this.to,
    required this.status,
    this.reason,
  });

  factory CampBroadcastOutcome.fromMap(Map<String, dynamic> map) =>
      CampBroadcastOutcome(
        registrationId: parseStringOr(map['registrationId']),
        name: parseStringOr(map['name']),
        to: parseString(map['to']),
        status: CampBroadcastOutcomeStatus.fromWire(map['status']),
        reason: parseString(map['reason']),
      );

  final String registrationId;
  final String name;
  final String? to;
  final CampBroadcastOutcomeStatus status;
  final String? reason;
}
