"""Generate mobile/lib/core/fundraising/fundraising_menu.dart from the TS."""
import json, re, pathlib

ROOT = pathlib.Path('/home/user/Dew-of-Hermon')
menu_src = (ROOT / 'src/lib/fundraising-menu.ts').read_text()
braai_src = (ROOT / 'src/lib/braai.ts').read_text()


def block(src, name):
    m = re.search(rf"export const {name}\b[^=]*=\s*", src)
    assert m, name
    i = src.index('[', m.end() - 1)
    depth, j = 0, i
    while True:
        if src[j] == '[':
            depth += 1
        elif src[j] == ']':
            depth -= 1
            if depth == 0:
                break
        j += 1
    return src[i:j + 1]


def to_json(text):
    # Strip comments, quote bare keys, drop trailing commas, template -> literal.
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"`\$\{IMAGE_BASE\}([^`]*)`", r'"/images/fundraising\1"', text)
    text = re.sub(r"(?m)^(\s*)([a-zA-Z_][a-zA-Z0-9_]*):", r'\1"\2":', text)
    text = text.replace('"', '\x00').replace("'", '"').replace('\x00', '"')
    text = re.sub(r",(\s*[\]}])", r"\1", text)
    return json.loads(text)


items = to_json(block(menu_src, 'FUNDRAISING_MENU_ITEMS'))
resps = to_json(block(braai_src, 'BRAAI_RESPONSIBILITIES'))

momo = re.search(r'DEFAULT_MOMO_NUMBER = "([^"]+)"', menu_src).group(1)
campaign = re.search(r'CAMPAIGN_NAME = "([^"]+)"', menu_src).group(1)
currency = re.search(r'CURRENCY = "([^"]+)"', menu_src).group(1)
symbol = re.search(r'CURRENCY_SYMBOL = "([^"]+)"', menu_src).group(1)
prefix = re.search(r'ORDER_NUMBER_PREFIX = "([^"]+)"', menu_src).group(1)
dept = re.search(r'FUNDRAISING_DEPARTMENT_NAME = "([^"]+)"', braai_src).group(1)


def dq(s):
    return "'" + s.replace('\\', r'\\').replace("'", r"\'").replace('$', r'\$') + "'"


out = []
w = out.append
w("// GENERATED from src/lib/fundraising-menu.ts and src/lib/braai.ts by")
w("// tool/gen_fundraising.py — do not edit by hand. Re-run the generator when")
w("// either source file changes.")
w("")
w("/// One item on the Potter's Shockers menu. The items themselves are fixed")
w("/// in code on both clients; only price and availability come from Firestore.")
w("class MenuItemDef {")
w("  const MenuItemDef({")
w("    required this.key,")
w("    required this.name,")
w("    required this.description,")
w("    required this.emoji,")
w("    required this.imagePath,")
w("    required this.defaultPrice,")
w("  });")
w("")
w("  final String key;")
w("  final String name;")
w("  final String description;")
w("  final String emoji;")
w("  final String imagePath;")
w("  final int defaultPrice;")
w("}")
w("")
w("const List<MenuItemDef> kFundraisingMenuItems = [")
for it in items:
    w("  MenuItemDef(")
    w(f"    key: {dq(it['key'])},")
    w(f"    name: {dq(it['name'])},")
    w(f"    description: {dq(it['description'])},")
    w(f"    emoji: {dq(it['emoji'])},")
    w(f"    imagePath: {dq(it['imagePath'])},")
    w(f"    defaultPrice: {it['defaultPrice']},")
    w("  ),")
w("];")
w("")
w(f"const String kDefaultMomoNumber = {dq(momo)};")
w(f"const String kCampaignName = {dq(campaign)};")
w(f"const String kFundraisingCurrency = {dq(currency)};")
w(f"const String kCurrencySymbol = {dq(symbol)};")
w(f"const String kOrderNumberPrefix = {dq(prefix)};")
w(f"const String kFundraisingDepartmentName = {dq(dept)};")
w("")
w("/// Prices used when the Firestore config document is missing.")
w("final Map<String, int> kDefaultItemPrices = {")
w("  for (final i in kFundraisingMenuItems) i.key: i.defaultPrice,")
w("};")
w("")
w("/// One duty on the braai roster.")
w("class BraaiResponsibility {")
w("  const BraaiResponsibility({")
w("    required this.key,")
w("    required this.name,")
w("    required this.phase,")
w("    required this.order,")
w("  });")
w("")
w("  final String key;")
w("  final String name;")
w("  final String phase;")
w("  final int order;")
w("}")
w("")
w("const List<BraaiResponsibility> kBraaiResponsibilities = [")
for r in resps:
    w("  BraaiResponsibility(")
    w(f"    key: {dq(r['key'])},")
    w(f"    name: {dq(r['name'])},")
    w(f"    phase: {dq(r['phase'])},")
    w(f"    order: {r['order']},")
    w("  ),")
w("];")
w("")
w("const int kBraaiTotalResponsibilities = %d;" % len(resps))

dest = ROOT / 'mobile/lib/core/fundraising/fundraising_menu.dart'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text("\n".join(out) + "\n")
print(f"items={len(items)} responsibilities={len(resps)} -> {dest}")
