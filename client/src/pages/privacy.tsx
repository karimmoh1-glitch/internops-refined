import LegalPageLayout from "@/components/legal-page-layout";

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="August 2026">
      <p>
        This policy describes what information InternOps collects, how it's used, and the choices you have
        about it. It applies to everyone who uses InternOps — company admins, interns, and applicants.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information</strong>: name, email address, and a hashed password (we never store passwords in plain text) for admins and interns.</li>
        <li><strong>Application information</strong>: if you apply to a company's internship program, the information you submit — skills, why you're applying, and any links you provide (GitHub, LinkedIn, portfolio).</li>
        <li><strong>Work content</strong>: projects, plans, weekly logs, messages, and comments you create while using the product.</li>
        <li><strong>Device information</strong>: when you log in, we record a device identifier, browser, and platform so you can see and revoke your own active sessions from Settings.</li>
        <li><strong>Usage data</strong>: basic request logs (timestamps, endpoints, response codes) for debugging and security purposes.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Information is used to operate the product: authenticating you, running the application-review and
        project workflows, sending the transactional emails those workflows require (invites, application
        confirmations, plan reviews, password resets), and maintaining basic security logs.
      </p>
      <p>
        If a company's admin enables AI features, relevant project content is sent to OpenAI to generate plan
        suggestions or chat responses. We don't use your data to train models ourselves.
      </p>

      <h2>Third-party services</h2>
      <p>We rely on a small number of third-party services to operate InternOps:</p>
      <ul>
        <li><strong>Database hosting</strong> — stores all account and product data.</li>
        <li><strong>Resend</strong> — delivers transactional email (invites, confirmations, notifications, password resets).</li>
        <li><strong>OpenAI</strong> — powers optional AI plan-generation and chat features, when enabled.</li>
        <li><strong>GitHub</strong> — if a company connects a repository, we read commit and pull-request activity via GitHub's API using a token the company provides.</li>
      </ul>

      <h2>Data retention and deletion</h2>
      <p>
        We retain account and work data for as long as your account is active. To request deletion of your
        account and associated personal data, contact us (see Contact below) or ask your company's admin to
        remove you. Some records may be retained briefly for security or legal purposes even after deletion.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can review and revoke any device signed into your account from Settings → Devices.</li>
        <li>You can request a copy of your data or its deletion by contacting us.</li>
        <li>Company admins control whether their organization's public application page is open or closed.</li>
      </ul>

      <h2>Children's privacy</h2>
      <p>InternOps is not directed at children under 16, and we don't knowingly collect information from them.</p>

      <h2>Changes to this policy</h2>
      <p>We'll update the date at the top of this page when this policy changes. Material changes will be communicated to admins.</p>

      <h2>Contact</h2>
      <p>Questions about this policy or your data can be sent through our <a href="/contact" className="text-[#6D5EF5] hover:underline">contact page</a>.</p>
    </LegalPageLayout>
  );
}
