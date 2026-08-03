// GENERATED from src/lib/fundraising-menu.ts and src/lib/braai.ts by
// tool/gen_fundraising.py — do not edit by hand. Re-run the generator when
// either source file changes.

/// One item on the Potter's Shockers menu. The items themselves are fixed
/// in code on both clients; only price and availability come from Firestore.
class MenuItemDef {
  const MenuItemDef({
    required this.key,
    required this.name,
    required this.description,
    required this.emoji,
    required this.imagePath,
    required this.defaultPrice,
  });

  final String key;
  final String name;
  final String description;
  final String emoji;
  final String imagePath;
  final int defaultPrice;
}

const List<MenuItemDef> kFundraisingMenuItems = [
  MenuItemDef(
    key: 'chicken_piece',
    name: '1 Piece Chicken',
    description: 'A grilled chicken piece, served with complimentary coleslaw.',
    emoji: '🍗',
    imagePath: '/images/fundraising/chicken_piece.jpg',
    defaultPrice: 30,
  ),
  MenuItemDef(
    key: 'chicken_legs',
    name: 'Chicken Feet (Fimbombo)',
    description: 'Two grilled chicken feet, served with complimentary coleslaw.',
    emoji: '🍗',
    imagePath: '/images/fundraising/chicken_legs.jpg',
    defaultPrice: 20,
  ),
  MenuItemDef(
    key: 'sausage',
    name: 'Sausage',
    description: 'A grilled pork sausage, served with complimentary coleslaw.',
    emoji: '🌭',
    imagePath: '/images/fundraising/sausage.jpg',
    defaultPrice: 30,
  ),
  MenuItemDef(
    key: 'chicken_chips',
    name: 'Chicken & Chips',
    description: 'Grilled chicken with golden chips and complimentary coleslaw.',
    emoji: '🍗',
    imagePath: '/images/fundraising/chicken_chips.jpg',
    defaultPrice: 60,
  ),
  MenuItemDef(
    key: 'sausage_chips',
    name: 'Sausage & Chips',
    description: 'A grilled pork sausage with golden chips and complimentary coleslaw.',
    emoji: '🌭',
    imagePath: '/images/fundraising/sausage_chips.jpg',
    defaultPrice: 60,
  ),
  MenuItemDef(
    key: 'chips_only',
    name: 'Chips Only',
    description: 'Hot, salted chips on their own.',
    emoji: '🍟',
    imagePath: '/images/fundraising/chips_only.jpg',
    defaultPrice: 35,
  ),
  MenuItemDef(
    key: 'cold_drink',
    name: 'Cold Drink',
    description: 'Chilled Coca-Cola, Fanta, or Sprite.',
    emoji: '🥤',
    imagePath: '/images/fundraising/cold_drink.jpg',
    defaultPrice: 15,
  ),
  MenuItemDef(
    key: 'bottled_water',
    name: 'Bottled Water',
    description: 'Half-litre of still water.',
    emoji: '💧',
    imagePath: '/images/fundraising/bottled_water.jpg',
    defaultPrice: 10,
  ),
];

const String kDefaultMomoNumber = '0979 414 477';
const String kCampaignName = 'Potter\'s Shockers Fundraiser';
const String kFundraisingCurrency = 'ZMW';
const String kCurrencySymbol = 'K';
const String kOrderNumberPrefix = 'PS';
const String kFundraisingDepartmentName = 'Fundraising';

/// Prices used when the Firestore config document is missing.
final Map<String, int> kDefaultItemPrices = {
  for (final i in kFundraisingMenuItems) i.key: i.defaultPrice,
};

/// One duty on the braai roster.
class BraaiResponsibility {
  const BraaiResponsibility({
    required this.key,
    required this.name,
    required this.phase,
    required this.order,
  });

  final String key;
  final String name;
  final String phase;
  final int order;
}

const List<BraaiResponsibility> kBraaiResponsibilities = [
  BraaiResponsibility(
    key: 'cut_marinate_chicken',
    name: 'Cutting and Marinating Chicken',
    phase: 'PREPARATION',
    order: 1,
  ),
  BraaiResponsibility(
    key: 'peel_cut_potatoes',
    name: 'Peeling and Cutting Potatoes',
    phase: 'PREPARATION',
    order: 2,
  ),
  BraaiResponsibility(
    key: 'cut_grate_vegetables',
    name: 'Cutting/Grating Cabbage, Capsicums and Carrots',
    phase: 'PREPARATION',
    order: 3,
  ),
  BraaiResponsibility(
    key: 'buy_drinks',
    name: 'Buying and Refrigerating Drinks',
    phase: 'PREPARATION',
    order: 4,
  ),
  BraaiResponsibility(
    key: 'start_fire',
    name: 'Starting the Fire',
    phase: 'EVENT_DAY',
    order: 5,
  ),
  BraaiResponsibility(
    key: 'organize_area',
    name: 'Organising the Braai Area',
    phase: 'EVENT_DAY',
    order: 6,
  ),
  BraaiResponsibility(
    key: 'fry_chips',
    name: 'Frying Chips',
    phase: 'EVENT_DAY',
    order: 7,
  ),
  BraaiResponsibility(
    key: 'braai_meat',
    name: 'Braaiing',
    phase: 'EVENT_DAY',
    order: 8,
  ),
  BraaiResponsibility(
    key: 'mix_salads',
    name: 'Mixing Salads',
    phase: 'EVENT_DAY',
    order: 9,
  ),
  BraaiResponsibility(
    key: 'sales_orders',
    name: 'Sales — Taking Orders & Ensuring Availability',
    phase: 'EVENT_DAY',
    order: 10,
  ),
  BraaiResponsibility(
    key: 'sales_serving',
    name: 'Sales — Serving Food',
    phase: 'EVENT_DAY',
    order: 11,
  ),
  BraaiResponsibility(
    key: 'sales_money',
    name: 'Sales — Receiving Money (Cash / Mobile Money)',
    phase: 'EVENT_DAY',
    order: 12,
  ),
  BraaiResponsibility(
    key: 'pack_cleanup',
    name: 'Packing and Clean-up (Includes Washing Dishes)',
    phase: 'EVENT_DAY',
    order: 13,
  ),
];

const int kBraaiTotalResponsibilities = 13;
