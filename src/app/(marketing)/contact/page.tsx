import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Olleik Foods — Ottawa Wholesale Food Supply",
  description:
    "Get in touch with Olleik Foods. Questions about wholesale accounts, delivery, pricing, or an existing order — reach our team in the Ottawa region.",
};

// Logs submissions for now (matches /apply and /suppliers). TODO Phase 2:
// persist to Supabase and/or notify the team by email.
async function submitContact(formData: FormData) {
  "use server";
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    business: formData.get("business"),
    topic: formData.get("topic"),
    message: formData.get("message"),
    receivedAt: new Date().toISOString(),
  };
  console.log("[contact] new submission", payload);
  redirect("/contact?sent=1");
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

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
            Contact
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Let&apos;s <em className="italic text-accent">talk</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Questions about opening an account, delivery in your area, or an
            existing order? Send a note and the right person will get back to
            you — usually within one business day.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          {/* Form */}
          <div>
            {sent ? (
              <div className="rounded-3xl border border-brand/30 bg-brand-mist/50 p-8 text-center">
                <span
                  aria-hidden
                  className="inline-grid h-11 w-11 place-items-center rounded-full bg-brand text-white"
                >
                  ✓
                </span>
                <h2 className="font-display mt-5 text-2xl font-semibold tracking-tight text-brand-deep">
                  Thanks — your message is on its way.
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                  We&apos;ll be in touch shortly. For anything urgent about an
                  active order, call us during business hours.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-brand/20 bg-white px-6 text-sm font-semibold text-brand-deep transition hover:border-brand/40"
                >
                  Send another message
                </Link>
              </div>
            ) : (
              <form
                action={submitContact}
                className="rounded-3xl border border-[var(--border)] bg-surface p-7 md:p-8"
              >
                <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
                  Send us a message
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Fields marked <span className="text-accent">*</span> are required.
                </p>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field label="Name" name="name" required />
                  <Field label="Business" name="business" />
                  <Field label="Email" name="email" type="email" required />
                  <Field label="Phone" name="phone" type="tel" />
                </div>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-brand-deep">
                    What&apos;s this about?
                  </span>
                  <select
                    name="topic"
                    defaultValue="New account"
                    className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none"
                  >
                    <option>New account</option>
                    <option>Delivery &amp; coverage</option>
                    <option>Pricing &amp; catalog</option>
                    <option>Existing order</option>
                    <option>Become a supplier</option>
                    <option>Something else</option>
                  </select>
                </label>

                <label className="mt-5 block">
                  <span className="text-sm font-medium text-brand-deep">
                    Message<span className="text-accent"> *</span>
                  </span>
                  <textarea
                    name="message"
                    rows={5}
                    required
                    placeholder="How can we help?"
                    className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-foreground placeholder-muted-soft focus:border-accent focus:outline-none"
                  />
                </label>

                <button
                  type="submit"
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep sm:w-auto"
                >
                  Send message
                  <span aria-hidden>→</span>
                </button>
              </form>
            )}
          </div>

          {/* Contact details */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-[var(--border)] bg-surface p-7">
              <h3 className="font-display text-lg font-semibold tracking-tight text-brand-deep">
                Get in touch
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                <li>
                  <span className="block text-xs uppercase tracking-[0.13em] text-muted-soft">
                    Email
                  </span>
                  <a
                    href="mailto:sales@olleikfoods.com"
                    className="font-medium text-accent-deep hover:text-accent"
                  >
                    sales@olleikfoods.com
                  </a>
                </li>
                <li>
                  <span className="block text-xs uppercase tracking-[0.13em] text-muted-soft">
                    Phone
                  </span>
                  <a
                    href="tel:+10000000000"
                    className="font-medium text-brand-deep hover:text-brand"
                  >
                    (000) 000-0000
                  </a>
                </li>
                <li>
                  <span className="block text-xs uppercase tracking-[0.13em] text-muted-soft">
                    Hours
                  </span>
                  Mon – Sat · 7am – 5pm
                </li>
                <li>
                  <span className="block text-xs uppercase tracking-[0.13em] text-muted-soft">
                    Region
                  </span>
                  Greater Ottawa area
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-brand/20 bg-brand-mist/40 p-7">
              <h3 className="font-display text-lg font-semibold tracking-tight text-brand-deep">
                Ready to order?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Skip the form — apply for a wholesale account and a rep will set
                up your catalog and pricing.
              </p>
              <Link
                href="/apply"
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                Open an account →
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-brand-deep">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-foreground placeholder-muted-soft focus:border-accent focus:outline-none"
      />
    </label>
  );
}
