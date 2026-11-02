// Unit tests for duplicate detection (src/lib/duplicates/find-duplicate.ts).
// Run: node --experimental-strip-types scripts/test-duplicates.mjs
import assert from "node:assert/strict";
import { findDuplicate, normalizePhone, normalizeName, duplicateMessage } from "../src/lib/duplicates/find-duplicate.ts";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const cand = (o = {}) => ({ email: "new@example.com", phone: "6135550199", businessName: "Brand New Cafe", ...o });
const cust = (o = {}) => ({ email: "old@example.com", phone: "6135550100", businessName: "Old Pizza Co", source: "customer", ...o });

t("different email, phone and name → no duplicate", () => {
  assert.equal(findDuplicate(cand(), [cust()]), null);
});

t("same email in any letter case or with spaces → email duplicate", () => {
  const m = findDuplicate(cand({ email: "  OLD@Example.COM " }), [cust()]);
  assert.deepEqual(m, { field: "email", source: "customer" });
});

t("one-letter-different email is NOT a duplicate (ayamn vs ayman)", () => {
  assert.equal(findDuplicate(cand({ email: "ahmed123ayamn@gmail.com" }), [cust({ email: "ahmed123ayman@gmail.com" })]), null);
});

t("same phone in different formats → phone duplicate", () => {
  const m = findDuplicate(cand({ phone: "(613) 555-0100" }), [cust({ phone: "+1 613 555 0100" })]);
  assert.deepEqual(m, { field: "phone", source: "customer" });
  assert.equal(normalizePhone("01050677977"), normalizePhone("1050677977"));
});

t("short or empty phone never matches", () => {
  assert.equal(normalizePhone("123"), "");
  assert.equal(findDuplicate(cand({ phone: "12" }), [cust({ phone: "12" })]), null);
});

t("business name ignores case and extra spaces → name duplicate", () => {
  const m = findDuplicate(cand({ businessName: "  old   pizza  co " }), [cust()]);
  assert.deepEqual(m, { field: "businessName", source: "customer" });
  assert.equal(normalizeName("A  B"), "a b");
});

t("email wins over phone when both match the same row", () => {
  const m = findDuplicate(cand({ email: "old@example.com", phone: "6135550100" }), [cust()]);
  assert.equal(m.field, "email");
});

t("match against an open application says it is under review", () => {
  const m = findDuplicate(cand({ email: "old@example.com" }), [cust({ source: "lead" })]);
  assert.equal(m.source, "lead");
  assert.match(duplicateMessage(m), /already under review/);
});

t("customer match message asks for a different value", () => {
  assert.match(duplicateMessage({ field: "phone", source: "customer" }), /already registered.*different phone number/);
  assert.match(duplicateMessage({ field: "businessName", source: "customer" }), /different location/);
});

console.log(`\n${n} tests passed`);
