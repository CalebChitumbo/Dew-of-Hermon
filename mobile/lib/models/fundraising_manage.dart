import '../core/fire.dart';

// Management-side fundraising models (braai planning + order queue).

/// Mirror of BRAAI_RESPONSIBILITIES in src/lib/braai.ts.
const braaiResponsibilities = <(String, String, String)>[
  ('cut_marinate_chicken', 'Cutting and Marinating Chicken', 'PREPARATION'),
  ('peel_cut_potatoes', 'Peeling and Cutting Potatoes', 'PREPARATION'),
  (
    'cut_grate_vegetables',
    'Cutting/Grating Cabbage, Capsicums and Carrots',
    'PREPARATION'
  ),
  ('buy_drinks', 'Buying and Refrigerating Drinks', 'PREPARATION'),
  ('start_fire', 'Starting the Fire', 'EVENT_DAY'),
  ('organize_area', 'Organising the Braai Area', 'EVENT_DAY'),
  ('fry_chips', 'Frying Chips', 'EVENT_DAY'),
  ('braai_meat', 'Braaiing', 'EVENT_DAY'),
  ('mix_salads', 'Mixing Salads', 'EVENT_DAY'),
  ('sales_orders', 'Sales — Taking Orders & Ensuring Availability', 'EVENT_DAY'),
  ('sales_serving', 'Sales — Serving Food', 'EVENT_DAY'),
  ('sales_money', 'Sales — Receiving Money (Cash / Mobile Money)', 'EVENT_DAY'),
];

class BraaiEventSummary {
  BraaiEventSummary({
    required this.id,
    required this.title,
    required this.eventDate,
    required this.venue,
    required this.isArchived,
    required this.assignmentCount,
    required this.confirmedCount,
  });

  final String id;
  final String title;
  final DateTime? eventDate;
  final String? venue;
  final bool isArchived;
  final int assignmentCount;
  final int confirmedCount;

  factory BraaiEventSummary.fromJson(Map<String, dynamic> m) {
    return BraaiEventSummary(
      id: asString(m['id']),
      title: asString(m['title'], 'Fundraising Braai'),
      eventDate: asDateOrNull(m['eventDate']),
      venue: asStringOrNull(m['venue']),
      isArchived: asBool(m['isArchived']),
      assignmentCount: asNumOrNull(m['assignmentCount'])?.toInt() ?? 0,
      confirmedCount: asNumOrNull(m['confirmedCount'])?.toInt() ?? 0,
    );
  }
}

class BraaiAssignmentModel {
  BraaiAssignmentModel({
    required this.id,
    required this.responsibilityKey,
    required this.responsibilityName,
    required this.phase,
    required this.userId,
    required this.userName,
    required this.status,
  });

  final String id;
  final String responsibilityKey;
  final String responsibilityName;
  final String phase;
  final String userId;
  final String userName;
  final String status;

  factory BraaiAssignmentModel.fromJson(Map<String, dynamic> m) {
    return BraaiAssignmentModel(
      id: asString(m['id']),
      responsibilityKey: asString(m['responsibilityKey']),
      responsibilityName: asString(m['responsibilityName']),
      phase: asString(m['phase'], 'EVENT_DAY'),
      userId: asString(m['userId']),
      userName: asString(m['userName']),
      status: asString(m['status'], 'PENDING'),
    );
  }
}

class BraaiMember {
  BraaiMember({required this.id, required this.name});

  final String id;
  final String name;

  factory BraaiMember.fromJson(Map<String, dynamic> m) {
    return BraaiMember(
      id: asString(m['id']),
      name: asString(m['name'], 'Member'),
    );
  }
}

const prepStatusLabels = <String, String>{
  'PENDING': 'Pending',
  'IN_PREP': 'In prep',
  'READY': 'Ready',
  'COLLECTED': 'Collected',
};

class KitchenOrder {
  KitchenOrder({
    required this.id,
    required this.orderNumber,
    required this.customerName,
    required this.customerPhone,
    required this.pickupTime,
    required this.customPickupTime,
    required this.notes,
    required this.itemsSummary,
    required this.total,
    required this.currency,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.preparationStatus,
    required this.isArchived,
  });

  final String id;
  final String orderNumber;
  final String customerName;
  final String customerPhone;
  final String pickupTime;
  final String? customPickupTime;
  final String? notes;
  final String itemsSummary;
  final num total;
  final String currency;
  final String paymentStatus; // UNPAID | PAID
  final String? paymentMethod; // momo | cash
  final String preparationStatus; // PENDING | IN_PREP | READY | COLLECTED
  final bool isArchived;

  String get pickupLabel => switch (pickupTime) {
        'after_1st' => 'After 1st service',
        'after_2nd' => 'After 2nd service',
        'lunch_hour' => 'Lunch hour',
        'custom' => customPickupTime ?? 'Custom time',
        _ => pickupTime,
      };

  factory KitchenOrder.fromJson(Map<String, dynamic> m) {
    final items = (m['items'] as List? ?? [])
        .whereType<Map>()
        .map((item) =>
            '${item['qty']}× ${item['name'] ?? item['itemKey'] ?? ''}')
        .join(', ');
    return KitchenOrder(
      id: asString(m['id']),
      orderNumber: asString(m['orderNumber'], '—'),
      customerName: asString(m['customerName']),
      customerPhone: asString(m['customerPhone']),
      pickupTime: asString(m['pickupTime']),
      customPickupTime: asStringOrNull(m['customPickupTime']),
      notes: asStringOrNull(m['notes']),
      itemsSummary: items,
      total: asNumOrNull(m['total']) ?? 0,
      currency: asString(m['currency'], 'ZMW'),
      paymentStatus: asString(m['paymentStatus'], 'UNPAID'),
      paymentMethod: asStringOrNull(m['paymentMethod']),
      preparationStatus: asString(m['preparationStatus'], 'PENDING'),
      isArchived: asBool(m['isArchived']),
    );
  }
}
