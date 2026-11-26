// Public specials: rules (pure) and database behaviour (local throwaway database).
//   node scripts/test-local.mjs specials
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  parseSpecialForm,
  pickSpecialForLine,
  remainingQty,
  specialState,
  toPublicSpecial,
  whatsappShareUrl,
} from "../src/lib/specials.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};

const NOW = new Date("2026-11-27T15:00:00Z");
const base = {
  id: "11111111-1111-4111-8111-111111111111",
  product_id: "22222222-2222-4222-8222-222222222222",
  title: "Olive Oil 3L tins",
  description: "Pallet deal",
  image_url: null,
  unit_label: "3 L / tin",
  special_price_cents: 1899,
  quantity_total: 500,
  quantity_sold: 400,
  starts_at: null,
  ends_at: null,
  is_published: true,
  show_price_to_guests: true,
};

// ---------- state ----------
check("published with stock and no dates is live", specialState(base, NOW) === "live");
check("unpublished is a draft, whatever else is true", specialState({ ...base, is_published: false }, NOW) === "draft");
check("published but starting later is scheduled", specialState({ ...base, starts_at: "2026-11-28T00:00:00Z" }, NOW) === "scheduled");
check("past its end is ended", specialState({ ...base, ends_at: "2026-11-27T14:59:59Z" }, NOW) === "ended");
check("all sold is sold out", specialState({ ...base, quantity_sold: 500 }, NOW) === "sold_out");
check("ended wins over sold out (it comes off the site)", specialState({ ...base, quantity_sold: 500, ends_at: "2026-11-01T00:00:00Z" }, NOW) === "ended");
check("remaining never goes below zero", remainingQty({ ...base, quantity_sold: 520 }) === 0 && remainingQty(base) === 100);

// ---------- what the public sees ----------
const guest = toPublicSpecial(base, { isCustomer: false }, NOW);
check("a guest sees a live special with price and remaining", guest?.priceCents === 1899 && guest.remaining === 100 && guest.isSoldOut === false);
const hidden = toPublicSpecial({ ...base, show_price_to_guests: false }, { isCustomer: false }, NOW);
check("price hidden from guests: the guest gets no price at all", hidden !== null && hidden.priceCents === null && !JSON.stringify(hidden).includes("1899"));
check("a customer always sees the price", toPublicSpecial({ ...base, show_price_to_guests: false }, { isCustomer: true }, NOW)?.priceCents === 1899);
check("sold out is still shown, flagged", toPublicSpecial({ ...base, quantity_sold: 500 }, { isCustomer: false }, NOW)?.isSoldOut === true);
check("drafts, scheduled and ended specials are not shown", [{ is_published: false }, { starts_at: "2026-12-01T00:00:00Z" }, { ends_at: "2026-11-01T00:00:00Z" }].every((p) => toPublicSpecial({ ...base, ...p }, { isCustomer: true }, NOW) === null));
check("the public shape carries no internal fields", guest && !("quantity_sold" in guest) && !("product_id" in guest) && !("is_published" in guest));

// ---------- which price an order line gets ----------
const line = (over) => pickSpecialForLine({ special: base, qty: 10, normalUnitPriceCents: 2500, now: NOW, ...over });
check("special cheaper than the customer's price: the special is used", line().kind === "special" && line().unitPriceCents === 1899);
check("customer's own price is cheaper: theirs is used and the special is not consumed", line({ normalUnitPriceCents: 1500 }).kind === "normal");
check("equal price: the customer's own price, special not consumed", line({ normalUnitPriceCents: 1899 }).kind === "normal");
check("product not otherwise available to this customer: the special is the only way", line({ normalUnitPriceCents: null }).kind === "special");
check("asking for more than is left is refused with the number left", line({ qty: 101 }).kind === "short" && line({ qty: 101 }).remaining === 100);
check("exactly what is left is fine", line({ qty: 100 }).kind === "special");
check("no special, or one that is not live: normal price", pickSpecialForLine({ special: null, qty: 1, normalUnitPriceCents: 2500, now: NOW }).kind === "normal" && line({ special: { ...base, is_published: false } }).kind === "normal");
check("sold out with a normal price available: normal price", line({ special: { ...base, quantity_sold: 500 } }).kind === "normal");
check("sold out and no other way to buy: unavailable", line({ special: { ...base, quantity_sold: 500 }, normalUnitPriceCents: null }).kind === "unavailable");

// ---------- the admin form ----------
const form = { product_id: base.product_id, title: "  Olive Oil 3L tins ", description: "", unit_label: "3 L / tin", image_url: "", price: "18.99", quantity_total: "500", start_date: "", end_date: "", is_published: "on", show_price_to_guests: "on" };
const TZ = "America/Toronto";
const parsed = parseSpecialForm(form, TZ);
check("a valid form is accepted: trimmed, cents, booleans", parsed.ok && parsed.row.title === "Olive Oil 3L tins" && parsed.row.special_price_cents === 1899 && parsed.row.quantity_total === 500 && parsed.row.is_published === true && parsed.row.description === null && parsed.row.starts_at === null, JSON.stringify(parsed));
check("unticked boxes mean off", parseSpecialForm({ ...form, is_published: undefined, show_price_to_guests: undefined }, TZ).row?.is_published === false);
const dated = parseSpecialForm({ ...form, start_date: "2026-12-01", end_date: "2026-12-01" }, TZ);
check("dates are whole local days: a one-day special runs midnight to midnight in the business time zone", dated.ok && dated.row.starts_at === "2026-12-01T05:00:00.000Z" && dated.row.ends_at === "2026-12-02T05:00:00.000Z", JSON.stringify(dated.row));
check("end before start is rejected", parseSpecialForm({ ...form, start_date: "2026-12-02", end_date: "2026-12-01" }, TZ).ok === false);
for (const [name, patch] of [
  ["a missing title", { title: " " }],
  ["a zero price", { price: "0" }],
  ["a price that is not a number", { price: "abc" }],
  ["a price with more than two decimals", { price: "1.999" }],
  ["a zero quantity", { quantity_total: "0" }],
  ["a fractional quantity", { quantity_total: "1.5" }],
  ["a product id that is not an id", { product_id: "x" }],
  ["an image address that is not http(s)", { image_url: "javascript:alert(1)" }],
  ["a malformed date", { start_date: "12/01/2026" }],
]) check(`rejected: ${name}`, parseSpecialForm({ ...form, ...patch }, TZ).ok === false);

// ---------- sharing ----------
const share = whatsappShareUrl({ title: "Olive Oil 3L tins", priceCents: 1899, unitLabel: "3 L / tin", remaining: 100, url: "https://shop.example.test/specials/abc", businessName: "Acme & Sons" });
const shared = decodeURIComponent(share.split("?text=")[1]);
check("WhatsApp link is a click-to-chat link with the text encoded", share.startsWith("https://wa.me/?text=") && !share.includes(" ") && !share.includes("&"));
check("the message has the offer, the price, how many are left and the link", ["Olive Oil 3L tins", "$18.99", "100 left", "https://shop.example.test/specials/abc", "Acme & Sons"].every((s) => shared.includes(s)), shared);
check("no price in the message when it is hidden from guests", !decodeURIComponent(whatsappShareUrl({ title: "T", priceCents: null, unitLabel: null, remaining: 5, url: "https://x.test/s", businessName: "B" })).includes("$"));

// ---------- database (0019) ----------
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const opts = { auth: { persistSession: false } };
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const created = { specials: [], orders: [], products: [] };
try {
  const { data: product, error: pErr } = await svc.from("products").insert({ sku: `QA-SPECIAL-${Date.now()}`, name: "QA special product", unit: "ea", unit_size: "1", list_price_cents: 3000, is_active: true }).select("id").single();
  if (pErr) throw new Error(`cannot create test product: ${pErr.message}`);
  created.products.push(product.id);
  const { data: customer } = await svc.from("customers").select("id").eq("status", "active").limit(1).single();

  const mk = async (over = {}) => {
    const r = await svc.from("specials").insert({ product_id: product.id, title: "QA special", special_price_cents: 1000, quantity_total: 5, is_published: true, ...over }).select("*").single();
    if (r.data) created.specials.push(r.data.id);
    return r;
  };
  const live = await mk();
  check("a special can be created", !live.error && live.data.quantity_sold === 0, live.error?.message);
  check("a second PUBLISHED special for the same product is refused", (await mk()).error != null);
  check("a draft for the same product is allowed", !(await mk({ is_published: false })).error);
  check("a visitor (anon key) cannot read the table directly", ((await anon.from("specials").select("id")).data ?? []).length === 0);
  check("a visitor cannot write to it", (await anon.from("specials").update({ special_price_cents: 1 }).eq("id", live.data.id).select()).data?.length !== 1 && (await svc.from("specials").select("special_price_cents").eq("id", live.data.id).single()).data.special_price_cents === 1000);
  check("sold can never exceed the total (database rule)", (await svc.from("specials").update({ quantity_sold: 6 }).eq("id", live.data.id).select()).error != null);

  // An order line carrying the special takes from its quantity, inside the same transaction.
  const order = async (qty, token) =>
    svc.rpc("submit_order_atomic", {
      p_customer_id: customer.id, p_fulfillment: "pickup", p_notes: null, p_payment_terms: "net-30", p_total_cents: qty * 1000, p_client_token: token,
      p_lines: [{ product_id: product.id, name: "QA special product", sku: "QA", unit: "ea", unit_size: "1", qty, base_price_cents: 3000, unit_price_cents: 1000, applied_offer_title: "Special: QA special", was_assigned: false, cost_cents: null, special_id: live.data.id }],
    });
  const sold = async () => (await svc.from("specials").select("quantity_sold").eq("id", live.data.id).single()).data.quantity_sold;
  const o1 = await order(3, crypto.randomUUID());
  if (o1.data) created.orders.push(o1.data);
  check("ordering 3 of 5 succeeds and 3 are taken", !o1.error && (await sold()) === 3, o1.error?.message);
  const o2 = await order(3, crypto.randomUUID());
  if (o2.data) created.orders.push(o2.data);
  check("ordering 3 more when 2 are left is refused, and no order is created", o2.error != null && /SPECIAL_SOLD_OUT/.test(o2.error.message) && (await sold()) === 3, o2.error?.message ?? "no error");
  const o3 = await order(2, crypto.randomUUID());
  if (o3.data) created.orders.push(o3.data);
  check("ordering the last 2 succeeds: sold out exactly", !o3.error && (await sold()) === 5, o3.error?.message);
  const item = await svc.from("order_items").select("special_id").eq("order_id", o1.data).single();
  check("the order line remembers which special it used", item.data?.special_id === live.data.id);

  await svc.from("specials").update({ is_published: false }).eq("id", live.data.id);
  const o4 = await order(1, crypto.randomUUID());
  if (o4.data) created.orders.push(o4.data);
  check("an unpublished special cannot be ordered", o4.error != null && /SPECIAL_SOLD_OUT/.test(o4.error.message));
  await svc.from("specials").update({ is_published: true }).eq("id", live.data.id);

  const cancel = await svc.rpc("cancel_order_with_restock", { p_order_id: o1.data, p_admin_note: "qa" });
  check("cancelling an order gives its quantity back to the special", !cancel.error && (await sold()) === 2, cancel.error?.message);
  await svc.rpc("cancel_order_with_restock", { p_order_id: o1.data, p_admin_note: "qa again" });
  check("cancelling the same order twice gives it back only once", (await sold()) === 2);
} catch (e) {
  check("database checks ran", false, e.message);
} finally {
  for (const id of created.orders) {
    await svc.from("order_stock_movements").delete().eq("order_id", id);
    await svc.from("order_item_costs").delete().eq("order_id", id);
    await svc.from("order_items").delete().eq("order_id", id);
    await svc.from("orders").delete().eq("id", id);
  }
  for (const id of created.specials) await svc.from("specials").delete().eq("id", id);
  for (const id of created.products) await svc.from("products").delete().eq("id", id);
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0;
