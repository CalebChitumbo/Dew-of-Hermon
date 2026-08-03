import '../firestore/converters.dart';

class BraaiPhase {
  static const preparation = 'PREPARATION';
  static const eventDay = 'EVENT_DAY';
}

class BraaiEvent {
  final String id;
  final String title;
  final DateTime eventDate;
  final String? venue;
  final String? notes;
  final String createdBy;
  final String createdByName;
  final bool isArchived;
  final DateTime createdAt;
  final DateTime updatedAt;

  const BraaiEvent({
    required this.id,
    required this.title,
    required this.eventDate,
    this.venue,
    this.notes,
    required this.createdBy,
    required this.createdByName,
    this.isArchived = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BraaiEvent.fromMap(Map<String, dynamic> map) => BraaiEvent(
        id: asString(map['id']),
        title: asString(map['title']),
        eventDate: parseDate(map['eventDate']),
        venue: asStringOrNull(map['venue']),
        notes: asStringOrNull(map['notes']),
        createdBy: asString(map['createdBy']),
        createdByName: asString(map['createdByName']),
        isArchived: asBool(map['isArchived']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class BraaiAssignment {
  final String id;
  final String braaiEventId;
  final String responsibilityKey;
  final String responsibilityName;
  final String phase;
  final String userId;
  final String userName;
  final String userEmail;
  final String? userPhone;
  final String status;
  final bool emailSent;
  final DateTime? emailSentAt;
  final DateTime? confirmedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;

  const BraaiAssignment({
    required this.id,
    required this.braaiEventId,
    required this.responsibilityKey,
    required this.responsibilityName,
    required this.phase,
    required this.userId,
    required this.userName,
    required this.userEmail,
    this.userPhone,
    required this.status,
    this.emailSent = false,
    this.emailSentAt,
    this.confirmedAt,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BraaiAssignment.fromMap(Map<String, dynamic> map) =>
      BraaiAssignment(
        id: asString(map['id']),
        braaiEventId: asString(map['braaiEventId']),
        responsibilityKey: asString(map['responsibilityKey']),
        responsibilityName: asString(map['responsibilityName']),
        phase: asString(map['phase'], BraaiPhase.preparation),
        userId: asString(map['userId']),
        userName: asString(map['userName']),
        userEmail: asString(map['userEmail']),
        userPhone: asStringOrNull(map['userPhone']),
        status: asString(map['status'], 'PENDING'),
        emailSent: asBool(map['emailSent']),
        emailSentAt: parseDateOrNull(map['emailSentAt']),
        confirmedAt: parseDateOrNull(map['confirmedAt']),
        notes: asStringOrNull(map['notes']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}

class FundraisingPaymentStatus {
  static const unpaid = 'UNPAID';
  static const paid = 'PAID';
}

class FundraisingPreparationStatus {
  static const pending = 'PENDING';
  static const inPrep = 'IN_PREP';
  static const ready = 'READY';
  static const collected = 'COLLECTED';
}

class FundraisingPickupTime {
  static const after1st = 'after_1st';
  static const after2nd = 'after_2nd';
  static const lunchHour = 'lunch_hour';
  static const custom = 'custom';

  static const labels = <String, String>{
    after1st: 'After 1st service',
    after2nd: 'After 2nd service',
    lunchHour: 'Lunch hour',
    custom: 'Custom time',
  };
}

class FundraisingMenuItem {
  final String key;
  final String name;
  final String description;
  final String emoji;
  final String imagePath;
  final double price;
  final bool enabled;

  const FundraisingMenuItem({
    required this.key,
    required this.name,
    required this.description,
    required this.emoji,
    required this.imagePath,
    required this.price,
    this.enabled = true,
  });

  factory FundraisingMenuItem.fromMap(Map<String, dynamic> map) =>
      FundraisingMenuItem(
        key: asString(map['key']),
        name: asString(map['name']),
        description: asString(map['description']),
        emoji: asString(map['emoji']),
        imagePath: asString(map['imagePath']),
        price: asDouble(map['price']),
        enabled: asBool(map['enabled'], true),
      );
}

class FundraisingMenuConfig {
  final List<FundraisingMenuItem> items;
  final String momoNumber;
  final String currency;
  final String campaignName;

  const FundraisingMenuConfig({
    this.items = const [],
    this.momoNumber = '',
    this.currency = 'K',
    this.campaignName = '',
  });

  factory FundraisingMenuConfig.fromMap(Map<String, dynamic> map) =>
      FundraisingMenuConfig(
        items: asMapList(map['items'])
            .map(FundraisingMenuItem.fromMap)
            .toList(),
        momoNumber: asString(map['momoNumber']),
        currency: asString(map['currency'], 'K'),
        campaignName: asString(map['campaignName']),
      );
}

class FundraisingOrderItem {
  final String itemKey;
  final String name;
  final double unitPrice;
  final int qty;
  final double subtotal;

  const FundraisingOrderItem({
    required this.itemKey,
    required this.name,
    required this.unitPrice,
    required this.qty,
    required this.subtotal,
  });

  factory FundraisingOrderItem.fromMap(Map<String, dynamic> map) =>
      FundraisingOrderItem(
        itemKey: asString(map['itemKey']),
        name: asString(map['name']),
        unitPrice: asDouble(map['unitPrice']),
        qty: asInt(map['qty']),
        subtotal: asDouble(map['subtotal']),
      );

  Map<String, dynamic> toMap() => {
        'itemKey': itemKey,
        'name': name,
        'unitPrice': unitPrice,
        'qty': qty,
        'subtotal': subtotal,
      };
}

class FundraisingOrder {
  final String id;
  final String orderNumber;
  final String braaiEventId;
  final String braaiEventTitle;
  final DateTime? braaiEventDate;
  final String customerName;
  final String customerPhone;
  final String pickupTime;
  final String? customPickupTime;
  final String? notes;
  final List<FundraisingOrderItem> items;
  final double total;
  final String currency;
  final String paymentStatus;
  final String? paymentMethod; // momo | cash
  final DateTime? paidAt;
  final String? paidBy;
  final String? paidByName;
  final String preparationStatus;
  final DateTime preparationUpdatedAt;
  final String? preparationUpdatedBy;
  final String? preparationUpdatedByName;
  final String submittedBy; // buyer | member
  final String? submittedByUserId;
  final bool isArchived;
  final DateTime createdAt;
  final DateTime updatedAt;

  const FundraisingOrder({
    required this.id,
    required this.orderNumber,
    required this.braaiEventId,
    required this.braaiEventTitle,
    this.braaiEventDate,
    required this.customerName,
    required this.customerPhone,
    required this.pickupTime,
    this.customPickupTime,
    this.notes,
    this.items = const [],
    required this.total,
    required this.currency,
    required this.paymentStatus,
    this.paymentMethod,
    this.paidAt,
    this.paidBy,
    this.paidByName,
    required this.preparationStatus,
    required this.preparationUpdatedAt,
    this.preparationUpdatedBy,
    this.preparationUpdatedByName,
    required this.submittedBy,
    this.submittedByUserId,
    this.isArchived = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory FundraisingOrder.fromMap(Map<String, dynamic> map) =>
      FundraisingOrder(
        id: asString(map['id']),
        orderNumber: asString(map['orderNumber']),
        braaiEventId: asString(map['braaiEventId']),
        braaiEventTitle: asString(map['braaiEventTitle']),
        braaiEventDate: parseDateOrNull(map['braaiEventDate']),
        customerName: asString(map['customerName']),
        customerPhone: asString(map['customerPhone']),
        pickupTime: asString(map['pickupTime'], FundraisingPickupTime.lunchHour),
        customPickupTime: asStringOrNull(map['customPickupTime']),
        notes: asStringOrNull(map['notes']),
        items: asMapList(map['items'])
            .map(FundraisingOrderItem.fromMap)
            .toList(),
        total: asDouble(map['total']),
        currency: asString(map['currency'], 'K'),
        paymentStatus:
            asString(map['paymentStatus'], FundraisingPaymentStatus.unpaid),
        paymentMethod: asStringOrNull(map['paymentMethod']),
        paidAt: parseDateOrNull(map['paidAt']),
        paidBy: asStringOrNull(map['paidBy']),
        paidByName: asStringOrNull(map['paidByName']),
        preparationStatus: asString(
            map['preparationStatus'], FundraisingPreparationStatus.pending),
        preparationUpdatedAt: parseDate(map['preparationUpdatedAt']),
        preparationUpdatedBy: asStringOrNull(map['preparationUpdatedBy']),
        preparationUpdatedByName:
            asStringOrNull(map['preparationUpdatedByName']),
        submittedBy: asString(map['submittedBy'], 'buyer'),
        submittedByUserId: asStringOrNull(map['submittedByUserId']),
        isArchived: asBool(map['isArchived']),
        createdAt: parseDate(map['createdAt']),
        updatedAt: parseDate(map['updatedAt']),
      );
}
