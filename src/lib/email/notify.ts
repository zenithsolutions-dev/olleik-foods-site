import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { getBusinessIdentity } from "@/lib/business";
import { BUSINESS_TIME_ZONE, resolveDateRange } from "@/lib/dates";
import { fetchDashboardStats } from "@/lib/admin/dashboard-data";
import { REVENUE_STATUSES } from "@/lib/admin/dashboard-math";
import { fetchLowStock } from "@/lib/admin/inventory-data";
import { sendEmail, siteUrl } from "./send";
import {
  buildDailyReportEmail,
  buildLowStockEmail,
  buildOrderEmail,
  isDailyReportDue,
  localDayAndHour,
  pickLowStockAlerts,
  type DailyReportSection,
  type NotificationSettingsRow,
  type SalesFigures,
  type StockRow,
} from "./templates";

// What triggers an email. Each function is safe to call after the response has been sent and never
// throws: a notification problem is logged (email_log + console), it never undoes the user's action.

type Settings = NotificationSettingsRow & { last_daily_report_on: string | null };

async function readSettings(): Promise<Settings | null> {
  const { data, error } = (await getAdminClient()?.from("notification_settings").select("*").maybeSingle()) ?? {};
  if (error) console.error("[email] settings read failed (run migration 0018?):", error.message);
  return (data as Settings | null) ?? null;
}

const safely = async (what: string, run: () => Promise<void>) => {
  try {
    await run();
  } catch (e) {
    console.error(`[email] ${what} failed:`, e instanceof Error ? e.message : e);
  }
};

export function notifyNewOrder(orderId: string): Promise<void> {
  return safely("new-order notification", async () => {
    const admin = getAdminClient();
    const settings = await readSettings();
    if (!admin || !settings || settings.order_notify_emails.length === 0) return;

    const { data: row, error } = await admin
      .from("orders")
      .select("id, fulfillment, notes, total_cents, created_at, customers(business_name), order_items(name, sku, qty, unit_price_cents, line_total_cents)")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "order not found");
    const order = row as unknown as {
      id: string;
      fulfillment: string;
      notes: string | null;
      total_cents: number;
      created_at: string;
      customers: { business_name: string } | null;
      order_items: Array<{ name: string; sku: string; qty: number; unit_price_cents: number; line_total_cents: number }>;
    };

    const business = await getBusinessIdentity();
    await sendEmail({
      kind: "order",
      to: settings.order_notify_emails,
      relatedId: order.id,
      idempotencyKey: `order-${order.id}`,
      email: buildOrderEmail({
        businessName: business.displayName,
        siteUrl: siteUrl(),
        order: {
          id: order.id,
          customerName: order.customers?.business_name ?? "Unknown customer",
          fulfillment: order.fulfillment,
          notes: order.notes,
          totalCents: order.total_cents,
          createdAtLabel: new Date(order.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TIME_ZONE }),
          lines: order.order_items.map((l) => ({ name: l.name, sku: l.sku, qty: l.qty, unitPriceCents: l.unit_price_cents, lineTotalCents: l.line_total_cents })),
        },
      }),
    });
  });
}

// Call after anything that changes stock. Sends ONE email listing the products that just reached their
// threshold, and re-arms products that were restocked above it.
export function notifyLowStock(): Promise<void> {
  return safely("low-stock notification", async () => {
    const admin = getAdminClient();
    const settings = await readSettings();
    if (!admin || !settings || settings.low_stock_notify_emails.length === 0) return;

    const { data, error } = await admin
      .from("product_inventory")
      .select("product_id, stock_qty, low_stock_threshold, low_stock_alerted_at, products(name, sku, is_active)");
    if (error) throw new Error(error.message);
    type Row = {
      product_id: string;
      stock_qty: number;
      low_stock_threshold: number;
      low_stock_alerted_at: string | null;
      products: { name: string; sku: string; is_active: boolean } | null;
    };
    const rows: StockRow[] = ((data as unknown as Row[]) ?? []).map((r) => ({
      productId: r.product_id,
      name: r.products?.name ?? "(removed product)",
      sku: r.products?.sku ?? "",
      stockQty: r.stock_qty,
      lowStockThreshold: r.low_stock_threshold,
      isActive: r.products?.is_active ?? false,
      alertedAt: r.low_stock_alerted_at,
    }));
    const { toAlert, toClear } = pickLowStockAlerts(rows);

    if (toClear.length > 0) {
      await admin.from("product_inventory").update({ low_stock_alerted_at: null }).in("product_id", toClear);
    }
    if (toAlert.length === 0) return;

    // Claim before sending: only rows still unmarked are ours, so two stock changes landing together
    // cannot both email the same product.
    const { data: claimed, error: claimError } = await admin
      .from("product_inventory")
      .update({ low_stock_alerted_at: new Date().toISOString() })
      .in("product_id", toAlert.map((r) => r.productId))
      .is("low_stock_alerted_at", null)
      .select("product_id");
    if (claimError) throw new Error(claimError.message);
    const mine = new Set(((claimed as { product_id: string }[]) ?? []).map((r) => r.product_id));
    const items = toAlert.filter((r) => mine.has(r.productId));
    if (items.length === 0) return;

    const business = await getBusinessIdentity();
    const result = await sendEmail({
      kind: "low_stock",
      to: settings.low_stock_notify_emails,
      email: buildLowStockEmail({ items, businessName: business.displayName, siteUrl: siteUrl() }),
    });
    // Not delivered: release the claim so the next stock change tries again.
    if (!result.ok) await admin.from("product_inventory").update({ low_stock_alerted_at: null }).in("product_id", [...mine]);
  });
}

async function salesFor(preset: "today" | "yesterday" | "this-week", now: Date): Promise<SalesFigures> {
  const stats = await fetchDashboardStats(now, resolveDateRange({ range: preset }, now));
  return {
    label: stats.periodLabel,
    orders: REVENUE_STATUSES.reduce((n, status) => n + (stats.today.byStatus[status] ?? 0), 0),
    revenueCents: stats.today.revenueCents,
    pendingCount: stats.today.pendingCount,
  };
}

// Called by the schedule endpoint. Sends at most one report per local day, from the chosen hour onward.
export async function runDailyReport(now: Date = new Date()): Promise<{ sent: boolean; reason: string }> {
  const admin = getAdminClient();
  const settings = await readSettings();
  if (!admin || !settings) return { sent: false, reason: "not configured" };
  if (!isDailyReportDue(now, settings, BUSINESS_TIME_ZONE)) return { sent: false, reason: "not due" };

  const { day } = localDayAndHour(now, BUSINESS_TIME_ZONE);
  // Claim today's report first, so two overlapping schedule calls send one email.
  const { data: claimed, error: claimError } = await admin
    .from("notification_settings")
    .update({ last_daily_report_on: day })
    .eq("id", true)
    .or(`last_daily_report_on.is.null,last_daily_report_on.neq.${day}`)
    .select("id");
  if (claimError) return { sent: false, reason: claimError.message };
  if (!claimed || claimed.length === 0) return { sent: false, reason: "already sent today" };

  let result: { ok: boolean; error?: string };
  try {
    const sections = settings.daily_report_sections as DailyReportSection[];
    const [today, yesterday, week, lowStock, business] = await Promise.all([
      salesFor("today", now),
      salesFor("yesterday", now),
      salesFor("this-week", now),
      fetchLowStock(),
      getBusinessIdentity(),
    ]);
    result = await sendEmail({
      kind: "daily_report",
      to: settings.daily_report_emails,
      // No idempotency key: a retry after a failed attempt carries different content, which the email
      // service would reject for the rest of the day. The claim above already prevents double sends.
      email: buildDailyReportEmail({
        sections,
        data: { today, yesterday, week, lowStock: lowStock.items },
        businessName: business.displayName,
        siteUrl: siteUrl(),
        dateLabel: now.toLocaleDateString("en-CA", { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: BUSINESS_TIME_ZONE }),
      }),
    });
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "report failed" };
  }
  if (!result.ok) {
    // Not delivered: release the claim so the next schedule call tries again today.
    await admin.from("notification_settings").update({ last_daily_report_on: settings.last_daily_report_on }).eq("id", true);
    return { sent: false, reason: result.error ?? "send failed" };
  }
  return { sent: true, reason: "sent" };
}
