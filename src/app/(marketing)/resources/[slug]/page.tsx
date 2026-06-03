import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles, getArticle } from "@/lib/resources";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Resources | Olleik Foods" };
  return { title: `${a.title} | Olleik Foods`, description: a.metaDescription };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 pt-14 pb-24 md:pt-20">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent-deep transition hover:text-accent"
      >
        <span aria-hidden>←</span> Resources
      </Link>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.13em]">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-deep">{a.tag}</span>
        <span className="text-muted-soft">{a.readMins} min read</span>
      </div>

      <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.06] tracking-tight text-brand-deep sm:text-5xl">
        {a.title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">{a.excerpt}</p>

      <div className="mt-10 space-y-8 border-t border-[var(--border)] pt-10">
        {a.sections.map((s, i) => (
          <section key={i}>
            {s.heading && (
              <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
                {s.heading}
              </h2>
            )}
            {s.paragraphs.map((p, j) => (
              <p
                key={j}
                className={`text-[17px] leading-relaxed text-foreground/85 ${
                  s.heading ? "mt-3" : ""
                } ${j > 0 ? "mt-4" : ""}`}
              >
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-14 rounded-3xl border border-[var(--border)] bg-brand-mist/40 p-8 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-brand-deep">
          Want a supplier that works this way?
        </p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
          That&apos;s exactly how Olleik is built — personal service, transparent
          pricing, dependable delivery.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/apply"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            Open an account →
          </Link>
          <Link
            href="/who-we-serve"
            className="inline-flex h-12 items-center justify-center rounded-full border border-brand/20 bg-white px-7 text-sm font-semibold text-brand-deep transition hover:border-brand/40"
          >
            See who we serve
          </Link>
        </div>
      </div>
    </article>
  );
}
