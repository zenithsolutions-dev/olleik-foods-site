import { test as base, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { join } from "node:path";

export { expect };
export const authFile = (role: string) => join(process.cwd(), "e2e", ".auth", `${role}.json`);

// Findings that are not failures by themselves. Anything else seen during a test fails it.
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  // Negative tests (auth guards, bad input) report their own status; the console line is just the browser echo.
  /Failed to load resource: the server responded with a status of 40[0134]/,
];
const IGNORED_REQUEST_FAIL = [/_next\/static\/.*\.hot-update/, /\/__nextjs_/];

export type Issues = {
  console: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

export function watch(page: Page): Issues {
  const issues: Issues = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (IGNORED_CONSOLE.some((re) => re.test(t))) return;
    issues.console.push(`[${m.type()}] ${t.slice(0, 300)} @ ${m.location().url}`);
  });
  page.on("pageerror", (e) => issues.pageErrors.push(String(e).slice(0, 300)));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (IGNORED_REQUEST_FAIL.some((re) => re.test(u))) return;
    const why = r.failure()?.errorText ?? "";
    if (/ERR_ABORTED/.test(why)) return; // navigations / cancelled prefetches
    issues.failedRequests.push(`${r.method()} ${u.slice(0, 160)} ${why}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) issues.badResponses.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`);
  });
  return issues;
}

const EMPTY: Issues = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };

// Every test gets an `issues` fixture that is asserted empty at the end (soft, so the test body still reports its own failures).
export const test = base.extend<{ issues: Issues }>({
  issues: [
    async ({ page }, use) => {
      const issues = watch(page);
      await use(issues);
      expect.soft(issues, "console errors / page errors / failed or 5xx requests").toEqual(EMPTY);
    },
    { auto: true },
  ],
});

/** Layout / accessibility checks that apply to every page. */
export async function pageProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`horizontal overflow: scrollWidth ${de.scrollWidth} > ${de.clientWidth}`);
    for (const img of Array.from(document.images)) {
      if (img.complete && img.naturalWidth === 0) out.push(`broken image: ${img.currentSrc || img.src}`);
      if (!img.hasAttribute("alt")) out.push(`image without alt: ${img.currentSrc || img.src}`);
    }
    for (const el of Array.from(document.querySelectorAll("input:not([type=hidden]),select,textarea"))) {
      const e = el as HTMLInputElement;
      const labelled = e.labels?.length || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title");
      if (!labelled) out.push(`unlabelled <${e.tagName.toLowerCase()}${e.type ? ` type=${e.type}` : ""}> name/placeholder=${e.name || e.placeholder || ""}`);
    }
    for (const b of Array.from(document.querySelectorAll("button,a[href]"))) {
      const e = b as HTMLElement;
      const name =
        (e.innerText || "").trim() ||
        e.getAttribute("aria-label") ||
        e.getAttribute("title") ||
        e.querySelector("img[alt]")?.getAttribute("alt");
      if (!name) out.push(`unnamed ${e.tagName.toLowerCase()}: ${e.outerHTML.slice(0, 100)}`);
    }
    // Content cut off by an ancestor with overflow:hidden (the page itself does not scroll, so the overflow check
    // above misses it): a table or control that is partly outside the viewport and not inside a scroll container.
    const vw = de.clientWidth;
    const cut: string[] = [];
    for (const el of Array.from(document.querySelectorAll("table,th,td,button,input,select,a[href],label,h1,h2,h3"))) {
      if ((el as HTMLElement).closest("[aria-hidden=true]")) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || b.right <= vw + 1) continue;
      let a: HTMLElement | null = el.parentElement;
      let verdict: "scroll" | "clipped" | "free" = "free";
      while (a && a !== document.body) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "auto" || ox === "scroll") { verdict = "scroll"; break; }
        if (ox === "hidden" || ox === "clip") { verdict = "clipped"; break; }
        a = a.parentElement;
      }
      if (verdict === "clipped") cut.push(`${el.tagName.toLowerCase()} cut off by overflow:hidden: "${((el as HTMLElement).innerText || "").trim().slice(0, 40)}"`);
    }
    out.push(...cut.slice(0, 5));
    return out;
  });
}
