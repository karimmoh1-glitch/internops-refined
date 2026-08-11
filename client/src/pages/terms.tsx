import LegalPageLayout from "@/components/legal-page-layout";

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" updated="August 2026">
      <p>
        These terms govern your use of InternOps. By creating an account or using InternOps, you agree to them.
        If you're using InternOps on behalf of a company, you're agreeing on that company's behalf.
      </p>

      <h2>Accounts</h2>
      <p>
        You're responsible for the accuracy of the information you provide and for keeping your password secure.
        Admins are responsible for the interns and applications they manage within their organization.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use InternOps to submit false or misleading applications, or impersonate someone else.</li>
        <li>Attempt to access another organization's data, or another user's account, without authorization.</li>
        <li>Interfere with or disrupt the service, including through automated abuse of the public application or signup endpoints.</li>
        <li>Use InternOps for any unlawful purpose.</li>
      </ul>

      <h2>Company data ownership</h2>
      <p>
        Each company owns the project, application, and work data created within its organization. InternOps
        acts as the platform that stores and processes it on the company's behalf.
      </p>

      <h2>AI features</h2>
      <p>
        Where enabled, AI-generated plans and suggestions are a starting point, not a guarantee of accuracy or
        suitability. Admins and interns should review AI-generated content before relying on it.
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep InternOps available and reliable but don't guarantee uninterrupted access. We may need
        to perform maintenance, and we'll try to minimize disruption when we do.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using InternOps at any time. We may suspend or terminate accounts that violate these terms,
        including abuse of the public application system or attempts to access data without authorization.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        InternOps is provided "as is" without warranties of any kind. To the maximum extent permitted by law,
        InternOps is not liable for indirect, incidental, or consequential damages arising from your use of the
        product.
      </p>

      <h2>Changes to these terms</h2>
      <p>We'll update the date at the top of this page when these terms change. Continued use after a change means you accept the updated terms.</p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent through our <a href="/contact" className="text-[#EF7878] hover:underline">contact page</a>.</p>
    </LegalPageLayout>
  );
}
