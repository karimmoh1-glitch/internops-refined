import { Link } from "wouter";
import { PublicShell, PublicHeader, LegalArticle } from "@/components/public/PublicShell";

export default function Terms() {
  return (
    <PublicShell width="narrow">
      <PublicHeader eyebrow="Legal" title="Terms of Service" />
      <LegalArticle updated="September 2026">
        <p>
          These terms govern your use of InternOps. By creating an account, accepting an invitation, applying through a
          public application page, or otherwise using InternOps, you agree to them. InternOps runs as a single workspace
          operated by the operator of this deployment.
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for the accuracy of the information you provide and for keeping your password private.
          Managers are responsible for the interns, invitations, and applications they handle within the workspace.
          Accounts created by sign-up are reviewed by a manager before they become active.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Submit false or misleading applications, or impersonate someone else.</li>
          <li>Attempt to access another person's account or data without authorization.</li>
          <li>Interfere with or disrupt the service, including by automating the sign-up, invitation, or application endpoints.</li>
          <li>Tamper with the Companion or the activity it reports, or run it under someone else's account.</li>
          <li>Use InternOps for any unlawful purpose.</li>
        </ul>

        <h2>Work Mode</h2>
        <p>
          The Companion observes activity only while Work Mode is on, as described in the <Link href="/privacy">privacy policy</Link>.
          You decide when to start and end a shift. Shift reports describe what was observed; they are not a judgement of
          your work, and managers are expected to read them in that light.
        </p>

        <h2>Ownership of data</h2>
        <p>
          The workspace owns the tasks, projects, applications, and work data created within it. InternOps stores and
          processes that data on the workspace's behalf. You keep ownership of content you create and grant the
          workspace the right to use it for running the internship.
        </p>

        <h2>Pulse and AI features</h2>
        <p>
          Where enabled, answers and summaries produced by Pulse are generated from workspace data and are a starting point,
          not a guarantee of accuracy. Review AI-generated content before relying on it.
        </p>

        <h2>Availability</h2>
        <p>
          The operator aims to keep this workspace available and reliable but does not guarantee uninterrupted access.
          Maintenance may be required from time to time.
        </p>

        <h2>Termination</h2>
        <p>
          You may stop using InternOps at any time. The operator may suspend or deactivate accounts that violate these
          terms, including abuse of the public application or sign-up flows or attempts to access data without
          authorization.
        </p>

        <h2>Disclaimers and limitation of liability</h2>
        <p>
          InternOps is provided "as is" without warranties of any kind. To the extent permitted by law, the operator is
          not liable for indirect, incidental, or consequential damages arising from your use of the product.
        </p>

        <h2>Changes</h2>
        <p>The date at the top of this page is updated when these terms change. Continued use after a change means you accept the updated terms.</p>

        <h2>Contact</h2>
        <p>Questions about these terms can be sent through the <Link href="/contact">contact page</Link>.</p>
      </LegalArticle>
    </PublicShell>
  );
}
