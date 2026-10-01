import { Link } from "wouter";
import { PublicShell, PublicHeader, LegalArticle } from "@/components/public/PublicShell";

export default function Privacy() {
  return (
    <PublicShell width="narrow">
      <PublicHeader eyebrow="Legal" title="Privacy Policy" />
      <LegalArticle updated="September 2026">
        <p>
          This policy explains what information InternOps stores, how it is used, and the choices you have. It applies to
          everyone who uses this workspace: managers, interns, and applicants. InternOps runs as a single workspace, and
          the data in it is processed by the operator of this deployment, on the operator's infrastructure.
        </p>

        <h2>What we store</h2>
        <ul>
          <li><strong>Account information</strong>: your name, email address, and a hashed password. Passwords are never stored in plain text.</li>
          <li><strong>Application information</strong>: if you apply through a public application page, the details you submit, including skills, motivation, and any links you provide (GitHub, LinkedIn, portfolio).</li>
          <li><strong>Work content</strong>: tasks, projects, plans, submissions, comments, and messages you create in the product.</li>
          <li><strong>Devices</strong>: when you log in, a record of the device, browser, and platform, so you can see and revoke your own sessions from Settings.</li>
          <li><strong>Request logs</strong>: basic server logs (timestamps, endpoints, response codes) kept for debugging and security.</li>
        </ul>

        <h2>Work Mode and the Companion</h2>
        <p>
          The InternOps Companion is an optional desktop app. It has two states, and the boundary between them is enforced
          by the server, not only by the app's interface.
        </p>
        <ul>
          <li>
            <strong>Work Mode off: nothing is observed.</strong> Before you start a shift, and as soon as you end one, the
            Companion records and sends nothing. The server rejects any activity that is not tied to a shift you currently
            have open.
          </li>
          <li>
            <strong>Work Mode on: only these signals.</strong> The foreground application name, the window title, the
            document or file name when the application exposes it, the browser hostname only, idle seconds, and
            timestamps. Where something cannot be determined, it is recorded as unknown rather than guessed.
          </li>
          <li>
            <strong>Never, in any state:</strong> keystrokes, clipboard contents, screenshots or screen recordings, message
            content, or full URLs.
          </li>
          <li>
            Observed activity is shown to you and to the managers of this workspace through shift reports and Workday
            Replay. Reports distinguish what was observed from what is inferred, and gaps are shown as unknown.
          </li>
          <li>
            Using the Companion is optional. Work Mode can be run from the web app alone, which records only the start
            and end of the shift.
          </li>
        </ul>

        <h2>How information is used</h2>
        <p>
          To operate the product: authenticating you, running the application review, task, and project workflows,
          sending the transactional emails those workflows need (invitations, confirmations, reviews, password resets),
          and keeping basic security logs.
        </p>
        <p>
          If the operator enables Pulse, the workspace's AI assistant, relevant task, project, and shift data is sent to
          OpenAI to generate answers and summaries. Your data is not used by InternOps to train models.
        </p>

        <h2>Third-party services</h2>
        <p>The operator relies on a small number of services to run this workspace:</p>
        <ul>
          <li><strong>Database hosting</strong>: stores account and product data.</li>
          <li><strong>Resend</strong>: delivers transactional email.</li>
          <li><strong>OpenAI</strong>: powers Pulse when the operator has configured it.</li>
          <li><strong>GitHub</strong>: if the workspace connects a repository, commit and pull request activity is read through GitHub's API using a token the workspace provides. Companion releases are also hosted on GitHub.</li>
        </ul>

        <h2>Retention and deletion</h2>
        <p>
          Account and work data is kept while your account is active. To request deletion of your account and the personal
          data tied to it, contact the operator (see <Link href="/contact">Contact</Link>) or ask a manager in your
          workspace to remove you. Some records may be kept briefly afterwards for security or legal reasons.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Review and revoke any device signed in to your account from Settings.</li>
          <li>Choose whether to install the Companion at all, and start or end Work Mode yourself.</li>
          <li>Turn your public profile on or off from Settings. When it is off, the page disappears immediately.</li>
          <li>Request a copy of your data, or its deletion, by contacting the operator.</li>
        </ul>

        <h2>Children</h2>
        <p>InternOps is not directed at children under 16, and the operator does not knowingly collect information from them.</p>

        <h2>Changes</h2>
        <p>The date at the top of this page is updated when the policy changes. Material changes are communicated to workspace managers.</p>

        <h2>Contact</h2>
        <p>Questions about this policy or your data can be sent through the <Link href="/contact">contact page</Link>.</p>
      </LegalArticle>
    </PublicShell>
  );
}
