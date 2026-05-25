import type { Metadata } from "next";
import ApplyForm from "./apply-form";

export const metadata: Metadata = {
  title: "Become a customer — Olleik Foods",
  description:
    "Apply to open a wholesale account with Olleik Foods. Approved restaurants and small businesses get personalized catalogs, pricing, and dedicated support.",
};

const perks = [
  "Personalized catalog tailored to what your kitchen orders",
  "Contract pricing locked in for the items that matter most",
  "Net-30 terms available for established accounts",
  "One dedicated rep — not a call center",
];

export default function ApplyPage() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_var(--brand-mist),_transparent_55%),radial-gradient(circle_at_95%_15%,_var(--accent-soft)_0%,_transparent_45%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            New customer application
          </p>
          <h1 className="font-display mt-4 text-5xl font-semibold leading-[1.02] tracking-tight text-brand-deep sm:text-6xl">
            Open a <em className="italic text-accent">wholesale</em> account.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Tell us a bit about your business. Applications are reviewed
            same-day during business hours, and your rep sets up your catalog
            within 24&nbsp;hours.
          </p>

          <ul className="mt-9 space-y-3.5">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-foreground">
                <span
                  aria-hidden
                  className="mt-0.5 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs text-white"
                >
                  ✓
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-[var(--border-strong)] bg-surface p-6 shadow-[0_30px_60px_-30px_rgba(20,53,39,0.25)] md:p-10">
            <ApplyForm />
          </div>
          <p className="mt-5 text-center text-xs text-muted">
            Already a customer?{" "}
            <a href="/login" className="font-semibold text-brand hover:underline">
              Sign in →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
