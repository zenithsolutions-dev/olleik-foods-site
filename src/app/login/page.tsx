import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Customer login — Olleik Foods",
};

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-brand-deep">
        Customer login
      </h1>
      <p className="mt-4 text-muted">
        The customer portal is being set up. Existing customers will receive
        their login details from their rep once the portal goes live.
      </p>
      <p className="mt-6 text-sm text-muted">
        Not a customer yet?{" "}
        <Link href="/apply" className="font-semibold text-brand hover:underline">
          Apply for an account →
        </Link>
      </p>
    </section>
  );
}
