import type { Express, Request, Response, NextFunction } from "express";
import { runMorningDigestSweep } from "../services/morningDigest";
import { runAlumniAutoTransitionSweep } from "../services/alumniAutoTransition";
import { sweepAbandonedShifts } from "../services/workSessions";

// Scheduled work as HTTP endpoints, for hosts without a long-lived process
// (Vercel Cron calls these with "Authorization: Bearer $CRON_SECRET").
// Every sweep is idempotent, so a duplicate call is harmless.
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ message: "CRON_SECRET is not configured" });
  const header = req.headers.authorization || "";
  if (header !== `Bearer ${secret}`) return res.status(401).json({ message: "Unauthorized" });
  next();
}

export function registerCronRoutes(app: Express) {
  app.get("/api/cron/morning-digest", requireCronSecret, async (_req, res) => {
    try { await runMorningDigestSweep(); res.json({ ok: true }); }
    catch (err) { console.error("cron morning-digest failed:", err); res.status(500).json({ ok: false }); }
  });
  app.get("/api/cron/alumni", requireCronSecret, async (_req, res) => {
    try { await runAlumniAutoTransitionSweep(); res.json({ ok: true }); }
    catch (err) { console.error("cron alumni failed:", err); res.status(500).json({ ok: false }); }
  });
  app.get("/api/cron/shifts", requireCronSecret, async (_req, res) => {
    try { const closed = await sweepAbandonedShifts(); res.json({ ok: true, closed }); }
    catch (err) { console.error("cron shifts failed:", err); res.status(500).json({ ok: false }); }
  });
}

// On serverless hosts the 10-minute sweep can't run on a timer, so it also
// runs lazily: at most once per LAZY_SWEEP_MS per warm instance, triggered
// from the requests that care about live sessions.
const LAZY_SWEEP_MS = 10 * 60_000;
let lastLazySweep = 0;
export function lazyShiftSweep(): void {
  const now = Date.now();
  if (now - lastLazySweep < LAZY_SWEEP_MS) return;
  lastLazySweep = now;
  sweepAbandonedShifts().catch((err) => console.error("lazy shift sweep failed:", err));
}
