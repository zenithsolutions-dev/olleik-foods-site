import type { Metadata } from "next";
import ApplyForm from "./apply-form";

export const metadata: Metadata = {
  title: "Become a customer — Olleik Foods",
  description:
    "Apply to open a wholesale account with Olleik Foods. Approved restaurants and small businesses get personalized catalogs, pricing, and dedicated support.",
};

export default function ApplyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-deep">
          New customer application
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-brand-deep sm:text-5xl">
          Open a wholesale account.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Tell us a bit about your business. We review applications same-day
          during business hours and have a rep set up your catalog within
          24&nbsp;hours.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm md:p-10">
        <ApplyForm />
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Already a customer? <a href="/login" className="text-brand hover:underline">Log in</a> to place an order.
      </p>
    </section>
  );
}
