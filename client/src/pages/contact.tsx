import LegalPageLayout from "@/components/legal-page-layout";
import { Mail, Users } from "lucide-react";

export default function Contact() {
  return (
    <LegalPageLayout title="Contact" updated="August 2026">
      <p>
        If you're an intern or applicant with a question about a specific project, plan, or application, the
        fastest path is your company's admin — they manage your account directly and can see your full context.
      </p>

      <div className="not-prose grid sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <Users className="w-5 h-5 text-[#6D5EF5] mb-3" />
          <h3 className="text-white font-semibold text-sm mb-1">Questions about your account</h3>
          <p className="text-zinc-500 text-sm">Reach out to your company's admin — they can see your projects, applications, and plans directly.</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <Mail className="w-5 h-5 text-[#6D5EF5] mb-3" />
          <h3 className="text-white font-semibold text-sm mb-1">Everything else</h3>
          <p className="text-zinc-500 text-sm">
            Email{" "}
            <a href="mailto:karimamwa@gmail.com" className="text-[#6D5EF5] hover:underline">karimamwa@gmail.com</a>
          </p>
        </div>
      </div>
    </LegalPageLayout>
  );
}
