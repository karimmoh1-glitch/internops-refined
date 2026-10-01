import { Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicShell, PublicHeader } from "@/components/public/PublicShell";

// Set VITE_CONTACT_EMAIL at build time to show the operator's address.
const CONTACT_EMAIL: string | undefined = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || undefined;

export default function Contact() {
  return (
    <PublicShell width="narrow">
      <PublicHeader
        title="Contact"
        description="InternOps runs as a single workspace. Most questions are answered fastest by the people who run yours."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent"><Users className="h-4 w-4" /></div>
          <h2 className="t-section">Your account, tasks, or application</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
            Ask a manager in your workspace. They can see your tasks, projects, shifts, and application directly, and they approve account requests.
          </p>
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-ink-2"><Mail className="h-4 w-4" /></div>
          <h2 className="t-section">The operator of this deployment</h2>
          {CONTACT_EMAIL ? (
            <>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">For privacy requests, data deletion, or anything about how this workspace is run.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href={`mailto:${CONTACT_EMAIL}`}><Mail />{CONTACT_EMAIL}</a>
              </Button>
            </>
          ) : (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
              No contact address has been configured for this deployment. For privacy requests or data deletion, contact your workspace manager, who can reach the operator.
            </p>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
