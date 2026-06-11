import '../core/fire.dart';

/// Mirror of the static camp catalog in src/lib/camps.ts. The server is the
/// source of truth for validation and capacity; this only drives display.
class CampInfo {
  const CampInfo({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.capacity,
    required this.fee,
    required this.currency,
  });

  final String id;
  final String name;
  final String startDate; // yyyy-MM-dd
  final String endDate; // yyyy-MM-dd
  final int capacity;
  final num fee;
  final String currency;
}

const camps = <CampInfo>[
  CampInfo(
    id: 'rops-x-2026',
    name: 'ROPs X Camp 2026',
    startDate: '2026-08-27',
    endDate: '2026-08-31',
    capacity: 80,
    fee: 400,
    currency: 'ZMW',
  ),
];

CampInfo get defaultCamp => camps.first;

/// Mobile-money number campers pay to (see PaymentInstructionsCard.tsx).
const campPaymentNumber = '0975088939';

/// Payment reference shown to the camper — last 8 chars of the
/// registration id, uppercased (same rule as the web).
String campPaymentReference(String registrationId) {
  final upper = registrationId.toUpperCase();
  return upper.length <= 8 ? upper : upper.substring(upper.length - 8);
}

const campTShirtSizes = <String>['XS', 'S', 'M', 'L', 'XL', 'XXL'];

class CampRegistration {
  CampRegistration({
    required this.id,
    required this.campId,
    required this.firstName,
    required this.lastName,
    required this.gender,
    required this.phone,
    required this.tshirtSize,
    required this.dropoffLocation,
    required this.paymentStatus,
    required this.paymentAmount,
    required this.createdAt,
  });

  final String id;
  final String campId;
  final String firstName;
  final String lastName;
  final String gender;
  final String phone;
  final String? tshirtSize;
  final String? dropoffLocation;
  final String paymentStatus; // UNPAID | PAID | REFUNDED
  final num? paymentAmount;
  final DateTime? createdAt;

  String get fullName => '$firstName $lastName'.trim();
  bool get isPaid => paymentStatus == 'PAID';

  factory CampRegistration.fromJson(Map<String, dynamic> json) {
    return CampRegistration(
      id: asString(json['id']),
      campId: asString(json['campId']),
      firstName: asString(json['firstName']),
      lastName: asString(json['lastName']),
      gender: asString(json['gender']),
      phone: asString(json['phone']),
      tshirtSize: asStringOrNull(json['tshirtSize']),
      dropoffLocation: asStringOrNull(json['dropoffLocation']),
      paymentStatus: asString(json['paymentStatus'], 'UNPAID'),
      paymentAmount: asNumOrNull(json['paymentAmount']),
      createdAt: asDateOrNull(json['createdAt']),
    );
  }
}
