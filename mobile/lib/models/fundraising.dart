import '../core/fire.dart';

// Models for the public fundraising ordering flow
// (GET /api/fundraising/public/{menu,braais}, POST /api/fundraising/public/orders).

class FundraisingMenuItem {
  FundraisingMenuItem({
    required this.key,
    required this.name,
    required this.description,
    required this.emoji,
    required this.price,
  });

  final String key;
  final String name;
  final String description;
  final String emoji;
  final num price;

  factory FundraisingMenuItem.fromJson(Map<String, dynamic> json) {
    return FundraisingMenuItem(
      key: asString(json['key']),
      name: asString(json['name']),
      description: asString(json['description']),
      emoji: asString(json['emoji'], '🍗'),
      price: asNumOrNull(json['price']) ?? 0,
    );
  }
}

class FundraisingMenu {
  FundraisingMenu({
    required this.items,
    required this.momoNumber,
    required this.currency,
    required this.campaignName,
  });

  final List<FundraisingMenuItem> items;
  final String momoNumber;
  final String currency;
  final String campaignName;

  factory FundraisingMenu.fromJson(Map<String, dynamic> json) {
    return FundraisingMenu(
      items: (json['items'] as List? ?? [])
          .whereType<Map>()
          .map((m) => FundraisingMenuItem.fromJson(m.cast<String, dynamic>()))
          .toList(),
      momoNumber: asString(json['momoNumber']),
      currency: asString(json['currency'], 'ZMW'),
      campaignName: asString(json['campaignName'], "Potter's Shockers"),
    );
  }
}

class PublicBraai {
  PublicBraai({
    required this.id,
    required this.title,
    required this.eventDate,
    required this.venue,
  });

  final String id;
  final String title;
  final DateTime? eventDate;
  final String? venue;

  factory PublicBraai.fromJson(Map<String, dynamic> json) {
    return PublicBraai(
      id: asString(json['id']),
      title: asString(json['title'], 'Fundraising Braai'),
      eventDate: asDateOrNull(json['eventDate']),
      venue: asStringOrNull(json['venue']),
    );
  }
}

/// Pickup options accepted by the order endpoint, with display labels
/// matching the web order page.
const pickupOptions = <(String, String)>[
  ('after_1st', 'After 1st service'),
  ('after_2nd', 'After 2nd service'),
  ('lunch_hour', 'Lunch hour'),
  ('custom', 'Specific time…'),
];
