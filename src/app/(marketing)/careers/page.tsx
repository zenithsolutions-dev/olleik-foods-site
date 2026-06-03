import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | Olleik Foods — Ottawa",
  description:
    "Join Olleik Foods. We hire drivers, warehouse and operations, and sales/account roles to keep wholesale food moving across the Ottawa region.",
};

/* TODO: when you have specific openings, list them here (title, type, location,
   link to apply). For now this page invites general applications by role area. */
const roleAreas = [
  {
    title: "Drivers & delivery",
    body: "Class-appropriate licensed drivers who take pride in on-time, careful deliveries and treat customers like partners.",
  },
  {
    title: "Warehouse & operations",
    body: "Receiving, picking, cold-storage, and quality roles — the people who keep product moving and on-spec.",
  },
  {
    title: "Sales & account management",
    body: "Reps who build real relationships with independent kitchens and own their customers' success.",
  },
  {
    title: "Office & support",
    body: "Purchasing, billing, and customer support roles that keep the whole operation running smoothly.",
  },
];

export default function CareersPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,_var(--accent-soft),_transparent_50%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Careers
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Help us feed the <em className="italic text-accent">region&apos;s</em> best kitchens.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            We&apos;re a growing wholesale food distributor in the Ottawa region,
            built on dependable people. If you take pride in doing the job right,
            we&apos;d like to meet you.
          </p>
        </div>
      </section>

      {/* Why work here */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Real ownership",
              body: "Small enough that your work matters and you're not a number — the way we treat customers is the way we treat our team.",
            },
            {
              title: "Steady & growing",
              body: "Food doesn't go out of season. We're adding routes and customers, which means room to grow.",
            },
            {
              title: "Local roots",
              body: "Based in the Ottawa region, serving the businesses around us. Short commutes, real community.",
            },
          ].map((v) => (
            <div
              key={v.title}
              className="rounded-3xl border border-[var(--border)] bg-surface p-7"
            >
              <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                {v.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Role areas */}
      <section className="bg-brand-mist/40 py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
              Where we hire
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-brand-deep sm:text-4xl">
              Roles across the operation.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {roleAreas.map((r) => (
              <div
                key={r.title}
                className="rounded-3xl border border-[var(--border)] bg-surface p-7"
              >
                <h3 className="font-display text-xl font-semibold tracking-tight text-brand-deep">
                  {r.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Apply */}
      <section className="px-6 py-20 md:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-brand-deep px-8 py-14 text-white shadow-[0_40px_80px_-30px_rgba(20,53,39,0.55)] md:px-16 md:py-16">
          <div className="absolute inset-0 grain" aria-hidden />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl">
                Don&apos;t see your role? Reach out anyway.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
                Send your resume and the kind of work you&apos;re looking for.
                We keep good people in mind as we grow.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="mailto:sales@olleikfoods.com?subject=Careers%20%E2%80%94%20Application"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Email your resume →
              </a>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
