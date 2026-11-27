import { timingSafeEqual } from "node:crypto";
import { runDailyReport } from "@/lib/email/notify";

// Called by the hosting scheduler (e.g. a Vercel Cron job, which sends "Authorization: Bearer <CRON_SECRET>").
// Safe to call as often as you like: the report goes out at most once per local day, from the hour chosen
// in Settings onward. Call it hourly for a precise send time; a once-a-day call still sends that day's report
// as long as it runs after the chosen hour.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runDailyReport());
}
