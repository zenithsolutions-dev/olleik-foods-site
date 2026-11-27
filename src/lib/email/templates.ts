// Email content and the rules around it. Pure and dependency-free: the test suite imports this directly.
// Emails are plain and phone-friendly: one column, system fonts, a text version of everything.
// They never carry cost, profit or margin — a recipient may be an admin who is not an owner.

export type Email = { subject: string; html: string; text: string };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10;
const MAX_ADDRESS_LENGTH = 254; // the longest address the email standards allow

function layout(title: string, bodyHtml: string, businessName: string): string {
  return [
    `<!doctype html><html><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>`,
    `<body style="margin:0;padding:16px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;font-size:16px;line-height:1.5">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:20px">`,
    `<p style="margin:0 0 16px;font-size:13px;color:#78716c">${escapeHtml(businessName)}</p>`,
    bodyHtml,
    `</div></body></html>`,
  ].join("");
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${escapeHtml(label)}</a></p>`;

const heading = (text: string) => `<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(text)}</h1>`;

// ---------- new order ----------

export type OrderEmailInput = {
  id: string;
  customerName: string;
  fulfillment: string;
  notes: string | null;
  totalCents: number;
  createdAtLabel: string;
  lines: Array<{ name: string; sku: string; qty: number; unitPriceCents: number; lineTotalCents: number }>;
};

export function buildOrderEmail(args: { order: OrderEmailInput; businessName: string; siteUrl: string }): Email {
  const { order, businessName } = args;
  const url = `${args.siteUrl}/admin/orders/${order.id}`;
  const how = order.fulfillment === "pickup" ? "Pickup" : "Delivery";
  const subject = `New order: ${order.customerName} — ${money(order.totalCents)}`;

  const rows = order.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 8px 6px 0;border-top:1px solid #e7e5e4">${escapeHtml(l.name)}<br><span style="font-size:12px;color:#78716c">${escapeHtml(l.sku)} · ${l.qty} × ${money(l.unitPriceCents)}</span></td>` +
        `<td style="padding:6px 0;border-top:1px solid #e7e5e4;text-align:right;white-space:nowrap">${money(l.lineTotalCents)}</td></tr>`,
    )
    .join("");
  const html = layout(
    subject,
    [
      heading("New order"),
      `<p style="margin:0"><strong>${escapeHtml(order.customerName)}</strong><br>${escapeHtml(order.createdAtLabel)} · ${how}</p>`,
      order.notes ? `<p style="margin:12px 0 0;padding:10px;background:#fafaf9;border-radius:6px"><strong>Note:</strong> ${escapeHtml(order.notes)}</p>` : "",
      `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px">${rows}`,
      `<tr><td style="padding:10px 8px 0 0;border-top:2px solid #1c1917"><strong>Total</strong></td><td style="padding:10px 0 0;border-top:2px solid #1c1917;text-align:right"><strong>${money(order.totalCents)}</strong></td></tr></table>`,
      button(url, "Open this order"),
    ].join(""),
    businessName,
  );
  const text = [
    `New order — ${businessName}`,
    `${order.customerName}`,
    `${order.createdAtLabel} · ${how}`,
    order.notes ? `Note: ${order.notes}` : null,
    "",
    ...order.lines.map((l) => `${l.qty} x ${l.name} (${l.sku}) @ ${money(l.unitPriceCents)} = ${money(l.lineTotalCents)}`),
    `Total: ${money(order.totalCents)}`,
    "",
    `Open this order: ${url}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject, html, text };
}

// ---------- low stock ----------

export type StockRow = {
  productId: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  alertedAt: string | null;
};

// One alert per dip: a product is alerted when it reaches its threshold and re-armed once restocked above it.
export function pickLowStockAlerts(rows: StockRow[]): { toAlert: StockRow[]; toClear: string[] } {
  return {
    toAlert: rows.filter((r) => r.isActive && r.alertedAt === null && r.stockQty <= r.lowStockThreshold),
    toClear: rows.filter((r) => r.alertedAt !== null && r.stockQty > r.lowStockThreshold).map((r) => r.productId),
  };
}

type LowStockItem = Pick<StockRow, "name" | "sku" | "stockQty" | "lowStockThreshold">;

const stockLabel = (item: LowStockItem) =>
  item.stockQty < 0 ? `oversold by ${-item.stockQty}` : `${item.stockQty} left`;

const lowStockRowsHtml = (items: LowStockItem[]) =>
  `<table role="presentation" style="width:100%;border-collapse:collapse">` +
  items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px 6px 0;border-top:1px solid #e7e5e4">${escapeHtml(i.name)}<br><span style="font-size:12px;color:#78716c">${escapeHtml(i.sku)} · alert at ${i.lowStockThreshold}</span></td>` +
        `<td style="padding:6px 0;border-top:1px solid #e7e5e4;text-align:right;white-space:nowrap"><strong>${stockLabel(i)}</strong></td></tr>`,
    )
    .join("") +
  `</table>`;

const lowStockRowsText = (items: LowStockItem[]) =>
  items.map((i) => `- ${i.name} (${i.sku}): ${stockLabel(i)}, alert at ${i.lowStockThreshold}`);

export function buildLowStockEmail(args: { items: LowStockItem[]; businessName: string; siteUrl: string }): Email {
  const { items, businessName } = args;
  const url = `${args.siteUrl}/admin/products?stock=low`;
  const subject = `Low stock: ${items.length} product${items.length === 1 ? "" : "s"}`;
  const html = layout(
    subject,
    [heading(subject), `<p style="margin:0 0 12px">These just reached their low-stock level.</p>`, lowStockRowsHtml(items), button(url, "Open low-stock list")].join(""),
    businessName,
  );
  const text = [`${subject} — ${businessName}`, "These just reached their low-stock level.", "", ...lowStockRowsText(items), "", `Open low-stock list: ${url}`].join("\n");
  return { subject, html, text };
}

// ---------- daily report ----------

export const DAILY_REPORT_SECTIONS = ["today", "yesterday", "week", "low_stock"] as const;
export type DailyReportSection = (typeof DAILY_REPORT_SECTIONS)[number];
export const DAILY_REPORT_SECTION_LABELS: Record<DailyReportSection, string> = {
  today: "Today's sales so far",
  yesterday: "Yesterday's sales",
  week: "This week's sales",
  low_stock: "Low-stock products",
};

export type SalesFigures = { label: string; orders: number; revenueCents: number; pendingCount: number };
export type DailyReportData = {
  today: SalesFigures;
  yesterday: SalesFigures;
  week: SalesFigures;
  lowStock: LowStockItem[];
};

export function buildDailyReportEmail(args: {
  sections: DailyReportSection[];
  data: DailyReportData;
  businessName: string;
  siteUrl: string;
  dateLabel: string;
}): Email {
  const { data, businessName } = args;
  const subject = `Daily report — ${args.dateLabel}`;
  const html: string[] = [heading(subject)];
  const text: string[] = [`${subject} — ${businessName}`, ""];

  for (const key of DAILY_REPORT_SECTIONS.filter((s) => args.sections.includes(s))) {
    if (key === "low_stock") {
      html.push(`<h2 style="margin:18px 0 8px;font-size:16px">Low stock</h2>`);
      text.push("Low stock");
      if (data.lowStock.length === 0) {
        html.push(`<p style="margin:0">No products are low on stock.</p>`);
        text.push("No products are low on stock.", "");
      } else {
        html.push(lowStockRowsHtml(data.lowStock));
        text.push(...lowStockRowsText(data.lowStock), "");
      }
      continue;
    }
    const f = data[key];
    const waiting = f.pendingCount > 0 ? `${f.pendingCount} waiting for confirmation` : "none waiting";
    html.push(
      `<h2 style="margin:18px 0 4px;font-size:16px">${escapeHtml(f.label)}</h2>`,
      `<p style="margin:0"><strong style="font-size:22px">${money(f.revenueCents)}</strong><br>${f.orders} accepted order${f.orders === 1 ? "" : "s"} · ${waiting}</p>`,
    );
    text.push(`${f.label}: ${money(f.revenueCents)} from ${f.orders} accepted order${f.orders === 1 ? "" : "s"} (${waiting})`, "");
  }
  html.push(button(`${args.siteUrl}/admin`, "Open dashboard"));
  text.push(`Open dashboard: ${args.siteUrl}/admin`);
  return { subject, html: layout(subject, html.join(""), businessName), text: text.join("\n") };
}

// ---------- account statement ----------

// Sent to a customer: a link to their statement. Account activity only — never cost, profit or margin.
export function buildStatementEmail(args: {
  customerName: string;
  businessName: string;
  periodLabel: string;
  url: string;
  expiresLabel: string;
}): Email {
  const subject = `Your statement from ${args.businessName} — ${args.periodLabel}`;
  const html = layout(
    subject,
    [
      heading("Your account statement"),
      `<p style="margin:0">Hello ${escapeHtml(args.customerName)},</p>`,
      `<p style="margin:12px 0 0">Here is your statement for <strong>${escapeHtml(args.periodLabel)}</strong>. You can read it on your phone, print it, or save it as a PDF.</p>`,
      button(args.url, "Open my statement"),
      `<p style="margin:16px 0 0;font-size:13px;color:#78716c">The link works until ${escapeHtml(args.expiresLabel)}. If you did not expect this email, you can ignore it.</p>`,
    ].join(""),
    args.businessName,
  );
  const text = [
    `Hello ${args.customerName},`,
    "",
    `Here is your statement from ${args.businessName} for ${args.periodLabel}:`,
    args.url,
    "",
    `The link works until ${args.expiresLabel}.`,
  ].join("\n");
  return { subject, html, text };
}

// ---------- settings ----------

export type NotificationSettingsRow = {
  email_from_name: string | null;
  email_from_address: string | null;
  order_notify_emails: string[];
  low_stock_notify_emails: string[];
  daily_report_enabled: boolean;
  daily_report_emails: string[];
  daily_report_hour: number; // 0–23, in the business time zone
  daily_report_sections: DailyReportSection[];
};

export function parseRecipients(input: string): { ok: true; emails: string[] } | { ok: false; error: string } {
  const emails = [...new Set(input.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const bad = emails.find((e) => e.length > MAX_ADDRESS_LENGTH || !EMAIL_PATTERN.test(e));
  if (bad) return { ok: false, error: `"${bad.slice(0, 60)}" is not a valid email address.` };
  if (emails.length > MAX_RECIPIENTS) return { ok: false, error: `At most ${MAX_RECIPIENTS} addresses per list.` };
  return { ok: true, emails };
}

type FormInput = Record<string, string | string[] | undefined>;

export function parseNotificationSettings(
  input: FormInput,
): { ok: true; row: NotificationSettingsRow } | { ok: false; error: string; row?: undefined } {
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
  const lists: Record<string, string[]> = {};
  for (const key of ["order_notify_emails", "low_stock_notify_emails", "daily_report_emails"]) {
    const parsed = parseRecipients(str(key));
    if (!parsed.ok) return { ok: false, error: parsed.error };
    lists[key] = parsed.emails;
  }

  const fromAddress = str("email_from_address").toLowerCase() || null;
  if (fromAddress && !EMAIL_PATTERN.test(fromAddress)) return { ok: false, error: "Sender address is not a valid email address." };
  const fromName = str("email_from_name") || null;
  if (fromName && fromName.length > 80) return { ok: false, error: "Sender name is too long." };

  const hourText = str("daily_report_hour");
  const hour = Number(hourText);
  if (hourText === "" || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, error: "Report time must be an hour from 0 to 23." };
  }

  const picked = Array.isArray(input.daily_report_sections) ? input.daily_report_sections : [];
  const unknown = picked.find((s) => !(DAILY_REPORT_SECTIONS as readonly string[]).includes(s));
  if (unknown) return { ok: false, error: `Unknown report section "${unknown}".` };
  const sections = DAILY_REPORT_SECTIONS.filter((s) => picked.includes(s));

  const enabled = str("daily_report_enabled") !== "";
  if (enabled && lists.daily_report_emails.length === 0) return { ok: false, error: "Add at least one address for the daily report, or turn it off." };
  if (enabled && sections.length === 0) return { ok: false, error: "Choose at least one thing to include in the daily report, or turn it off." };

  return {
    ok: true,
    row: {
      email_from_name: fromName,
      email_from_address: fromAddress,
      order_notify_emails: lists.order_notify_emails,
      low_stock_notify_emails: lists.low_stock_notify_emails,
      daily_report_enabled: enabled,
      daily_report_emails: lists.daily_report_emails,
      daily_report_hour: hour,
      daily_report_sections: sections,
    },
  };
}

// The local calendar day and hour in the business time zone.
export function localDayAndHour(now: Date, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// Due once per local day, from the chosen hour onward. "From … onward" (not "exactly at") so a scheduler
// that only fires once a day, or fires late, still sends that day's report.
export function isDailyReportDue(
  now: Date,
  settings: Pick<NotificationSettingsRow, "daily_report_enabled" | "daily_report_emails" | "daily_report_hour"> & {
    last_daily_report_on: string | null;
  },
  timeZone: string,
): boolean {
  if (!settings.daily_report_enabled || settings.daily_report_emails.length === 0) return false;
  const { day, hour } = localDayAndHour(now, timeZone);
  return hour >= settings.daily_report_hour && settings.last_daily_report_on !== day;
}
