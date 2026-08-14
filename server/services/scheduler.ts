import cron from "node-cron";
import { runMorningDigestSweep } from "./morningDigest";

// Weekdays only, at a single configurable UTC hour — per-company/per-user
// timezone scheduling is out of scope for v1. The unique constraint on
// digestRuns (userId, sentDate) is the real safety net against double
// sends, not an assumption that this process is the only instance running.
export function startScheduler(): void {
  const hour = parseInt(process.env.MORNING_DIGEST_HOUR_UTC || "13", 10);
  cron.schedule(`0 ${hour} * * 1-5`, () => {
    runMorningDigestSweep().catch((error) => {
      console.error("Morning digest sweep failed:", error);
    });
  });
}
