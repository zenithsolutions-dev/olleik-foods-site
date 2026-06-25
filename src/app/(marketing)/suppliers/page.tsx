import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Become a Vendor | Supplier Partnerships — Olleik Foods",
  description:
    "Grow, produce, or distribute food in the Ottawa region? Partner with Olleik Foods. Submit your products and become part of our supplier network.",
};

// Logs submissions for now (matches /apply and /contact). TODO Phase 2: persist
// to Supabase and/or notify the team by email.
async function submitVendor(formData: FormData) {
  "use server";
  const payload = {
    company: String(formData.get("company") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    categories: String(formData.get("categories") ?? "").trim(),
    about: String(formData.get("about") ?? "").trim(),
  };

  const admin = getAdminClient();
  if (admin) {
    const { error } = await admin.from("vendor_submissions").insert(payload);
    if (error) {
      // Surface a real failure instead of a false success (see /apply).
      console.error("[vendor] supabase insert failed:", error.message);
      console.log("[vendor] new submission", payload);
      redirect("/suppliers?error=1");
    }
  } else {
    console.log("[vendor] new submission", payload);
  }

  redirect("/suppliers?sent=1");
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,_var(--brand-mist),_transparent_55%)]"
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-12 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-deep">
            Suppliers &amp; partners
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-brand-deep sm:text-5xl lg:text-6xl">
            Grow it, make it, or import it? <em className="italic text-accent">Let&apos;s talk.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            We&apos;re always looking for dependable growers, producers, and
            distributors — especially local. If your product belongs in great
            kitchens across the region, we want to hear about it.
          </p>
        </div>
      </section>

      {/* What we look for */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Consistent quality",
              body: "Product that meets spec, batch after batch, with the documentation to back it up.",
            },
            {
              title: "Reliable supply",
              body: "Volumes and lead times you can commit to, so we can commit to our customers.",
            },
            {
              title: "Local, where it fits",
              body: "We prioritize regional growers and producers whenever the season and the spec allow.",
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

      {/* Form */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        {sent ? (
          <div className="rounded-3xl border border-brand/30 bg-brand-mist/50 p-8 text-center">
            <span
              aria-hidden
              className="inline-grid h-11 w-11 place-items-center rounded-full bg-brand text-white"
            >
              ✓
            </span>
            <h2 className="font-display mt-5 text-2xl font-semibold tracking-tight text-brand-deep">
              Thanks — we&apos;ve got your submission.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Our purchasing team reviews new suppliers regularly and will be in
              touch if there&apos;s a fit.
            </p>
          </div>
        ) : (
          <form
            action={submitVendor}
            className="rounded-3xl border border-[var(--border)] bg-surface p-7 md:p-8"
          >
            {error && (
              <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                Sorry — we couldn&apos;t submit your details just now. Please try
                again, or email us at sales@olleikfoods.com.
              </p>
            )}
            <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
              Submit your products
            </h2>
            <p className="mt-2 text-sm text-muted">
              Tell us a little about what you offer. Fields marked
              <span className="text-accent"> *</span> are required.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Company" name="company" required />
              <Field label="Contact name" name="contact" required />
              <Field label="Email" name="email" type="email" required />
              <Field label="Phone" name="phone" type="tel" />
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-brand-deep">
                Product categories
              </span>
              <input
                name="categories"
                placeholder="e.g. produce, dairy, dry goods, packaging"
                className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-foreground placeholder-muted-soft focus:border-accent focus:outline-none"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-brand-deep">
                About your product<span className="text-accent"> *</span>
              </span>
              <textarea
                name="about"
                rows={5}
                required
                placeholder="What do you supply, where are you based, and what volumes can you support?"
                className="mt-2 w-full rounded-xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-foreground placeholder-muted-soft focus:border-accent focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep sm:w-auto"
            >
              Submit for review
              <span aria-hidden>→</span>
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Prefer email? Reach our purchasing team at{" "}
          <a
            href="mailto:sales@olleikfoods.com"
            className="font-semibold text-accent-deep hover:text-accent"
          >
            sales@olleikfoods.com
          </a>
          .
        </p>
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
