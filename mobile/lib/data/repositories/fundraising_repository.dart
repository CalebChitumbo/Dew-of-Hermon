import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../models/enums.dart';
import '../models/fundraising.dart';
import '../models/user.dart';

/// The Potter's Shockers storefront, the braai roster, and the orders desk.
///
/// The three `public*` calls need no account — a buyer with the link can read
/// the menu, see which braais are taking orders, and place one. Everything
/// else is gated server-side on the Fundraising department.
class FundraisingRepository {
  FundraisingRepository(this._api);

  final ApiClient _api;

  // ── Public storefront ──

  Future<MenuConfig> publicMenu() async {
    final data = await _api.getMap('/api/fundraising/public/menu',
        requireAuth: false);
    return MenuConfig.fromMap(data);
  }

  Future<List<PublicBraai>> publicBraais() async {
    final rows = await _api.getList('/api/fundraising/public/braais',
        key: 'braais', requireAuth: false);
    return rows.map(PublicBraai.fromMap).toList();
  }

  /// Place an order. The server recomputes the total from its own prices, so
  /// the returned receipt is the truth — show that, not the local cart.
  Future<Map<String, dynamic>> placeOrder({
    required String braaiEventId,
    required String customerName,
    required String customerPhone,
    required FundraisingPickupTimeOption pickupTime,
    required Map<String, int> quantities,
    String? customPickupTime,
    String? notes,
  }) async {
    final data = await _api.post(
      '/api/fundraising/public/orders',
      requireAuth: false,
      body: {
        'braaiEventId': braaiEventId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'pickupTime': pickupTime.wire,
        if (customPickupTime != null && customPickupTime.isNotEmpty)
          'customPickupTime': customPickupTime,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'items': [
          for (final entry in quantities.entries)
            if (entry.value > 0) {'itemKey': entry.key, 'qty': entry.value},
        ],
      },
    );
    final order = data is Map ? data['order'] : null;
    return order is Map ? Map<String, dynamic>.from(order) : <String, dynamic>{};
  }

  // ── Menu settings (Fundraising lead) ──

  Future<MenuConfig> menu() async {
    final data = await _api.getMap('/api/fundraising/menu');
    return MenuConfig.fromMap(data);
  }

  /// Prices omitted from [itemPrices] keep their current value; the server
  /// merges rather than replaces.
  Future<MenuConfig> updateMenu({
    Map<String, int>? itemPrices,
    List<String>? disabledItemKeys,
    String? momoNumber,
  }) async {
    final data = await _api.patch('/api/fundraising/menu', body: {
      if (itemPrices != null) 'itemPrices': itemPrices,
      if (disabledItemKeys != null) 'disabledItemKeys': disabledItemKeys,
      if (momoNumber != null) 'momoNumber': momoNumber,
    });
    return MenuConfig.fromMap(
        data is Map ? Map<String, dynamic>.from(data) : {});
  }

  // ── Braai events ──

  Future<List<BraaiEvent>> braais() async {
    final rows =
        await _api.getList('/api/fundraising/braai/events', key: 'events');
    return rows.map(BraaiEvent.fromMap).toList();
  }

  Future<BraaiEvent?> braai(String id) async {
    final data = await _api.getMap('/api/fundraising/braai/events/$id');
    final event = data['event'];
    return event is Map
        ? BraaiEvent.fromMap(Map<String, dynamic>.from(event))
        : null;
  }

  Future<void> createBraai({
    required DateTime eventDate,
    String? title,
    String? venue,
    String? notes,
  }) =>
      _api.post('/api/fundraising/braai/events', body: {
        'eventDate': eventDate.toUtc().toIso8601String(),
        if (title != null && title.isNotEmpty) 'title': title,
        if (venue != null && venue.isNotEmpty) 'venue': venue,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });

  Future<void> updateBraai(
    String id, {
    String? title,
    DateTime? eventDate,
    String? venue,
    String? notes,
    bool? isArchived,
  }) =>
      _api.patch('/api/fundraising/braai/events/$id', body: {
        if (title != null) 'title': title,
        if (eventDate != null) 'eventDate': eventDate.toUtc().toIso8601String(),
        if (venue != null) 'venue': venue,
        if (notes != null) 'notes': notes,
        if (isArchived != null) 'isArchived': isArchived,
      });

  Future<void> deleteBraai(String id) =>
      _api.delete('/api/fundraising/braai/events/$id');

  // ── Roster ──

  Future<List<BraaiAssignment>> assignments(String braaiId) async {
    final rows = await _api.getList(
        '/api/fundraising/braai/events/$braaiId/assignments',
        key: 'assignments');
    return rows.map(BraaiAssignment.fromMap).toList();
  }

  /// Assign a duty. The server emails the person and stamps `emailSent`.
  Future<void> assignDuty({
    required String braaiId,
    required String responsibilityKey,
    required String userId,
  }) =>
      _api.post('/api/fundraising/braai/events/$braaiId/assignments', body: {
        'responsibilityKey': responsibilityKey,
        'userId': userId,
      });

  Future<void> updateAssignment({
    required String braaiId,
    required String assignmentId,
    AssignmentStatus? status,
    String? notes,
  }) =>
      _api.put(
        '/api/fundraising/braai/events/$braaiId/assignments/$assignmentId',
        body: {
          if (status != null) 'status': status.wire,
          if (notes != null) 'notes': notes,
        },
      );

  Future<void> removeAssignment({
    required String braaiId,
    required String assignmentId,
  }) =>
      _api.delete(
          '/api/fundraising/braai/events/$braaiId/assignments/$assignmentId');

  /// Everyone in the Fundraising department, for the assign picker.
  Future<List<AppUser>> teamMembers() async {
    final rows = await _api.getList('/api/fundraising/braai/department-members',
        key: 'members');
    return rows.map(AppUser.fromMap).toList();
  }

  // ── Orders desk ──

  Future<List<FundraisingOrder>> orders(String braaiId) async {
    final rows = await _api
        .getList('/api/fundraising/braai/events/$braaiId/orders', key: 'orders');
    return rows.map(FundraisingOrder.fromMap).toList();
  }

  /// Take an order at the counter. Stamped `submittedBy: member` so
  /// self-serve and walk-up sales stay tellable apart.
  Future<void> createCounterOrder({
    required String braaiId,
    required String customerName,
    required String customerPhone,
    required FundraisingPickupTimeOption pickupTime,
    required Map<String, int> quantities,
    String? customPickupTime,
    String? notes,
  }) =>
      _api.post('/api/fundraising/braai/events/$braaiId/orders', body: {
        'braaiEventId': braaiId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'pickupTime': pickupTime.wire,
        if (customPickupTime != null && customPickupTime.isNotEmpty)
          'customPickupTime': customPickupTime,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        'items': [
          for (final entry in quantities.entries)
            if (entry.value > 0) {'itemKey': entry.key, 'qty': entry.value},
        ],
      });

  Future<void> updateOrder({
    required String braaiId,
    required String orderId,
    FundraisingPaymentStatus? paymentStatus,
    FundraisingPaymentMethod? paymentMethod,
    FundraisingPreparationStatus? preparationStatus,
    bool? isArchived,
  }) =>
      _api.patch(
        '/api/fundraising/braai/events/$braaiId/orders/$orderId',
        body: {
          if (paymentStatus != null) 'paymentStatus': paymentStatus.wire,
          if (paymentMethod != null) 'paymentMethod': paymentMethod.wire,
          if (preparationStatus != null)
            'preparationStatus': preparationStatus.wire,
          if (isArchived != null) 'isArchived': isArchived,
        },
      );

  Future<void> deleteOrder({
    required String braaiId,
    required String orderId,
  }) =>
      _api.delete('/api/fundraising/braai/events/$braaiId/orders/$orderId');
}

final fundraisingRepositoryProvider = Provider<FundraisingRepository>(
  (ref) => FundraisingRepository(ref.watch(apiClientProvider)),
);
