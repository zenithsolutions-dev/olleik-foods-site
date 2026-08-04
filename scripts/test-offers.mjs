// CP-8a offer-visibility test — proves the new views can never lie:
//   1. AGREEMENT: the "Running now" grouping derives from the SAME
//      offerIsActiveNow the pricing engine uses (imported, not re-implemented),
//      so an offer is "live" on the overview iff it can affect a price.
//   2. GROUPING: ending-soon / running / open-ended / scheduled /
//      recently-ended buckets are exclusive and correct at their boundaries.
//   3. ONE expiry definition: the dashboard's 72h flag and the overview's
//      7-day bucket are two thresholds over the one offerEndsWithin.
//   4. APPLY EFFECT: the confirmation math (count/average/example) matches
//      hand-computed figures, and a no-op apply reports zero affected.
//   5. READ-ONLY: pricing outputs are untouched — applyOffersToPrice results
//      for a fixed scenario are byte-identical to the CP-2-era expectations.
//
//   node --experimental-strip-types scripts/test-offers.mjs   (npm run test:offers)
import {
  buildOffersOverview,
  offerEndsWithin,
  summarizeApplyEffect,
  EXPIRING_SOON_HOURS,
  EXPIRY_BUCKET_DAYS,
  RECENTLY_ENDED_DAYS,
} from "../src/lib/admin/offers-overview.ts";
import {
  applyOffersToPrice,
  offerAppliesToProduct,
  offerIsActiveNow,
} from "../src/lib/pricing.ts";

let pass = true;
const note = (ok, msg) => {
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${msg}`);
};

const NOW = new Date("2026-08-03T12:00:00Z");
const hours = (n) => new Date(NOW.getTime() + n * 3600_000).toISOString();

const offer = (over = {}) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  customerId: "c-1",
  customerName: "Milano Pizzeria",
  title: "Test offer",
  productId: null,
  productLabel: null,
  discountKind: "percent",
  discountValue: 10,
  isActive: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

// ---------- 1+2. grouping vs the pricing rule ----------
console.log("--- overview grouping agrees with offerIsActiveNow ---");
{
  const soon = offer({ id: "soon", endsAt: hours(24) }); // ends tomorrow
  const edge7 = offer({ id: "edge7", endsAt: hours(EXPIRY_BUCKET_DAYS * 24) }); // exactly 7d
  const later = offer({ id: "later", endsAt: hours(EXPIRY_BUCKET_DAYS * 24 + 1) }); // just past 7d
  const open = offer({ id: "open" });
  const sched = offer({ id: "sched", startsAt: hours(48), endsAt: hours(200) });
  const ended = offer({ id: "ended", endsAt: hours(-24) }); // ended yesterday
  const ancient = offer({ id: "ancient", endsAt: hours(-(RECENTLY_ENDED_DAYS * 24 + 1)) });
  const off = offer({ id: "off", isActive: false });

  const all = [soon, edge7, later, open, sched, ended, ancient, off];
  const ov = buildOffersOverview(all, NOW);

  note(
    ov.endingSoon.map((o) => o.id).sort().join(",") === "edge7,soon",
    "ending-soon = live offers ending within 7 days (the exact-boundary offer included)",
  );
  note(ov.runningLater.length === 1 && ov.runningLater[0].id === "later",
    "running-later = live with an end just past the bucket");
  note(ov.openEnded.length === 1 && ov.openEnded[0].id === "open",
    "open-ended = live with no end date");
  note(ov.scheduled.length === 1 && ov.scheduled[0].id === "sched",
    "scheduled = active flag but starts in the future (not live)");
  note(ov.recentlyEnded.length === 1 && ov.recentlyEnded[0].id === "ended",
    "recently-ended = within 14 days only; older expiries age out; deactivated-with-no-end excluded");
  note(ov.liveCount === 4, "liveCount = soon + edge + later + open (4)");

  // THE agreement invariant: overview-live === pricing-live, for every offer.
  const overviewLive = new Set([...ov.endingSoon, ...ov.runningLater, ...ov.openEnded].map((o) => o.id));
  const pricingLive = new Set(all.filter((o) => offerIsActiveNow(o, NOW)).map((o) => o.id));
  note(
    overviewLive.size === pricingLive.size && [...overviewLive].every((id) => pricingLive.has(id)),
    "AGREEMENT: the overview's live set is exactly the pricing engine's live set",
  );

  const empty = buildOffersOverview([], NOW);
  note(
    empty.liveCount === 0 && empty.endingSoon.length === 0 && empty.recentlyEnded.length === 0,
    "empty input → empty overview (designed empty state upstream)",
  );
}

// ---------- 3. one expiry definition ----------
console.log("\n--- one time-to-expiry function, two thresholds ---");
{
  const at71h = { endsAt: hours(71) };
  const at73h = { endsAt: hours(73) };
  note(
    offerEndsWithin(at71h, NOW, EXPIRING_SOON_HOURS) && !offerEndsWithin(at73h, NOW, EXPIRING_SOON_HOURS),
    "72h dashboard flag: 71h in, 73h out — same helper the overview uses",
  );
  note(
    offerEndsWithin(at73h, NOW, EXPIRY_BUCKET_DAYS * 24),
    "the same 73h offer IS within the overview's 7-day bucket (thresholds differ, function doesn't)",
  );
  note(!offerEndsWithin({ endsAt: null }, NOW, 9999), "no end date is never 'expiring'");
  note(!offerEndsWithin({ endsAt: hours(-1) }, NOW, 9999), "already-ended is never 'expiring'");
}

// ---------- 4. apply-effect summary ----------
console.log("\n--- talking confirmation math ---");
{
  const fx = summarizeApplyEffect(
    [
      { name: "Feta", beforeCents: 1000, afterCents: 900 }, // -10%
      { name: "Olives", beforeCents: 2000, afterCents: 1600 }, // -20% (biggest)
      { name: "Halloumi", beforeCents: 500, afterCents: 500 }, // untouched
    ],
    "2026-08-31T00:00:00Z",
  );
  note(fx.affectedCount === 2 && fx.totalProducts === 3, "2 of 3 products affected");
  note(fx.example?.name === "Olives", "the example is the biggest drop");
  note(Math.abs(fx.averageDropPct - 15) < 0.001, "average drop = mean of per-product drops (15%)");

  const noop = summarizeApplyEffect(
    [{ name: "Feta", beforeCents: 900, afterCents: 900 }],
    null,
  );
  note(
    noop.affectedCount === 0 && noop.example === null && noop.averageDropPct === null,
    "an apply that lowers nothing reports ZERO affected — never a false success story",
  );
}

// ---------- 5. read-only: pricing untouched ----------
console.log("\n--- pricing outputs unchanged (visibility, not math) ---");
{
  const offers = [
    { title: "10% off", discountKind: "percent", discountValue: 10 },
    { title: "$3 off", discountKind: "amount_off", discountValue: 300 },
  ];
  const r = applyOffersToPrice(1000, offers);
  note(
    r.finalCents === 700 && r.appliedOffer?.title === "$3 off" && r.originalCents === 1000,
    "applyOffersToPrice: best single discount wins, never compounded ($10.00 → $7.00)",
  );
  const scoped = offerAppliesToProduct(
    { isActive: true, startsAt: null, endsAt: null, productId: "p-1", discountKind: "percent", discountValue: 10 },
    "p-2",
    NOW,
  );
  note(scoped === false, "product-scoped offer still never leaks to another product");
  note(
    offerAppliesToProduct(
      { isActive: true, startsAt: null, endsAt: null, productId: null, discountKind: null, discountValue: null },
      "p-1",
      NOW,
    ) === false,
    "announcement-only offer (no discount) still can never affect a price",
  );
}

console.log(pass ? "\n=== OFFERS TEST: PASS ===" : "\n=== OFFERS TEST: failures above ===");
process.exit(pass ? 0 : 1);
