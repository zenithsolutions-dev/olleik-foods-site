// Starts `next dev` on port 3210 with ADMIN_EMAILS overridden to the throwaway
// QA admin, so the real admin UI can be driven end to end against the project
// in .env.local without touching the production allowlist. Env vars already
// present in the process win over .env.local in Next, which is what we rely on.
import { spawn } from "node:child_process";
import { join } from "node:path";
const QA_ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || "qa-admin@olleik-foods.test";
const env = { ...process.env, ADMIN_EMAILS: QA_ADMIN_EMAIL };
const next = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-p", "3210"], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
