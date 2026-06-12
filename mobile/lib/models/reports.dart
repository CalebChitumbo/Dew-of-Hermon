import '../core/fire.dart';

/// Post-event report (eventReports collection, keyed by eventId).
class EventReportModel {
  EventReportModel({
    required this.eventId,
    required this.eventTitle,
    required this.eventStartDate,
    required this.initiatorName,
    required this.status,
    required this.attendanceCount,
    required this.objectivesMetRating,
    required this.highlights,
    required this.challenges,
    required this.lessonsLearned,
    required this.recommendations,
    required this.financesBudget,
    required this.financesActualSpend,
    required this.financesNotes,
    required this.mediaLink,
    required this.additionalComments,
    required this.reviewComments,
    required this.submittedAt,
  });

  final String eventId;
  final String eventTitle;
  final DateTime? eventStartDate;
  final String initiatorName;
  final String status; // DRAFT | SUBMITTED | REVIEWED | CHANGES_REQUESTED
  final int? attendanceCount;
  final int? objectivesMetRating;
  final String highlights;
  final String challenges;
  final String lessonsLearned;
  final String recommendations;
  final num? financesBudget;
  final num? financesActualSpend;
  final String? financesNotes;
  final String? mediaLink;
  final String? additionalComments;
  final String? reviewComments;
  final DateTime? submittedAt;

  factory EventReportModel.fromJson(Map<String, dynamic> m) {
    final finances = m['finances'] is Map
        ? (m['finances'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    return EventReportModel(
      eventId: asString(m['eventId'] ?? m['id']),
      eventTitle: asString(m['eventTitle'], 'Event'),
      eventStartDate: asDateOrNull(m['eventStartDate']),
      initiatorName: asString(m['initiatorName']),
      status: asString(m['status'], 'DRAFT'),
      attendanceCount: asNumOrNull(m['attendanceCount'])?.toInt(),
      objectivesMetRating: asNumOrNull(m['objectivesMetRating'])?.toInt(),
      highlights: asString(m['highlights']),
      challenges: asString(m['challenges']),
      lessonsLearned: asString(m['lessonsLearned']),
      recommendations: asString(m['recommendations']),
      financesBudget: asNumOrNull(finances['budget']),
      financesActualSpend: asNumOrNull(finances['actualSpend']),
      financesNotes: asStringOrNull(finances['notes']),
      mediaLink: asStringOrNull(m['mediaLink']),
      additionalComments: asStringOrNull(m['additionalComments']),
      reviewComments: asStringOrNull(m['reviewComments']),
      submittedAt: asDateOrNull(m['submittedAt']),
    );
  }
}

/// Event eligible for a post-event report (GET /api/event-reports/eligible-events).
class EligibleEvent {
  EligibleEvent({
    required this.id,
    required this.title,
    required this.startDate,
    required this.reportStatus,
  });

  final String id;
  final String title;
  final DateTime? startDate;
  final String? reportStatus; // null = not started

  factory EligibleEvent.fromJson(Map<String, dynamic> m) {
    return EligibleEvent(
      id: asString(m['id']),
      title: asString(m['title'], 'Event'),
      startDate: asDateOrNull(m['startDate']),
      reportStatus: asStringOrNull(m['reportStatus']),
    );
  }
}
