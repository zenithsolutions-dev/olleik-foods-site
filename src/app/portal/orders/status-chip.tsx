import type { OrderStatus } from "@/lib/portal/portal-data";

// Shared status chip for the portal order screens. Plain-language labels — the
// customer sees progress, not internal jargon.

const STYLES: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: "Received", cls: "bg-sky-100 text-sky-700" },
  confirmed: { label: "Confirmed", cls: "bg-brand/15 text-brand-deep" },
  prepared: { label: "Ready", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-500" },
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const s = STYLES[status] ?? STYLES.new;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
