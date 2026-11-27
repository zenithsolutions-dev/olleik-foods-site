// What a non-owner admin's browser receives: no cost, no profit, no margin. The server pages pass their
// data through these helpers before it reaches a client component.
//   node scripts/test-local.mjs cost-visibility
import {
  metaWithoutMargins,
  orderWithoutCosts,
  salesWithoutCosts,
  statsWithoutProfit,
} from "../src/lib/admin/cost-visibility.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};
// Distinctive figures: if any of them survives anywhere in the output, something leaked.
const SECRET = [71234, 81234, 91234, 37.5];
const leaks = (value) => SECRET.filter((n) => JSON.stringify(value).includes(String(n)));

const order = {
  id: "o1",
  totalCents: 5000,
  lines: [
    { productId: "p1", name: "Oil", qty: 2, unitPriceCents: 2500, lineTotalCents: 5000, costCents: 71234 },
    { productId: "p2", name: "Rice", qty: 1, unitPriceCents: 100, lineTotalCents: 100, costCents: null },
  ],
  totalCostCents: 81234,
  totalProfitCents: 91234,
  linesWithoutCost: 1,
};
const safeOrder = orderWithoutCosts(order);
check("order: no cost or profit figure survives", leaks(safeOrder).length === 0, leaks(safeOrder).join(","));
check("order: totals are null and the missing-cost count is zero", safeOrder.totalCostCents === null && safeOrder.totalProfitCents === null && safeOrder.linesWithoutCost === 0);
check("order: every line's cost is null", safeOrder.lines.every((l) => l.costCents === null));
check("order: prices and quantities are untouched", safeOrder.totalCents === 5000 && safeOrder.lines[0].qty === 2 && safeOrder.lines[0].unitPriceCents === 2500);
check("order: the original object is not modified", order.totalCostCents === 81234 && order.lines[0].costCents === 71234);

const sales = [{ productId: "p1", name: "Oil", sku: "O-1", units: 4, revenueCents: 10000, costCents: 71234, costedLines: 3, totalLines: 3 }];
const safeSales = salesWithoutCosts(sales);
check("sales: no cost figure survives", leaks(safeSales).length === 0);
check("sales: units and revenue are untouched", safeSales[0].units === 4 && safeSales[0].revenueCents === 10000);
check("sales: cost is null and no line counts as costed", safeSales[0].costCents === null && safeSales[0].costedLines === 0);

const stats = { periodLabel: "Today", revenueCents: 123, todayProfit: { profitCents: 91234, costedLines: 5, linesWithoutCost: 2 } };
const safeStats = statsWithoutProfit(stats);
check("dashboard: profit is gone, revenue stays", leaks(safeStats).length === 0 && safeStats.todayProfit.profitCents === null && safeStats.revenueCents === 123);

const meta = { p1: { priceSource: "rule", marginPercent: 37.5, ruleScope: "category", isPriority: true, computedAt: "2026-01-01T00:00:00Z" } };
const safeMeta = metaWithoutMargins(meta);
check("pricing meta: the margin percentage is gone", leaks(safeMeta).length === 0 && safeMeta.p1.marginPercent === null);
check("pricing meta: which rule priced it, and its priority flag, are gone", safeMeta.p1.ruleScope === null && safeMeta.p1.isPriority === false);
check("pricing meta: manual-vs-computed is kept (the screen needs it)", safeMeta.p1.priceSource === "rule");

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exitCode = failed ? 1 : 0;
