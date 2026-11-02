import { chromium, type FullConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keys } from "./helpers/db";

export const STATE_DIR = join(process.cwd(), "e2e", ".auth");

// 1. Re-seed the local database (idempotent: wipes demo data and rebuilds it) so every run starts identical.
// 2. Sign in once per role through the real login pages and keep the cookies as storage state.
export default async function globalSetup(config: FullConfig) {
  keys(); // throws unless the URL is the local stand-in
  const base = config.projects[0].use.baseURL ?? "http://localhost:3100";
  execFileSync(process.execPath, ["videos/devstack/seed.mjs"], { stdio: "inherit" });
  mkdirSync(STATE_DIR, { recursive: true });
  const { demoAccounts } = keys();

  const browser = await chromium.launch({ channel: "chrome" });
  const roles: [string, string, string][] = [
    ["admin", "/admin-login", "/admin"],
    ["copperleaf", "/login", "/portal"],
    ["ember", "/login", "/portal"],
    ["juniper", "/login", "/portal"],
  ];
  for (const [role, loginPath, landing] of roles) {
    const ctx = await browser.newContext({ baseURL: base });
    const page = await ctx.newPage();
    await page.goto(loginPath);
    await page.getByLabel(/^email$/i).fill(demoAccounts[role].email);
    await page.getByLabel(/^password$/i).fill(demoAccounts[role].password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => u.pathname === landing || u.pathname.startsWith(`${landing}/`), { timeout: 60_000 });
    const file = join(STATE_DIR, `${role}.json`);
    await ctx.storageState({ path: file });
    // Keep the cookies only. The portal writes an (empty) cart into localStorage right after login; if that were saved
    // here, every test would start with it and a test that seeds its own cart could race with it.
    const st = JSON.parse(readFileSync(file, "utf8"));
    st.origins = [];
    writeFileSync(file, JSON.stringify(st));
    await ctx.close();
  }
  await browser.close();
}
