// Runs the app's Next dev server against the LOCAL video database (devstack/stack.mjs), never the real project.
// Every key present in .env.local is overridden through process env (Next never replaces a variable that is already
// set), so no real URL or key can leak into this server. Stripe stays unset.
//   node videos/devstack/dev.mjs           dev server on port 3100 (from the project root)
//   node videos/devstack/dev.mjs build     production build with the local values inlined (NEXT_PUBLIC_* are baked in at build time)
//   node videos/devstack/dev.mjs start     production server on port 3100 (run build first); lighter and steadier than dev for long test runs
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const keys = JSON.parse(readFileSync(join(HERE, "_keys.json"), "utf8"));
export const DEMO_ADMIN = "admin@olleik-demo.test";

const env = { ...process.env };
// Blank out whatever .env.local defines, then set the local values.
const local = join(ROOT, ".env.local");
if (existsSync(local)) for (const m of readFileSync(local, "utf8").matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)) env[m[1]] = "";
Object.assign(env, {
  NEXT_PUBLIC_SUPABASE_URL: keys.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: keys.serviceKey,
  ADMIN_EMAILS: DEMO_ADMIN,
  NEXT_TELEMETRY_DISABLED: "1",
  // Fictional demo business details for the documents (brief V3.2 §10.1, Pending Review). Videos only: the
  // real registered details must still be entered before handover.
  ...(process.env.DEVSTACK_PLACEHOLDERS === "1"
    ? {} // QA: leave the BUSINESS_* variables unset so the placeholder state can be tested
    : {
        BUSINESS_LEGAL_NAME: "Olleik Foods Ltd.",
        BUSINESS_ADDRESS: "120 Market Street, Ottawa, ON K1A 0B1",
        BUSINESS_PHONE: "(613) 555-0142",
        BUSINESS_EMAIL: "orders@olleik-demo.test",
      }),
});
if (!env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http://127.0.0.1:")) throw new Error("refusing to start: the database URL is not the local stand-in");

const mode = process.argv[2] ?? "dev";
if (!["dev", "build", "start"].includes(mode)) throw new Error(`unknown mode ${mode}`);
const port = process.env.DEVSTACK_PORT ?? "3100"; // a second instance (e.g. the placeholder-details server on 3101) can run beside the first
const args = mode === "build" ? ["build"] : [mode, "-p", port];
const child = spawn(process.execPath, [join(ROOT, "node_modules", "next", "dist", "bin", "next"), ...args], { cwd: ROOT, env, stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
