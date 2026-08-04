import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Every glyph the app uses, in one place.
///
/// The web draws its icons from `lucide-react`; this is the Flutter binding of
/// the same set, so a screen ported across keeps its glyph. Centralising them
/// means the icon vocabulary is reviewable in one file — and if a future
/// `lucide_icons_flutter` release renames a constant, this is the only file
/// that needs touching.
abstract final class AppIcons {
  // ── Navigation ──
  static const dashboard = LucideIcons.layoutDashboard;
  static const calendar = LucideIcons.calendar;
  static const calendarDays = LucideIcons.calendarDays;
  static const calendarPlus = LucideIcons.calendarPlus;
  static const calendarRange = LucideIcons.calendarRange;
  static const calendarCheck = LucideIcons.calendarCheck;
  static const bible = LucideIcons.bookOpenText;
  static const profile = LucideIcons.circleUser;
  static const church = LucideIcons.church;
  static const ministries = LucideIcons.heartHandshake;
  static const inbox = LucideIcons.inbox;
  static const admin = LucideIcons.shieldCheck;
  static const settings = LucideIcons.settings;
  static const menu = LucideIcons.menu;
  static const back = LucideIcons.arrowLeft;
  static const forward = LucideIcons.arrowRight;
  static const chevronDown = LucideIcons.chevronDown;
  static const chevronUp = LucideIcons.chevronUp;
  static const chevronRight = LucideIcons.chevronRight;
  static const chevronLeft = LucideIcons.chevronLeft;
  static const close = LucideIcons.x;
  static const externalLink = LucideIcons.externalLink;

  // ── People & departments ──
  static const users = LucideIcons.users;
  static const usersRound = LucideIcons.usersRound;
  static const user = LucideIcons.user;
  static const userPlus = LucideIcons.userPlus;
  static const department = LucideIcons.building2;
  static const graduation = LucideIcons.graduationCap;
  static const heart = LucideIcons.heart;

  // ── Services & events ──
  static const clipboard = LucideIcons.clipboardList;
  static const clipboardCheck = LucideIcons.clipboardCheck;
  static const music = LucideIcons.music;
  static const mic = LucideIcons.mic;
  static const star = LucideIcons.star;
  static const sparkles = LucideIcons.sparkles;
  static const fileText = LucideIcons.fileText;
  static const mail = LucideIcons.mail;
  static const reports = LucideIcons.chartColumnBig;
  static const megaphone = LucideIcons.megaphone;
  static const bell = LucideIcons.bell;
  static const clock = LucideIcons.clock;
  static const mapPin = LucideIcons.mapPin;
  static const speaker = LucideIcons.userRound;

  // ── Requests ──
  static const transport = LucideIcons.bus;
  static const media = LucideIcons.clapperboard;
  static const food = LucideIcons.utensilsCrossed;
  static const money = LucideIcons.banknote;
  static const wallet = LucideIcons.wallet;

  // ── Camp ──
  static const tent = LucideIcons.tent;
  static const qrCode = LucideIcons.qrCode;
  static const scan = LucideIcons.scanLine;
  static const camera = LucideIcons.camera;
  static const flashOn = LucideIcons.zap;
  static const flashOff = LucideIcons.zapOff;
  static const doorOpen = LucideIcons.doorOpen;
  static const ticket = LucideIcons.ticket;
  static const utensils = LucideIcons.utensils;
  static const handshake = LucideIcons.handHeart;
  static const shield = LucideIcons.shield;
  static const stethoscope = LucideIcons.stethoscope;
  static const shirt = LucideIcons.shirt;
  static const cake = LucideIcons.cake;
  static const phone = LucideIcons.phone;

  // ── Fundraising ──
  static const flame = LucideIcons.flame;
  static const cart = LucideIcons.shoppingCart;
  static const receipt = LucideIcons.receipt;
  static const store = LucideIcons.store;

  // ── Status & actions ──
  static const check = LucideIcons.check;
  static const checkCircle = LucideIcons.circleCheck;
  static const xCircle = LucideIcons.circleX;
  static const alert = LucideIcons.triangleAlert;
  static const info = LucideIcons.info;
  static const help = LucideIcons.circleHelp;
  static const plus = LucideIcons.plus;
  static const minus = LucideIcons.minus;
  static const edit = LucideIcons.pencil;
  static const trash = LucideIcons.trash2;
  static const search = LucideIcons.search;
  static const filter = LucideIcons.listFilter;
  static const refresh = LucideIcons.refreshCw;
  static const download = LucideIcons.download;
  static const upload = LucideIcons.upload;
  static const share = LucideIcons.share2;
  static const printer = LucideIcons.printer;
  static const copy = LucideIcons.copy;
  static const send = LucideIcons.send;
  static const logout = LucideIcons.logOut;
  static const login = LucideIcons.logIn;
  static const eye = LucideIcons.eye;
  static const eyeOff = LucideIcons.eyeOff;
  static const lock = LucideIcons.lock;
  static const offline = LucideIcons.wifiOff;
  static const online = LucideIcons.wifi;
  static const cloudUpload = LucideIcons.cloudUpload;
  static const history = LucideIcons.history;
  static const listTodo = LucideIcons.listTodo;
  static const layers = LucideIcons.layers;
  static const bookmark = LucideIcons.bookmark;
  static const highlighter = LucideIcons.highlighter;
  static const noteText = LucideIcons.notebookPen;
  // Lucide dropped its brand glyphs, so there is no Google mark to use
  // here. The sign-in button carries the word "Google" in its label; this
  // is just the affordance next to it.
  static const google = LucideIcons.logIn;

  /// Resolve a Firestore-stored lucide icon name (departments carry one) to a
  /// glyph, falling back to a neutral people icon.
  static IconData forName(String? name) {
    if (name == null) return users;
    return _byName[name] ?? _byName[name.toLowerCase()] ?? users;
  }

  static const Map<String, IconData> _byName = {
    'Users': users,
    'UsersRound': usersRound,
    'Music': music,
    'Mic': mic,
    'Church': church,
    'Heart': heart,
    'HeartHandshake': ministries,
    'GraduationCap': graduation,
    'Building2': department,
    'Bus': transport,
    'Clapperboard': media,
    'UtensilsCrossed': food,
    'Banknote': money,
    'Flame': flame,
    'Tent': tent,
    'Sparkles': sparkles,
    'Star': star,
    'BookOpenText': bible,
    'Calendar': calendar,
    'ClipboardList': clipboard,
    'Camera': camera,
    'Megaphone': megaphone,
    'Shield': shield,
    'ShieldCheck': admin,
    'Handshake': handshake,
  };
}
