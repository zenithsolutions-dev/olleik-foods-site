// Pure money formatter for the portal (the admin one lives in a "use client"
// module). Cents -> "$X.XX".
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
