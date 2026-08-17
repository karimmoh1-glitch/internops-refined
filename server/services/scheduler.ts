import cron from "node-cron";
import { runMorningDigestSweep } from "./morningDigest";
import { runAlumniAutoTransitionSweep } from "./alumniAutoTransition";

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

  // Every day (not just weekdays) — an end date passing on a Saturday
  // shouldn't wait until Monday to take effect. transitionUserToAlumni is
  // naturally idempotent here since candidates are filtered on alumniAt
  // being null, so a missed or re-run sweep can't double-transition.
  cron.schedule("0 14 * * *", () => {
    runAlumniAutoTransitionSweep().catch((error) => {
      console.error("Alumni auto-transition sweep failed:", error);
    });
  });
}
