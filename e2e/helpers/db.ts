import { readFileSync } from "node:fs";
import { join } from "node:path";

// Direct access to the LOCAL stand-in's REST API with the local service key, for test setup and assertions.
// Refuses to run against anything but 127.0.0.1.
const KEYS_PATH = join(process.cwd(), "videos", "devstack", "_keys.json");

export type DemoAccount = { email: string; password: string; id?: string };
export type Keys = {
  url: string;
  anonKey: string;
  serviceKey: string;
  demoAccounts: Record<string, DemoAccount>;
};

export function keys(): Keys {
  const k = JSON.parse(readFileSync(KEYS_PATH, "utf8")) as Keys;
  if (!k.url.startsWith("http://127.0.0.1:")) throw new Error("refusing: Supabase URL is not the local stand-in");
  return k;
}

export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const k = keys();
  const r = await fetch(`${k.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: k.serviceKey,
      authorization: `Bearer ${k.serviceKey}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const select = <T = Record<string, unknown>>(path: string) => rest<T[]>(path);
export const patch = (table: string, filter: string, body: object) =>
  rest(`${table}?${filter}`, { method: "PATCH", body: JSON.stringify(body) });
export const insert = <T = Record<string, unknown>>(table: string, body: object | object[]) =>
  rest<T[]>(table, { method: "POST", body: JSON.stringify(body) });
export const del = (table: string, filter: string) => rest(`${table}?${filter}`, { method: "DELETE" });
