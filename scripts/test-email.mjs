// Email content and rules (pure — no database, no network).
//   node scripts/test-local.mjs test-email
import {
  buildDailyReportEmail,
  buildLowStockEmail,
  buildOrderEmail,
  isDailyReportDue,
  parseNotificationSettings,
  parseRecipients,
  pickLowStockAlerts,
} from "../src/lib/email/templates.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};
const SITE = "https://shop.example.test";
const BUSINESS = "Acme <b>Wholesale</b>";

// ---------- new-order email ----------
const order = {
  id: "0a1b2c3d-0000-4000-8000-000000000001",
  customerName: "Bistro & Co <script>alert(1)</script>",
  fulfillment: "delivery",
  notes: "Before 10am <img src=x>",
  totalCents: 46730,
  createdAtLabel: "Nov 26, 2026, 9:15 a.m.",
  lines: [
    { name: "Olive Oil 3L", sku: "OIL-3", qty: 4, unitPriceCents: 2500, lineTotalCents: 10000 },
    { name: "Feta <Tin>", sku: "DRY-7", qty: 2, unitPriceCents: 18365, lineTotalCents: 36730 },
  ],
};
const o = buildOrderEmail({ order, businessName: BUSINESS, siteUrl: SITE });
const orderUrl = `${SITE}/admin/orders/${order.id}`;
check("order: subject names the customer and the total", o.subject.includes("Bistro & Co") && o.subject.includes("$467.30"), o.subject);
check("order: the button opens that order in the admin", o.html.includes(`href="${orderUrl}"`) && o.text.includes(orderUrl));
check("order: every line, quantity and the total are in both versions", ["Olive Oil 3L", "4", "$467.30"].every((s) => o.html.includes(s) && o.text.includes(s)));
check("order: the customer's note is included", o.text.includes("Before 10am"));
check("order: nothing typed by a customer becomes live HTML", !o.html.includes("<script>") && !o.html.includes("<img src=x>") && !o.html.includes("<Tin>") && !o.html.includes("<b>Wholesale</b>"));
check("order: escaped text is still readable", o.html.includes("&lt;script&gt;") && o.html.includes("Acme &lt;b&gt;Wholesale&lt;/b&gt;"));
// The readable words only: inline CSS legitimately contains "margin:".
const words = (email) => email.text + email.html.replace(/style="[^"]*"/g, "").replace(/<[^>]+>/g, " ");
check("order: no cost, profit or margin wording (recipients may not be owners)", !/cost|profit|margin/i.test(words(o)));
check("order: mobile-friendly (viewport, single column max width)", o.html.includes("width=device-width") && o.html.includes("max-width:"));

// ---------- recipients ----------
const r = parseRecipients(" Dad@X.test, son@x.test\nson@x.test ;  ");
check("recipients: commas, semicolons and new lines all separate; trimmed, lower-cased, de-duplicated", r.ok && r.emails.join("|") === "dad@x.test|son@x.test", JSON.stringify(r));
check("recipients: empty input is an empty list, not an error", parseRecipients("  ").ok && parseRecipients("").emails.length === 0);
check("recipients: one bad address rejects the list and names it", parseRecipients("dad@x.test, not-an-email").ok === false && parseRecipients("dad@x.test, not-an-email").error.includes("not-an-email"));
check("recipients: an absurdly long address is rejected", parseRecipients(`${"a".repeat(250)}@x.test`).ok === false);
check("recipients: more than 10 is rejected", parseRecipients(Array.from({ length: 11 }, (_, i) => `a${i}@x.test`).join(",")).ok === false);

// ---------- settings form ----------
const good = parseNotificationSettings({
  email_from_name: " Acme Orders ",
  email_from_address: "Orders@Acme.test",
  order_notify_emails: "dad@x.test",
  low_stock_notify_emails: "",
  daily_report_enabled: "on",
  daily_report_emails: "dad@x.test, son@x.test",
  daily_report_hour: "7",
  daily_report_sections: ["yesterday", "week", "low_stock"],
});
check("settings: a valid form is accepted and normalised", good.ok && good.row.email_from_name === "Acme Orders" && good.row.email_from_address === "orders@acme.test" && good.row.daily_report_hour === 7 && good.row.daily_report_enabled === true && good.row.low_stock_notify_emails.length === 0, JSON.stringify(good));
check("settings: unchecked report box means disabled", parseNotificationSettings({ daily_report_hour: "7" }).row?.daily_report_enabled === false);
check("settings: hour must be 0 to 23", parseNotificationSettings({ daily_report_hour: "24" }).ok === false && parseNotificationSettings({ daily_report_hour: "x" }).ok === false);
check("settings: an unknown report section is rejected", parseNotificationSettings({ daily_report_hour: "7", daily_report_sections: ["profit"] }).ok === false);
check("settings: report enabled with nobody to send to is rejected", parseNotificationSettings({ daily_report_enabled: "on", daily_report_hour: "7", daily_report_sections: ["today"] }).ok === false);
check("settings: report enabled with nothing in it is rejected", parseNotificationSettings({ daily_report_enabled: "on", daily_report_emails: "dad@x.test", daily_report_hour: "7", daily_report_sections: [] }).ok === false);
check("settings: a sender address that is not an email is rejected", parseNotificationSettings({ email_from_address: "acme", daily_report_hour: "7" }).ok === false);

// ---------- is the daily report due ----------
const TZ = "America/Toronto"; // 2026-11-26 is EST, UTC-5
const cfg = { daily_report_enabled: true, daily_report_emails: ["dad@x.test"], daily_report_hour: 7, last_daily_report_on: "2026-11-25" };
check("report: not before the chosen hour (06:59 local)", isDailyReportDue(new Date("2026-11-26T11:59:00Z"), cfg, TZ) === false);
check("report: due from the chosen hour (07:00 local)", isDailyReportDue(new Date("2026-11-26T12:00:00Z"), cfg, TZ) === true);
check("report: still due later the same day if it has not gone out", isDailyReportDue(new Date("2026-11-26T20:00:00Z"), cfg, TZ) === true);
check("report: never twice on one local day", isDailyReportDue(new Date("2026-11-26T20:00:00Z"), { ...cfg, last_daily_report_on: "2026-11-26" }, TZ) === false);
check("report: the local day, not the UTC day, decides (02:00 UTC on the 27th is still the 26th)", isDailyReportDue(new Date("2026-11-27T02:00:00Z"), { ...cfg, last_daily_report_on: "2026-11-26" }, TZ) === false);
check("report: never sent before counts as due", isDailyReportDue(new Date("2026-11-26T12:00:00Z"), { ...cfg, last_daily_report_on: null }, TZ) === true);
check("report: disabled is never due", isDailyReportDue(new Date("2026-11-26T12:00:00Z"), { ...cfg, daily_report_enabled: false }, TZ) === false);
check("report: no recipients is never due", isDailyReportDue(new Date("2026-11-26T12:00:00Z"), { ...cfg, daily_report_emails: [] }, TZ) === false);

// ---------- which products need a low-stock alert ----------
const rows = [
  { productId: "a", name: "A", sku: "A1", stockQty: 3, lowStockThreshold: 5, isActive: true, alertedAt: null },
  { productId: "b", name: "B", sku: "B1", stockQty: 2, lowStockThreshold: 5, isActive: true, alertedAt: "2026-11-20T00:00:00Z" },
  { productId: "c", name: "C", sku: "C1", stockQty: 9, lowStockThreshold: 5, isActive: true, alertedAt: "2026-11-20T00:00:00Z" },
  { productId: "d", name: "D", sku: "D1", stockQty: 9, lowStockThreshold: 5, isActive: true, alertedAt: null },
  { productId: "e", name: "E", sku: "E1", stockQty: 0, lowStockThreshold: 5, isActive: false, alertedAt: null },
  { productId: "f", name: "F", sku: "F1", stockQty: 5, lowStockThreshold: 5, isActive: true, alertedAt: null },
  { productId: "g", name: "G", sku: "G1", stockQty: -2, lowStockThreshold: 0, isActive: true, alertedAt: null },
];
const picked = pickLowStockAlerts(rows);
check("low stock: alerts products at or below their threshold that were not alerted yet", picked.toAlert.map((x) => x.productId).join("") === "afg", picked.toAlert.map((x) => x.productId).join(""));
check("low stock: an already-alerted product is not alerted again", !picked.toAlert.some((x) => x.productId === "b"));
check("low stock: a restocked product is re-armed for next time", picked.toClear.join("") === "c");
check("low stock: inactive products are ignored", !picked.toAlert.some((x) => x.productId === "e"));

const ls = buildLowStockEmail({ items: picked.toAlert, businessName: BUSINESS, siteUrl: SITE });
check("low stock email: lists each product with stock and threshold", ["A1", "F1", "G1"].every((s) => ls.html.includes(s) && ls.text.includes(s)) && ls.subject.includes("3"));
check("low stock email: negative stock is called oversold", /oversold by 2/i.test(ls.text));
check("low stock email: links to the low-stock list in the admin", ls.html.includes(`${SITE}/admin/products?stock=low`));

// ---------- daily report ----------
const data = {
  today: { label: "Today", orders: 2, revenueCents: 12000, pendingCount: 1 },
  yesterday: { label: "Yesterday", orders: 5, revenueCents: 99900, pendingCount: 0 },
  week: { label: "This week", orders: 14, revenueCents: 455000, pendingCount: 1 },
  lowStock: [{ name: "A", sku: "A1", stockQty: 3, lowStockThreshold: 5 }],
};
const d1 = buildDailyReportEmail({ sections: ["yesterday", "low_stock"], data, businessName: BUSINESS, siteUrl: SITE, dateLabel: "Thu, Nov 26, 2026" });
check("daily report: includes only the chosen sections", d1.text.includes("Yesterday") && d1.text.includes("$999.00") && d1.text.includes("A1") && !d1.text.includes("This week") && !d1.text.includes("$120.00"));
check("daily report: subject carries the date", d1.subject.includes("Nov 26, 2026"));
check("daily report: no cost, profit or margin wording", !/cost|profit|margin/i.test(words(d1)));
const d2 = buildDailyReportEmail({ sections: ["low_stock"], data: { ...data, lowStock: [] }, businessName: BUSINESS, siteUrl: SITE, dateLabel: "x" });
check("daily report: an empty low-stock section says so instead of vanishing", /no products are low/i.test(d2.text));

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0;
