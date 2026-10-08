// Runs the app's Next dev server against the LOCAL video database (devstack/stack.mjs), never the real project.
// Every key present in .env.local is overridden through process env (Next never replaces a variable that is already
// set), so no real URL or key can leak into this server. Stripe stays unset.
//   node videos/devstack/dev.mjs   (from the project root; port 3100)
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
});
if (!env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http://127.0.0.1:")) throw new Error("refusing to start: the database URL is not the local stand-in");

const child = spawn(process.execPath, [join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3100"], { cwd: ROOT, env, stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
