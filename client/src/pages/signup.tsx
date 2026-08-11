import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/api-error";
import { Link } from "wouter";
import { Mail, ArrowLeft, Shield, CheckCircle2 } from "lucide-react";
import LogoMark from "@/components/logo-mark";

export default function Signup() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async () => {
    if (!companyName.trim() || !email.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Signup failed"));
      setEmailSent(true);
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#EF7878]/50 focus-visible:border-[#EF7878]/50";

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col">
        <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline">
              <LogoMark size={32} />
              InternOps
            </Link>
          </div>
        </nav>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold font-heading text-white mb-3" data-testid="text-check-email">
              Check Your Email
            </h1>
            <p className="text-zinc-400 mb-2">
              We've sent a verification link to
            </p>
            <p className="text-white font-medium text-lg mb-6">{email}</p>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 text-left space-y-3">
              <p className="text-zinc-400 text-sm">Click the link in the email to:</p>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#EF7878] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                <p className="text-zinc-300 text-sm">Set your manager name</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#EF7878] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                <p className="text-zinc-300 text-sm">Create a secure password</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-[#EF7878] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                <p className="text-zinc-300 text-sm">Start managing your interns</p>
              </div>
            </div>
            <p className="text-zinc-600 text-xs mt-6">
              Didn't receive the email? Check your spam folder or{" "}
              <button onClick={() => setEmailSent(false)} className="text-[#EF7878] hover:underline">
                try again
              </button>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline" data-testid="link-home">
            <LogoMark size={32} />
            InternOps
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white hover:bg-white/5" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF7878]/10 border border-[#EF7878]/20 rounded-full text-sm text-[#EF7878] font-medium mb-4">
              <Shield className="w-4 h-4" />
              Manager Signup
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-signup-title">
              Create Your Company
            </h1>
            <p className="text-zinc-500 text-sm">Enter your details and we'll send you a verification link</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Company Name</label>
              <Input
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
                className={inputClass}
                data-testid="input-company-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Work Email</label>
              <Input
                type="email"
                placeholder="john@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className={inputClass}
                data-testid="input-email"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !companyName.trim() || !email.trim()}
              className="w-full py-5 text-base bg-gradient-to-r from-[#EF7878] to-[#e05555] hover:from-[#e86868] hover:to-[#d54545] text-white"
              data-testid="button-signup"
            >
              <Mail className="w-5 h-5 mr-2" />
              {loading ? "Sending verification email..." : "Send Verification Email"}
            </Button>

            <div className="text-center pt-2">
              <p className="text-sm text-zinc-500">
                Already have an account?{" "}
                <Link href="/manager-login" className="text-[#EF7878] hover:text-[#e86868] font-medium" data-testid="link-login">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
