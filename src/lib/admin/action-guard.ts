import "server-only";

// Last-line defense for admin server actions: NOTHING may escape as an
// unhandled 500 (production masks the message behind a digest, which made the
// 2026-07-30 incident undiagnosable from the browser). Every action body runs
// inside guardAction: known Postgres codes map to actionable messages, unknown
// throws log their name/code server-side (visible in Vercel runtime logs) and
// return a clear failure to the client. Values are never logged.
//
// requireAdmin() must be called BEFORE guardAction so its redirect (a thrown
// NEXT_REDIRECT control-flow signal) propagates to the framework untouched.

type Failure = { ok: false; message: string };

// Actionable messages for the Postgres codes our tables can realistically emit.
export function mapDbErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "23514":
      return "The database rejected this data (check constraint) — the schema may be out of date. Run scripts/test-schema-preflight.mjs, apply any missing migration, then retry.";
    case "23505":
      return "This already exists — edit the existing entry instead of creating a duplicate.";
    case "42703":
    case "42P01":
      return "The database schema is out of date (missing column/table) — run the latest migration, then retry.";
    case "23503":
      return "A referenced record no longer exists — refresh the page and retry.";
    default:
      return null;
  }
}

function isNextControlFlow(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (e as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}

export async function guardAction<T>(
  label: string,
  body: () => Promise<T>,
): Promise<T | Failure> {
  try {
    return await body();
  } catch (e) {
    if (isNextControlFlow(e)) throw e; // redirects/notFound belong to Next
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: unknown }).code)
        : undefined;
    const name = e instanceof Error ? e.name : typeof e;
    // Codes/names only — never data values.
    console.error(`[admin] action "${label}" threw:`, name, code ?? "");
    const mapped = mapDbErrorMessage(code);
    return {
      ok: false,
      message:
        mapped ??
        `Something went wrong saving this (${name}${code ? ` ${code}` : ""}). Nothing may have been saved — check the data and retry.`,
    };
  }
}
