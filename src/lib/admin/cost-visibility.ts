// Cost, profit and margins are owner-only (see isOwner in ./auth). Server pages pass their data through
// these before handing it to a client component, so for a non-owner the figures never leave the server.
// Hiding a column in the browser is not enough: the data would still be in the page payload.
// Pure and dependency-free so the test suite can import it directly.

export function orderWithoutCosts<
  T extends {
    lines: Array<{ costCents: number | null }>;
    totalCostCents: number | null;
    totalProfitCents: number | null;
    linesWithoutCost: number;
  },
>(order: T): T {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line, costCents: null })),
    totalCostCents: null,
    totalProfitCents: null,
    linesWithoutCost: 0,
  };
}

export function salesWithoutCosts<T extends { costCents: number | null; costedLines: number }>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row, costCents: null, costedLines: 0 }));
}

export function statsWithoutProfit<
  T extends { todayProfit: { profitCents: number | null; costedLines: number; linesWithoutCost: number } },
>(stats: T): T {
  return { ...stats, todayProfit: { profitCents: null, costedLines: 0, linesWithoutCost: 0 } };
}

// Keeps priceSource (manual vs computed drives the screen). Drops the margin that produced the price and
// which rule it came from: the tier and priority flag alone reveal where margin rules exist.
export function metaWithoutMargins<
  T extends { marginPercent: number | null; ruleScope: unknown; isPriority: boolean },
>(meta: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(meta).map(([id, m]) => [id, { ...m, marginPercent: null, ruleScope: null, isPriority: false }]),
  );
}
