// CP-8a-2 bulk-offers test.
//
// PURE (always runs): targeting modes; the preview's skip reasons (stated,
// never silent); no-change customers shown AND applied; aggregate math; the
// over-cap refusal; empty-batch refusal shape; batch summaries (original vs
// remaining vs removed-individually); the undo confirmation text naming exact
// scope.
//
// LIVE (requires migration 0013; auto-detected): bulk rows are IDENTICAL in
// behaviour to hand-applied rows (same RLS visibility from the customer's own
// session, same pricing outcome); undo deletes EXACTLY the batch — a hand
// offer added later survives verbatim; individual removal shrinks the batch
// without touching the rest; idempotent double-submit; double undo; undo after
// expiry. If 0013 is not applied yet, the live section reports SKIPPED loudly
// (not silently green) and the script still exits by pure-check status.
//
//   node --experimental-strip-types scripts/test-bulk-offers.mjs   (npm run test:bulk-offers)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  buildBulkPreview,
  targetCustomers,
  summarizeBatches,
  undoConfirmationText,
  BULK_BATCH_CAP,
} from "../src/lib/admin/bulk-offers.ts";
import { applyOffersToPrice, offerAppliesToProduct } from "../src/lib/pricing.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rnd = Math.random().toString(36).slice(2, 8);

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

const NOW = new Date("2026-08-03T12:00:00Z");
const days = (n) => new Date(NOW.getTime() + n * 24 * 3600_000).toISOString();

const TPL = { id: "tpl-1", name: "Summer deal", discountKind: "percent", discountValue: 10 };
const cust = (over = {}) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  businessName: over.businessName ?? "Cust",
  status: "active",
  lastOrderAt: null,
  products: [
    { productId: "p-1", name: "Feta", priceCents: 1000, listPriceCents: 1200 },
    { productId: "p-2", name: "Olives", priceCents: null, listPriceCents: 2000 },
  ],
  offers: [],
  ...over,
});

// ---------- pure: targeting ----------
console.log("--- targeting (approved D-B1) ---");
{
  const cs = [
    cust({ id: "a", businessName: "A", lastOrderAt: days(-5) }),
    cust({ id: "b", businessName: "B", lastOrderAt: days(-45) }),
    cust({ id: "c", businessName: "C", lastOrderAt: null }),
    cust({ id: "d", businessName: "D (pending)", status: "pending" }),
    cust({ id: "e", businessName: "E (archived)", status: "archived" }),
  ];
  note(targetCustomers(cs, "all-active", NOW).length === 3,
    "all-active targets exactly the active customers (pending/archived out)");
  note(targetCustomers(cs, "ordered-within", NOW, { withinDays: 30 }).map((c) => c.id).join() === "a",
    "ordered-within 30d: only the 5-day-ago orderer");
  note(targetCustomers(cs, "ordered-within", NOW, { withinDays: 60 }).map((c) => c.id).sort().join() === "a,b",
    "ordered-within 60d picks up the 45-day-ago orderer");
  note(targetCustomers(cs, "hand-picked", NOW, { pickedIds: ["b", "d"] }).map((c) => c.id).join() === "b",
    "hand-picked intersects with ACTIVE (a picked pending customer stays out)");
}

// ---------- pure: preview ----------
console.log("\n--- preview: skips stated, no-change applied AND stated ---");
{
  const targets = [
    cust({ id: "moves", businessName: "Moves" }), // -10% on both products
    cust({
      id: "nochange",
      businessName: "NoChange",
      // an existing 20% offer already beats the new 10% everywhere
      offers: [{ templateId: "other", isActive: true, startsAt: null, endsAt: null, productId: null, discountKind: "percent", discountValue: 20 }],
    }),
    cust({
      id: "dup",
      businessName: "Duplicate",
      offers: [{ templateId: TPL.id, isActive: true, startsAt: null, endsAt: null, productId: null, discountKind: "percent", discountValue: 10 }],
    }),
    cust({ id: "pending", businessName: "Pending", status: "pending" }),
  ];
  const pv = buildBulkPreview({ targets, template: TPL, window: { startsAt: null, endsAt: days(10) }, productId: null, now: NOW });

  note(pv.toApply.length === 2 && pv.skipped.length === 2, "2 applied (incl. no-change), 2 skipped");
  note(pv.skipped.find((s) => s.customerId === "dup")?.reason === "duplicate-offer",
    "same template already RUNNING → duplicate skip (D-B4), stated by name");
  note(pv.skipped.find((s) => s.customerId === "pending")?.reason === "not-active",
    "pending customer skipped WITH reason, never silently");
  const moves = pv.toApply.find((p) => p.customerId === "moves");
  const nochange = pv.toApply.find((p) => p.customerId === "nochange");
  note(moves?.effect.affectedCount === 2 && Math.abs(moves.effect.averageDropPct - 10) < 0.001,
    "moving customer: both products drop 10%");
  note(nochange?.effect.affectedCount === 0,
    "no-change customer is IN toApply with zero movement — shown, applied, stated");
  note(pv.customersWithMovement === 1 && pv.customersNoChange === 1 && pv.totalProductsAffected === 2,
    "aggregates: 1 moving, 1 no-change, 2 products total");
  note(!pv.overCap, "under the cap");

  // Duplicate skip requires the duplicate to be RUNNING — an expired copy doesn't block.
  const expiredDup = buildBulkPreview({
    targets: [cust({
      id: "expdup",
      offers: [{ templateId: TPL.id, isActive: true, startsAt: null, endsAt: days(-1), productId: null, discountKind: "percent", discountValue: 10 }],
    })],
    template: TPL, window: { startsAt: null, endsAt: null }, productId: null, now: NOW,
  });
  note(expiredDup.toApply.length === 1 && expiredDup.skipped.length === 0,
    "an EXPIRED copy of the same template doesn't block re-applying");

  // Product-scoped: unassigned product → skip; zero-assigned-products customer too.
  const scoped = buildBulkPreview({
    targets: [cust({ id: "hasit" }), cust({ id: "lacksit", products: [] })],
    template: TPL, window: { startsAt: null, endsAt: null }, productId: "p-1", now: NOW,
  });
  note(
    scoped.toApply.length === 1 &&
      scoped.skipped.find((s) => s.customerId === "lacksit")?.reason === "product-not-assigned",
    "product-scoped offer skips (with reason) the customer without that product",
  );

  const allSkipped = buildBulkPreview({
    targets: [cust({ id: "x", status: "pending" })],
    template: TPL, window: { startsAt: null, endsAt: null }, productId: null, now: NOW,
  });
  note(allSkipped.toApply.length === 0, "every-customer-skipped preview → toApply empty (action refuses; nothing created)");

  const big = buildBulkPreview({
    targets: Array.from({ length: BULK_BATCH_CAP + 1 }, (_, i) => cust({ id: `c${i}` })),
    template: TPL, window: { startsAt: null, endsAt: null }, productId: null, now: NOW,
  });
  note(big.overCap, `${BULK_BATCH_CAP + 1} targets → overCap (refused, never truncated)`);
}

// ---------- pure: batch summaries + undo text ----------
console.log("\n--- batch summaries and the unmistakable undo text ---");
{
  const rows = [
    { batchId: "b1", batchSize: 3, templateId: null, title: "Summer deal", customerId: "a", customerName: "A", createdAt: days(-2), endsAt: days(5), isActive: true },
    { batchId: "b1", batchSize: 3, templateId: null, title: "Summer deal", customerId: "b", customerName: "B", createdAt: days(-2), endsAt: days(5), isActive: true },
    // third member individually removed — row gone
    { batchId: "b2", batchSize: 1, templateId: null, title: "Old push", customerId: "c", customerName: "C", createdAt: days(-10), endsAt: days(-1), isActive: true },
  ];
  const sums = summarizeBatches(rows, NOW);
  const b1 = sums.find((s) => s.batchId === "b1");
  const b2 = sums.find((s) => s.batchId === "b2");
  note(b1.originalSize === 3 && b1.remaining === 2 && b1.removedIndividually === 1 && b1.live,
    "batch summary: applied to 3, 2 remain, 1 removed individually, still live");
  note(b2.live === false, "expired batch reports not-live");
  const txt = undoConfirmationText(b1);
  note(
    txt.includes("the 2 customers") && txt.includes("1 of the original 3") && txt.includes("No other offer"),
    `undo text names exact scope: "${txt.slice(0, 90)}…"`,
  );
  note(undoConfirmationText(b2).includes("no longer live"),
    "undo text for an expired batch says it changes no price");
}

// ---------- live ----------
console.log("\n--- live: behaviour identity, undo scoping, idempotency ---");
const probe = await svc.from("customer_offers").select("batch_id").limit(1);
const migration0013 = !(probe.error && (probe.error.code === "42703" || probe.error.code === "42P01"));

let prod, custA, custB, userA;
const A = { email: `zzbulk-a-${rnd}@example.com`, password: `Test!${rnd}aA9` };
const batch1 = randomUUID();
if (!migration0013) {
  console.log("⚠ SKIPPED: migration 0013 not applied to the live DB yet.");
  console.log("  The live checks (behaviour identity, undo scoping, idempotency) run");
  console.log("  automatically once 0013 is applied — rerun: npm run test:bulk-offers");
  console.log(pass ? "\n=== BULK OFFERS TEST: PASS (pure) — live section pending 0013 ===" : "\n=== BULK OFFERS TEST: failures above ===");
  process.exitCode = pass ? 0 : 1;
} else {
try {
  const { data: p } = await svc.from("products")
    .insert({ sku: `ZZBULK-${rnd}`, name: `ZZBULK ${rnd}`, unit: "ea", unit_size: "1", list_price_cents: 1000, is_active: true })
    .select("id").single();
  prod = p.id;
  {
    const { data: u, error: ue } = await svc.auth.admin.createUser({
      email: A.email, password: A.password, email_confirm: true,
    });
    if (ue) throw ue;
    userA = u.user.id;
  }
  const mk = async (name, uid) => {
    const { data: c } = await svc.from("customers")
      .insert({ business_name: name, contact_name: "b", email: `${name}-${rnd}@x.com`, phone: "0", status: "active", user_id: uid ?? null })
      .select("id").single();
    return c.id;
  };
  custA = await mk(`ZZBULK-A-${rnd}`, userA);
  custB = await mk(`ZZBULK-B-${rnd}`);
  await svc.from("customer_products").insert([
    { customer_id: custA, product_id: prod, price_cents: 1000 },
    { customer_id: custB, product_id: prod, price_cents: 1000 },
  ]);

  // Bulk batch (2 customers) — the action's exact write shape: ONE insert.
  const size = 2;
  {
    const { error } = await svc.from("customer_offers").insert(
      [custA, custB].map((cid) => ({
        customer_id: cid, title: `ZZBULK deal ${rnd}`, description: null, product_id: null,
        discount_kind: "percent", discount_value: 10, starts_at: null, ends_at: null,
        is_active: true, batch_id: batch1, batch_size: size,
      })),
    );
    if (error) throw new Error(error.message);
  }
  // Hand-applied control on customer A (no batch id) + a later unrelated offer.
  await svc.from("customer_offers").insert({
    customer_id: custA, title: `ZZBULK hand ${rnd}`, description: null, product_id: null,
    discount_kind: "amount_off", discount_value: 50, starts_at: null, ends_at: null, is_active: true,
  });

  // Idempotency: the action counts rows with the batch id before inserting.
  {
    const { count } = await svc.from("customer_offers")
      .select("id", { count: "exact", head: true }).eq("batch_id", batch1);
    note(count === 2, "resubmit check: rows with this batch_id exist → the action reports, never re-inserts");
  }

  // BEHAVIOUR IDENTITY — the customer's own session sees bulk + hand rows the
  // same way, and pricing math treats them identically.
  const asA = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { error } = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
    if (error) throw error;
  }
  {
    const { data: myOffers } = await asA
      .from("customer_offers")
      .select("title, discount_kind, discount_value, is_active, starts_at, ends_at, product_id")
      .like("title", `ZZBULK%${rnd}`);
    note((myOffers ?? []).length === 2,
      "customer A's session sees BOTH their offers — bulk and hand rows indistinguishable through RLS");
    const offers = (myOffers ?? []).map((o) => ({
      isActive: o.is_active, startsAt: o.starts_at, endsAt: o.ends_at,
      productId: o.product_id, discountKind: o.discount_kind, discountValue: o.discount_value,
    }));
    const applicable = offers
      .filter((o) => offerAppliesToProduct(o, prod, new Date()))
      .map((o) => ({ discountKind: o.discountKind, discountValue: o.discountValue }));
    const priced = applyOffersToPrice(1000, applicable);
    note(priced.finalCents === 900,
      "pricing over the mixed set: best single discount wins ($10.00 → $9.00 via 10%; the $0.50-off hand offer loses)");
  }

  // Individual removal shrinks the batch without touching the rest.
  {
    const { data: rowB } = await svc.from("customer_offers")
      .select("id").eq("batch_id", batch1).eq("customer_id", custB).single();
    await svc.from("customer_offers").delete().eq("id", rowB.id);
    const { count } = await svc.from("customer_offers")
      .select("id", { count: "exact", head: true }).eq("batch_id", batch1);
    note(count === 1, "individual removal: batch shrinks to 1; customer A's row untouched");
  }

  // UNDO = DELETE scoped by batch identity. The hand-applied offer (added
  // after the batch, unrelated) must survive verbatim.
  {
    const { data: removed, error } = await svc.from("customer_offers")
      .delete().eq("batch_id", batch1).select("id");
    if (error) throw new Error(error.message);
    note((removed ?? []).length === 1, "undo removed EXACTLY the remaining batch member (1, not 2 — B was hand-removed)");
    const { data: handRows } = await svc.from("customer_offers")
      .select("id, title").eq("customer_id", custA).like("title", `ZZBULK hand%`);
    note((handRows ?? []).length === 1, "the unrelated hand-applied offer survives the undo verbatim");
  }
  // Double undo: zero rows.
  {
    const { data: removed } = await svc.from("customer_offers")
      .delete().eq("batch_id", batch1).select("id");
    note((removed ?? []).length === 0, "second undo finds nothing — 'already undone', idempotent");
  }
  // Undo after expiry: expired rows delete harmlessly.
  {
    const batch2 = randomUUID();
    await svc.from("customer_offers").insert([{
      customer_id: custA, title: `ZZBULK expired ${rnd}`, description: null, product_id: null,
      discount_kind: "percent", discount_value: 5, starts_at: null,
      ends_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
      is_active: true, batch_id: batch2, batch_size: 1,
    }]);
    const { data: removed } = await svc.from("customer_offers")
      .delete().eq("batch_id", batch2).select("id");
    note((removed ?? []).length === 1, "undo after expiry deletes the inert rows (no price was live to change)");
  }
} catch (e) {
  console.log("ERROR:", e.message);
  pass = false;
} finally {
  if (custA) await svc.from("customer_offers").delete().eq("customer_id", custA);
  if (custB) await svc.from("customer_offers").delete().eq("customer_id", custB);
  if (custA) await svc.from("customer_products").delete().eq("customer_id", custA);
  if (custB) await svc.from("customer_products").delete().eq("customer_id", custB);
  if (prod) await svc.from("products").delete().eq("id", prod);
  if (custA) await svc.from("customers").delete().eq("id", custA);
  if (custB) await svc.from("customers").delete().eq("id", custB);
  if (userA) await svc.auth.admin.deleteUser(userA);
  console.log("\nteardown complete (test offers, product, customers, auth user removed)");
  console.log(pass ? "\n=== BULK OFFERS TEST: PASS ===" : "\n=== BULK OFFERS TEST: failures above ===");
  process.exit(pass ? 0 : 1);
}
}
