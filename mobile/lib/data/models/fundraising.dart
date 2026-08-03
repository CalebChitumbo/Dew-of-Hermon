import '../../core/fundraising/fundraising_menu.dart';
import '../../core/utils/firestore_parse.dart';
import 'enums.dart';

/// One line on the storefront: the fixed definition plus the price and
/// availability the Fundraising lead set.
class MenuItem {
  const MenuItem({
    required this.key,
    required this.name,
    required this.description,
    required this.emoji,
    required this.imagePath,
    required this.price,
    required this.enabled,
  });

  factory MenuItem.fromMap(Map<String, dynamic> map) {
    final key = parseStringOr(map['key']);
    final def = firstWhereOrNull(kFundraisingMenuItems, (i) => i.key == key);
    return MenuItem(
      key: key,
      name: parseString(map['name']) ?? def?.name ?? key,
      description: parseString(map['description']) ?? def?.description ?? '',
      emoji: parseString(map['emoji']) ?? def?.emoji ?? '🍽️',
      imagePath: parseString(map['imagePath']) ?? def?.imagePath ?? '',
      price: parseIntOr(map['price'], def?.defaultPrice ?? 0),
      // Absent means available — the field was added after the first orders.
      enabled: parseBool(map['enabled'], fallback: true),
    );
  }

  final String key;
  final String name;
  final String description;
  final String emoji;

  /// The web path, e.g. `/images/fundraising/sausage.jpg`. The bundled asset
  /// lives at the same tail under `assets/`.
  final String imagePath;

  final int price;
  final bool enabled;

  /// The asset key for the bundled photo, or null when there is no photo and
  /// the emoji should stand in.
  String? get assetPath {
    if (!imagePath.startsWith('/images/')) return null;
    return 'assets\$imagePath';
  }
}

/// The storefront's whole configuration: what's for sale, at what price, and
/// which number the money goes to.
class MenuConfig {
  const MenuConfig({
    required this.items,
    required this.momoNumber,
    required this.currency,
    required this.campaignName,
  });

  factory MenuConfig.fromMap(Map<String, dynamic> map) => MenuConfig(
        items: (map['items'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map((m) => MenuItem.fromMap(Map<String, dynamic>.from(m)))
            .toList(),
        momoNumber: parseString(map['momoNumber']) ?? kDefaultMomoNumber,
        currency: parseString(map['currency']) ?? kFundraisingCurrency,
        campaignName: parseString(map['campaignName']) ?? kCampaignName,
      );

  /// What the app shows before the config has loaded, and if it never does.
  factory MenuConfig.fallback() => MenuConfig(
        items: [
          for (final def in kFundraisingMenuItems)
            MenuItem(
              key: def.key,
              name: def.name,
              description: def.description,
              emoji: def.emoji,
              imagePath: def.imagePath,
              price: def.defaultPrice,
              enabled: true,
            ),
        ],
        momoNumber: kDefaultMomoNumber,
        currency: kFundraisingCurrency,
        campaignName: kCampaignName,
      );

  final List<MenuItem> items;
  final String momoNumber;
  final String currency;
  final String campaignName;

  List<MenuItem> get onSale => items.where((i) => i.enabled).toList();

  MenuItem? item(String key) => firstWhereOrNull(items, (i) => i.key == key);
}

/// One line of an order.
class OrderLine {
  const OrderLine({
    required this.itemKey,
    required this.name,
    required this.unitPrice,
    required this.qty,
    required this.subtotal,
  });

  factory OrderLine.fromMap(Map<String, dynamic> map) => OrderLine(
        itemKey: parseStringOr(map['itemKey']),
        name: parseStringOr(map['name']),
        unitPrice: parseIntOr(map['unitPrice'], 0),
        qty: parseIntOr(map['qty'], 0),
        subtotal: parseIntOr(map['subtotal'], 0),
      );

  final String itemKey;
  final String name;
  final int unitPrice;
  final int qty;
  final int subtotal;

  Map<String, dynamic> toMap() => {
        'itemKey': itemKey,
        'name': name,
        'unitPrice': unitPrice,
        'qty': qty,
        'subtotal': subtotal,
      };
}

/// A Potter's Shockers order — placed by a buyer on the public page or typed
/// in by a member at the stall.
class FundraisingOrder {
  const FundraisingOrder({
    required this.id,
    required this.orderNumber,
    required this.braaiEventId,
    required this.braaiEventTitle,
    required this.customerName,
    required this.customerPhone,
    required this.pickupTime,
    required this.items,
    required this.total,
    required this.currency,
    required this.paymentStatus,
    required this.preparationStatus,
    required this.submittedBy,
    required this.isArchived,
    required this.createdAt,
    required this.updatedAt,
    this.braaiEventDate,
    this.customPickupTime,
    this.notes,
    this.paymentMethod,
    this.paidAt,
    this.paidByName,
    this.preparationUpdatedByName,
  });

  factory FundraisingOrder.fromMap(Map<String, dynamic> map) =>
      FundraisingOrder(
        id: parseStringOr(map['id']),
        orderNumber: parseStringOr(map['orderNumber']),
        braaiEventId: parseStringOr(map['braaiEventId']),
        braaiEventTitle: parseStringOr(map['braaiEventTitle']),
        braaiEventDate: parseDate(map['braaiEventDate']),
        customerName: parseStringOr(map['customerName']),
        customerPhone: parseStringOr(map['customerPhone']),
        pickupTime: FundraisingPickupTimeOption.fromWire(map['pickupTime']),
        customPickupTime: parseString(map['customPickupTime']),
        notes: parseString(map['notes']),
        items: (map['items'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map((m) => OrderLine.fromMap(Map<String, dynamic>.from(m)))
            .toList(),
        total: parseIntOr(map['total'], 0),
        currency: parseString(map['currency']) ?? kFundraisingCurrency,
        paymentStatus: FundraisingPaymentStatus.fromWire(map['paymentStatus']),
        paymentMethod:
            FundraisingPaymentMethod.fromWireOrNull(map['paymentMethod']),
        paidAt: parseDate(map['paidAt']),
        paidByName: parseString(map['paidByName']),
        preparationStatus:
            FundraisingPreparationStatus.fromWire(map['preparationStatus']),
        preparationUpdatedByName:
            parseString(map['preparationUpdatedByName']),
        submittedBy: FundraisingOrderSource.fromWire(map['submittedBy']),
        isArchived: parseBool(map['isArchived']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String orderNumber;
  final String braaiEventId;
  final String braaiEventTitle;
  final DateTime? braaiEventDate;
  final String customerName;
  final String customerPhone;
  final FundraisingPickupTimeOption pickupTime;

  /// An `HH:mm` string, set only when [pickupTime] is `custom`.
  final String? customPickupTime;

  final String? notes;
  final List<OrderLine> items;
  final int total;
  final String currency;
  final FundraisingPaymentStatus paymentStatus;
  final FundraisingPaymentMethod? paymentMethod;
  final DateTime? paidAt;
  final String? paidByName;
  final FundraisingPreparationStatus preparationStatus;
  final String? preparationUpdatedByName;

  /// `buyer` for the self-serve page, `member` when someone signed in typed
  /// it at the stall.
  final FundraisingOrderSource submittedBy;

  final bool isArchived;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isPaid => paymentStatus == FundraisingPaymentStatus.paid;
  bool get isCollected => preparationStatus == FundraisingPreparationStatus.collected;
  int get itemCount => items.fold(0, (sum, i) => sum + i.qty);

  String get pickupLabel =>
      pickupTime == FundraisingPickupTimeOption.custom &&
              (customPickupTime ?? '').isNotEmpty
          ? 'At $customPickupTime'
          : pickupTime.label;
}

/// A planned Sunday fundraising braai.
class BraaiEvent {
  const BraaiEvent({
    required this.id,
    required this.title,
    required this.eventDate,
    required this.createdBy,
    required this.createdByName,
    required this.isArchived,
    required this.createdAt,
    required this.updatedAt,
    this.venue,
    this.notes,
    this.assignmentCount = 0,
    this.confirmedCount = 0,
    this.declinedCount = 0,
  });

  factory BraaiEvent.fromMap(Map<String, dynamic> map) => BraaiEvent(
        id: parseStringOr(map['id']),
        title: parseStringOr(map['title']),
        eventDate: parseDateOr(map['eventDate']),
        venue: parseString(map['venue']),
        notes: parseString(map['notes']),
        createdBy: parseStringOr(map['createdBy']),
        createdByName: parseStringOr(map['createdByName']),
        isArchived: parseBool(map['isArchived']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
        assignmentCount: parseIntOr(map['assignmentCount'], 0),
        confirmedCount: parseIntOr(map['confirmedCount'], 0),
        declinedCount: parseIntOr(map['declinedCount'], 0),
      );

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

  /// Roster tallies, sent only by the list endpoint.
  final int assignmentCount;
  final int confirmedCount;
  final int declinedCount;

  bool get isPast => eventDate.isBefore(
        DateTime.now().subtract(const Duration(days: 1)),
      );
}

/// One duty on a braai roster, assigned to a Fundraising team member.
class BraaiAssignment {
  const BraaiAssignment({
    required this.id,
    required this.braaiEventId,
    required this.responsibilityKey,
    required this.responsibilityName,
    required this.phase,
    required this.userId,
    required this.userName,
    required this.userEmail,
    required this.status,
    required this.emailSent,
    required this.createdAt,
    required this.updatedAt,
    this.userPhone,
    this.emailSentAt,
    this.confirmedAt,
    this.notes,
  });

  factory BraaiAssignment.fromMap(Map<String, dynamic> map) => BraaiAssignment(
        id: parseStringOr(map['id']),
        braaiEventId: parseStringOr(map['braaiEventId']),
        responsibilityKey: parseStringOr(map['responsibilityKey']),
        responsibilityName: parseStringOr(map['responsibilityName']),
        phase: BraaiPhase.fromWire(map['phase']),
        userId: parseStringOr(map['userId']),
        userName: parseStringOr(map['userName']),
        userEmail: parseStringOr(map['userEmail']),
        userPhone: parseString(map['userPhone']),
        status: AssignmentStatus.fromWire(map['status']),
        emailSent: parseBool(map['emailSent']),
        emailSentAt: parseDate(map['emailSentAt']),
        confirmedAt: parseDate(map['confirmedAt']),
        notes: parseString(map['notes']),
        createdAt: parseDateOr(map['createdAt']),
        updatedAt: parseDateOr(map['updatedAt']),
      );

  final String id;
  final String braaiEventId;
  final String responsibilityKey;
  final String responsibilityName;

  final BraaiPhase phase;

  final String userId;
  final String userName;
  final String userEmail;
  final String? userPhone;
  final AssignmentStatus status;
  final bool emailSent;
  final DateTime? emailSentAt;
  final DateTime? confirmedAt;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
}

/// A braai the public order page can be pointed at.
class PublicBraai {
  const PublicBraai({
    required this.id,
    required this.title,
    required this.eventDate,
    this.venue,
  });

  factory PublicBraai.fromMap(Map<String, dynamic> map) => PublicBraai(
        id: parseStringOr(map['id']),
        title: parseStringOr(map['title']),
        eventDate: parseString(map['eventDate']),
        venue: parseString(map['venue']),
      );

  final String id;
  final String title;

  /// An ISO date string, exactly as the API sends it.
  final String? eventDate;

  final String? venue;
}
