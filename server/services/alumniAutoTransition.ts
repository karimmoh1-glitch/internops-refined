import { storage } from "../storage";

// Daily sweep: any active intern whose admin-set expectedEndDate has
// passed gets automatically transitioned to alumni, using that recorded
// date (not "now") as the snapshot's internshipEndedAt — see the comment
// on storage.transitionUserToAlumni for why. Mirrors morningDigest.ts's
// error-isolation pattern (one failure doesn't block the rest of the
// sweep), just per-intern instead of per-company since this is a single
// global query rather than a per-company loop.
export async function runAlumniAutoTransitionSweep(): Promise<void> {
  const candidates = await storage.getInternsWithPastExpectedEndDate();

  for (const intern of candidates) {
    try {
      const companyId = intern.companyId as string;
      const systemUser = await storage.getOrCreateSystemUser(companyId);
      await storage.transitionUserToAlumni(intern.id, systemUser.id, intern.expectedEndDate as Date);

      const admins = await storage.getAdminsByCompany(companyId);
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          title: "Intern Automatically Moved to Alumni",
          message: `${intern.name}'s end date passed, so they were automatically transitioned to alumni.`,
          read: false,
          link: "/alumni",
        });
      }
    } catch (error) {
      console.error(`Alumni auto-transition failed for intern ${intern.id}:`, error);
    }
  }
}
