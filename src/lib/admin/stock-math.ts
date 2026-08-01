// CP-3e pure stock math — NO imports, NO IO. Used by the admin receive-stock
// action AND unit-tested directly from scripts/test-inventory.mjs (same
// pattern as the pricing engine), so what ships is what's tested.
//
// Two explicit operations exist on tracked stock (owner ruling, 2026-08-01):
//   RECEIVE — a shipment arrived: ADD to current stock. Settles a deficit:
//             -4 + 10 = 6 (4 owed units covered, 6 genuinely available).
//   SET COUNT — a physical recount: REPLACE current stock. Erases a deficit
//             deliberately, never by accident.

export type ReceiveSettlement = {
  newStock: number;
  // Units of the arriving shipment that covered an existing deficit (owed to
  // customers who already ordered them). 0 when stock wasn't negative.
  settledUnits: number;
  // Genuinely available after the receive (never negative).
  availableNow: number;
};

export function computeReceiveSettlement(oldStock: number, qty: number): ReceiveSettlement {
  const newStock = oldStock + qty;
  const deficit = oldStock < 0 ? -oldStock : 0;
  return {
    newStock,
    settledUnits: Math.min(deficit, qty),
    availableNow: Math.max(newStock, 0),
  };
}

// One open (confirmed/prepared) order's ledger movement on a product.
export type OpenMovementRow = {
  orderId: string;
  businessName: string;
  qty: number; // qty_decremented for this product
  decrementedAt: string; // orders.stock_decremented_at (ISO)
};

export type OversoldAttribution = {
  // True when the open orders' movements fully account for the deficit. A
  // deficit created (or enlarged) by manual set-counts or already-completed
  // orders cannot be attributed — in that case callers must show unit numbers
  // only and NOT invent attributions (owner ruling).
  reliable: boolean;
  orders: {
    orderId: string;
    businessName: string;
    // How many of this order's units were still uncovered before the receive.
    shortUnits: number;
    // True when only part of this order's line was uncovered.
    partiallyCovered: boolean;
  }[];
};

// Attribute a deficit to the open orders that are owed units. Stock is
// consumed first-confirmed-first-served, so the deficit belongs to the
// LAST-confirmed open orders: walk movements newest-first, assigning short
// units until the deficit is covered.
export function deriveOversoldOrders(
  rows: OpenMovementRow[],
  deficit: number,
): OversoldAttribution {
  if (deficit <= 0) return { reliable: true, orders: [] };
  const sorted = [...rows].sort(
    (a, b) => new Date(b.decrementedAt).getTime() - new Date(a.decrementedAt).getTime(),
  );
  let remaining = deficit;
  const orders: OversoldAttribution["orders"] = [];
  for (const r of sorted) {
    if (remaining <= 0) break;
    const short = Math.min(r.qty, remaining);
    orders.push({
      orderId: r.orderId,
      businessName: r.businessName,
      shortUnits: short,
      partiallyCovered: short < r.qty,
    });
    remaining -= short;
  }
  return { reliable: remaining <= 0, orders: remaining <= 0 ? orders : [] };
}
