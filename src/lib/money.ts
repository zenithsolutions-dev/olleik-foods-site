// The ONE money formatter: integer cents -> "$12.50", and "-$2.00" for a loss. (The old one-liners built
// `$${(cents / 100).toFixed(2)}`, which prints a negative profit as "$-2.00".) Pure, so server components, client
// components, documents and tests can all share it.
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
