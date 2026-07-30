"use client";

// Admin-wide error boundary: production masks server error messages behind a
// digest, which made the 2026-07-30 500s undiagnosable from the browser. This
// keeps the admin usable (retry button) and SHOWS the digest so it can be
// matched to the exact line in the Vercel runtime logs.

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-display text-lg font-semibold text-red-900">
        Something went wrong on the server
      </h2>
      <p className="mt-2 text-sm text-red-800">
        Your last change may not have been saved. Retry — if it keeps failing,
        send the error code below to support so it can be matched to the server
        logs.
      </p>
      {error.digest && (
        <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 font-mono text-xs text-red-900">
          Error digest: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
      >
        Try again
      </button>
    </div>
  );
}
