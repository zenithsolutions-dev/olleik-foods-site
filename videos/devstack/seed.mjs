// Fictional demo data for the video captures, in the LOCAL video database only (devstack/stack.mjs must be running).
//   node devstack/seed.mjs           replace all demo data (idempotent)
//   node devstack/seed.mjs --count   print record counts (for the before/after check in the report)
// Every business, person, email (@olleik-demo.test, a reserved test domain), phone (555) and order here is invented.
// Passwords for the demo logins are generated per run and kept in devstack/_keys.json (git-ignored), never printed.
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS = join(HERE, "_keys.json");
const keys = JSON.parse(readFileSync(KEYS, "utf8"));
const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "local-only-postgres", database: "postgres" });
await db.connect();
const q = (sql, args) => db.query(sql, args);

if (process.argv.includes("--count")) {
  const r = await q(`select (select count(*) from auth.users)::int users, (select count(*) from auth.users where email like '%@olleik-demo.test')::int demo_users,
    (select count(*) from customers)::int customers, (select count(*) from leads)::int leads, (select count(*) from orders)::int orders, (select count(*) from products)::int products`);
  console.log(JSON.stringify(r.rows[0]));
  await db.end();
  process.exit(0);
}

// Deterministic pseudo-random so every re-seed gives the same pictures.
let s = 20261008;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const DAY = 86400000;
// FULL film (feat/videos-full): history is relative to the moment of seeding, so "Today" on the dashboard is real.
const NOW = process.env.SEED_FIXED ? new Date("2026-10-08T14:00:00-04:00").getTime() : Math.floor(Date.now() / 60000) * 60000;
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const at = (daysAgo, hour = 9 + Math.floor(rnd() * 8)) => new Date(NOW - daysAgo * DAY - (14 - hour) * 3600000 + Math.floor(rnd() * 50) * 60000).toISOString();

// ——— clean slate (keeps the schema, categories and the generic product seed) ———
await q("begin");
await q("delete from order_stock_movements; delete from order_item_costs; delete from order_items; delete from orders");
await q("delete from customer_offers; delete from offer_templates; delete from customer_product_pricing_meta; delete from pricing_rules");
await q("delete from customer_hidden_products; delete from customer_visible_categories; delete from customer_products; delete from customers; delete from leads");
await q("delete from contact_messages; delete from vendor_submissions; delete from auth.users");
// what the FULL film's capture run creates or changes (a product, a subcategory, a deactivated product)
await q("delete from order_stock_movements where product_id in (select id from products where sku = 'PRD-007')");
await q("delete from product_inventory where product_id in (select id from products where sku = 'PRD-007')");
await q("delete from product_costs where product_id in (select id from products where sku = 'PRD-007')");
await q("delete from products where sku = 'PRD-007'");
await q("delete from categories where name = 'Fresh Herbs'");
await q("update products set is_active = true");
await q("commit");

// ——— catalogue: the 14 seeded products + more generic items (demo SKUs and prices) ———
const cats = Object.fromEntries((await q("select id, name from categories")).rows.map((r) => [r.name, r.id]));
const more = [
  ["PRD-003", "Romaine Hearts", "case", "24 ct", 3850, "Produce"],
  ["PRD-004", "Lemons", "case", "115 ct", 4400, "Produce"],
  ["PRD-005", "Fresh Basil", "ea", "1 lb", 1250, "Produce"],
  ["PRD-006", "Russet Potatoes", "bag", "50 lb", 2900, "Produce"],
  ["DRY-103", "Large Eggs, Grade A", "case", "15 dozen", 6200, "Dairy & Eggs"],
  ["DRY-104", "Unsalted Butter", "case", "36 x 1 lb", 15600, "Dairy & Eggs"],
  ["DRY-105", "Heavy Cream 36%", "case", "12 x 1 L", 7400, "Dairy & Eggs"],
  ["MEAT-203", "Beef Burger Patties 6 oz", "case", "40 ct", 9800, "Meat & Poultry"],
  ["MEAT-204", "Chicken Wings, Split", "case", "40 lb", 16200, "Meat & Poultry"],
  ["SEA-302", "Atlantic Salmon Fillet", "case", "10 lb", 15900, "Seafood"],
  ["DRY-404", "Long Grain Rice", "bag", "20 kg", 3600, "Dry Goods"],
  ["DRY-405", "Canola Fry Oil", "case", "16 L", 5200, "Dry Goods"],
  ["BEV-502", "Oat Barista Milk", "case", "6 x 1 L", 2700, "Beverages"],
  ["FRZ-602", "Brioche Burger Buns", "case", "48 ct", 3900, "Frozen"],
  ["PKG-703", "Hot Cups 12 oz", "case", "1000 ct", 9200, "Packaging & Disposables"],
  ["PKG-704", "Kraft Takeout Bags", "case", "250 ct", 4600, "Packaging & Disposables"],
];
await q("delete from products where sku = any($1)", [more.map((m) => m[0])]);
for (const [sku, name, unit, size, price, cat] of more) {
  await q("insert into products (sku, name, unit, unit_size, list_price_cents, category_id, is_active, description) values ($1,$2,$3,$4,$5,$6,true,$7)", [sku, name, unit, size, price, cats[cat] ?? null, null]);
}
const products = (await q("select id, sku, name, unit, unit_size, list_price_cents, category_id from products order by sku")).rows;
const P = Object.fromEntries(products.map((p) => [p.sku, p]));
for (const p of products) {
  await q("insert into product_costs (product_id, cost_cents) values ($1, $2) on conflict (product_id) do update set cost_cents = excluded.cost_cents", [p.id, Math.round(p.list_price_cents * (0.62 + rnd() * 0.12))]);
  const low = { "DRY-102": [9, 12], "BEV-501": [4, 10], "SEA-302": [5, 8], "PKG-703": [3, 8] }[p.sku];
  await q("insert into product_inventory (product_id, stock_qty, low_stock_threshold) values ($1,$2,$3) on conflict (product_id) do update set stock_qty = excluded.stock_qty, low_stock_threshold = excluded.low_stock_threshold", [p.id, low ? low[0] : 40 + Math.floor(rnd() * 160), low ? low[1] : 10]);
}

// Margin rules (the waterfall the admin manages on /admin/pricing): a global default, two category rules, one product rule.
await q("insert into pricing_rules (scope, margin_percent) values ('global', 30)");
await q("insert into pricing_rules (scope, category_id, margin_percent) values ('category', $1, 24), ('category', $2, 38)", [cats["Seafood"], cats["Beverages"]]);
await q("insert into pricing_rules (scope, product_id, margin_percent) values ('product', $1, 45)", [P["PRD-005"].id]);
await q("update products p set is_available = (i.stock_qty > 0) from product_inventory i where i.product_id = p.id");

// ——— demo logins (local auth emulator) ———
const api = async (path, body) => {
  const r = await fetch(`${keys.url}/auth/v1${path}`, { method: "POST", headers: { "content-type": "application/json", apikey: keys.serviceKey, authorization: `Bearer ${keys.serviceKey}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};
const pw = () => `Demo-${randomBytes(9).toString("base64url")}`;
const accounts = {};
const admin = { email: "admin@olleik-demo.test", password: pw() };
admin.id = (await api("/admin/users", { ...admin, email_confirm: true })).id;
accounts.admin = admin;

// ——— customers (fictional) ———
const CUSTOMERS = [
  { key: "copperleaf", business: "Copperleaf Kitchen", contact: "Nadia Haddad", phone: "(613) 555-0141", address: "41 Copper Lane, Ottawa, ON", terms: "net-30", login: true, days: 210, notes: "Bistro, dinner service Tue–Sun. Prefers early delivery" },
  { key: "bluestone", business: "Bluestone Bakehouse", contact: "Owen Tremblay", phone: "(613) 555-0172", address: "12 Stonebridge Street, Ottawa, ON", terms: "net-15", login: true, days: 160, notes: "Bakery and café. Flour, butter and eggs weekly" },
  { key: "juniper", business: "Juniper & Rye Café", contact: "Priya Raman", phone: "(613) 555-0118", address: "7 Rye Avenue, Ottawa, ON", terms: "card-on-file", login: true, days: 120, notes: "Coffee bar with brunch menu" },
  { key: "harbourline", business: "Harbourline Catering", contact: "Marc-André Gagnon", phone: "(613) 555-0193", address: "220 Harbour Road, Ottawa, ON", terms: "net-30", login: true, days: 95, notes: "Events and corporate lunches" },
  { key: "ember", business: "Ember Lane Pizza", contact: "Leah Kim", phone: "(613) 555-0157", address: "5 Ember Crescent, Ottawa, ON", terms: "cod", login: true, days: 60, notes: "Two-oven pizzeria, Fri–Sun peaks" },
  { key: "saffron", business: "Saffron Courtyard", contact: "Yusuf Demir", phone: "(613) 555-0126", address: "88 Courtyard Boulevard, Ottawa, ON", terms: "card-on-file", login: false, days: 3, notes: "New account, documents under review", status: "pending" },
];
const C = {};
for (const c of CUSTOMERS) {
  const email = `${c.key}@olleik-demo.test`;
  let userId = null;
  if (c.login) {
    const a = { email, password: pw() };
    userId = (await api("/admin/users", { ...a, email_confirm: true })).id;
    accounts[c.key] = a;
  }
  const row = (await q("insert into customers (business_name, contact_name, email, phone, address, status, payment_terms, notes, created_at, user_id, visibility_mode, invited_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'assigned',$11) returning id", [c.business, c.contact, email, c.phone, c.address, c.status ?? "active", c.terms, c.notes, at(c.days), userId, c.login ? at(c.days - 1) : null])).rows[0];
  C[c.key] = { ...c, id: row.id, email };
}

// Assigned catalogues with negotiated prices (a few cents to a few dollars under list).
const ASSIGN = {
  copperleaf: ["PRD-001", "PRD-003", "PRD-004", "PRD-005", "PRD-006", "DRY-101", "DRY-104", "DRY-105", "MEAT-201", "MEAT-204", "SEA-301", "SEA-302", "DRY-401", "DRY-403", "DRY-404", "BEV-501", "FRZ-601", "PKG-704"],
  bluestone: ["DRY-402", "DRY-103", "DRY-104", "DRY-105", "BEV-501", "BEV-502", "PRD-004", "PKG-703", "PKG-704"],
  juniper: ["BEV-501", "BEV-502", "DRY-103", "DRY-104", "PRD-005", "PRD-004", "PKG-703", "FRZ-602"],
  harbourline: ["MEAT-201", "MEAT-203", "SEA-302", "PRD-003", "PRD-006", "DRY-404", "DRY-401", "DRY-105", "PKG-704", "FRZ-602"],
  ember: ["DRY-102", "DRY-402", "DRY-403", "DRY-401", "PRD-002", "PRD-005", "PKG-701", "MEAT-202", "FRZ-601"],
  saffron: [],
};
const price = {};
for (const [k, skus] of Object.entries(ASSIGN)) {
  for (const sku of skus) {
    const p = P[sku];
    const cents = Math.round((p.list_price_cents * (0.9 + rnd() * 0.07)) / 5) * 5;
    price[`${k}:${sku}`] = cents;
    await q("insert into customer_products (customer_id, product_id, price_cents) values ($1,$2,$3)", [C[k].id, p.id, cents]);
  }
}

// ——— offers ———
const tpl = (await q("insert into offer_templates (name, description, discount_kind, discount_value) values ('Weekend Pizza Night', 'Mozzarella and San Marzano for Friday prep', 'percent', 10) returning id")).rows[0].id;
await q("insert into offer_templates (name, description, discount_kind, discount_value) values ('Brunch Starter', 'Eggs and cream for weekend brunch', 'amount_off', 300)");
const in7 = new Date(NOW + 7 * DAY).toISOString();
await q("insert into customer_offers (customer_id, title, description, product_id, discount_kind, discount_value, starts_at, ends_at, is_active, template_id) values ($1, 'Salmon Feature Week', 'Fillets for your weekend special', $2, 'percent', 8, $3, $4, true, null)", [C.copperleaf.id, P["SEA-302"].id, at(1), in7]);
await q("insert into customer_offers (customer_id, title, description, product_id, discount_kind, discount_value, starts_at, ends_at, is_active, template_id) values ($1, 'Weekend Pizza Night', 'Mozzarella and San Marzano for Friday prep', $2, 'percent', 10, $3, $4, true, $5)", [C.ember.id, P["DRY-403"].id, at(2), in7, tpl]);

// ——— leads (website applications) ———
const LEADS = [
  ["Riverside Noodle Bar", "Daniel Chen", "riverside@olleik-demo.test", "(613) 555-0164", "Restaurant", "$2,000–$5,000", "Looking for produce and dry goods twice a week", "new", 0.2],
  ["Maplewood Deli", "Sofia Rossi", "maplewood@olleik-demo.test", "(613) 555-0185", "Deli / Grocery", "$1,000–$2,000", "Need cheese, cured meats and packaging", "new", 1.1],
  ["Lantern Street Tacos", "Mateo Alvarez", "lantern@olleik-demo.test", "(613) 555-0139", "Food truck", "Under $1,000", "Tortillas, produce and takeout packaging", "contacted", 3.4],
  ["Greenway School Café", "Hannah Leblanc", "greenway@olleik-demo.test", "(613) 555-0176", "School / Institution", "$5,000+", null, "contacted", 6.5],
];
for (const [b, n, e, ph, type, vol, msg, st, d] of LEADS) await q("insert into leads (business_name, contact_name, email, phone, business_type, monthly_volume, message, status, submitted_at, address) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Ottawa, ON')", [b, n, e, ph, type, vol, msg, st, new Date(NOW - d * DAY).toISOString()]);
await q("insert into leads (business_name, contact_name, email, phone, business_type, status, submitted_at, converted_customer_id) values ('Saffron Courtyard','Yusuf Demir','saffron@olleik-demo.test','(613) 555-0126','Restaurant','converted',$1,$2)", [at(4), C.saffron.id]);
await q("update customers set source_lead_id = (select id from leads where business_name = 'Saffron Courtyard') where id = $1", [C.saffron.id]);

// ——— order history: ~11 weeks, completed with a few open ones today ———
const lineFor = (k, n) => {
  const skus = [...ASSIGN[k]].sort(() => rnd() - 0.5).slice(0, n);
  return skus.map((sku) => ({ p: P[sku], qty: 1 + Math.floor(rnd() * 5), price: price[`${k}:${sku}`] }));
};
const insertOrder = async (k, lines, { status, created, fulfillment = "delivery", notes = null }) => {
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  const t = new Date(created).getTime();
  const conf = ["confirmed", "prepared", "completed"].includes(status) ? new Date(t + 2 * 3600000).toISOString() : null;
  const comp = status === "completed" ? new Date(t + 26 * 3600000).toISOString() : null;
  const o = (await q("insert into orders (customer_id, status, fulfillment, notes, payment_terms_snapshot, total_cents, client_token, created_at, confirmed_at, completed_at, stock_decremented_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9) returning id", [C[k].id, status, fulfillment, notes, C[k].terms, total, randomUUID(), created, conf, comp])).rows[0].id;
  for (const l of lines) {
    await q("insert into order_items (order_id, product_id, name, sku, unit, unit_size, qty, base_price_cents, unit_price_cents, was_assigned, line_total_cents) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)", [o, l.p.id, l.p.name, l.p.sku, l.p.unit, l.p.unit_size, l.qty, l.p.list_price_cents, l.price, l.qty * l.price]);
    const cost = (await q("select cost_cents from product_costs where product_id = $1", [l.p.id])).rows[0].cost_cents;
    await q("insert into order_item_costs (order_id, product_id, cost_cents) values ($1,$2,$3)", [o, l.p.id, cost]);
  }
  return o;
};
const active = ["copperleaf", "bluestone", "juniper", "harbourline", "ember"];
const weekly = { copperleaf: 2, bluestone: 2, juniper: 1, harbourline: 1, ember: 2 };
let n = 0;
for (let d = 77; d >= 1; d--) {
  for (const k of active) {
    const since = CUSTOMERS.find((c) => c.key === k).days;
    if (d > since - 2) continue;
    const growth = 0.75 + (77 - d) / 140; // business grows over the period
    if (rnd() < (weekly[k] / 7) * growth) {
      await insertOrder(k, lineFor(k, 2 + Math.floor(rnd() * 4)), { status: d <= 1 ? pick(["confirmed", "prepared"]) : rnd() < 0.04 ? "cancelled" : "completed", created: at(d) });
      n++;
    }
  }
}
// Today: three new orders waiting for the admin (one with a delivery note), one confirmed.
await insertOrder("harbourline", lineFor("harbourline", 4), { status: "new", created: ago(42), notes: "Corporate lunch Friday, please deliver before 10am" });
await insertOrder("bluestone", lineFor("bluestone", 3), { status: "new", created: ago(31) });
await insertOrder("juniper", lineFor("juniper", 3), { status: "new", created: ago(18), fulfillment: "pickup" });
await insertOrder("ember", lineFor("ember", 4), { status: "confirmed", created: ago(55) });
n += 4;

keys.demoAccounts = accounts;
writeFileSync(KEYS, JSON.stringify(keys, null, 2));
console.log(`seeded: ${CUSTOMERS.length} customers (${Object.keys(accounts).length - 1} with logins), 1 admin, ${LEADS.length + 1} leads, ${n} orders, ${products.length} products`);
await db.end();
