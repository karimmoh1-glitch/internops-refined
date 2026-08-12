import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { GraduationCap, Clock, CheckCircle2 } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface SignupProps {
  onSignup: (name: string, email: string, password: string) => Promise<any>;
}

export default function Signup({ onSignup }: SignupProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await onSignup(name.trim(), email.trim(), password);
      if (result?.bootstrapped) {
        toast({ title: "Welcome to EDAI", description: "You're the first account, so you're set up as the admin." });
        setLocation("/");
      } else {
        setSubmitted(true);
      }
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#6D5EF5]/50 focus-visible:border-[#6D5EF5]/50";

  if (submitted) {
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
            <Clock className="w-16 h-16 text-[#6D5EF5] mx-auto mb-4" />
            <h1 className="text-3xl font-bold font-heading text-white mb-3" data-testid="text-pending-title">
              Request Submitted
            </h1>
            <p className="text-zinc-400 mb-6">
              Your account request for <span className="text-white font-medium">{email}</span> is waiting on an admin to approve it. You'll be able to log in once it's approved.
            </p>
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-zinc-300 text-sm">Request sent to an EDAI admin for review</p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#6D5EF5] shrink-0 mt-0.5" />
                <p className="text-zinc-300 text-sm">Once approved, log in with the password you just set</p>
              </div>
            </div>
            <p className="text-zinc-600 text-xs mt-6">
              <Link href="/login" className="text-[#6D5EF5] hover:underline">
                Try logging in
              </Link>
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
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6D5EF5]/10 border border-[#6D5EF5]/20 rounded-full text-sm text-[#6D5EF5] font-medium mb-4">
              <GraduationCap className="w-4 h-4" />
              Intern Signup
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-signup-title">
              Request an Account
            </h1>
            <p className="text-zinc-500 text-sm">Submit your details — an admin reviews every request before it's active</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Full Name</label>
              <Input
                placeholder="Jordan Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className={inputClass}
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Work Email</label>
              <Input
                type="email"
                placeholder="you@edai.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                data-testid="input-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Password</label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className={inputClass}
                data-testid="input-password"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              className="w-full py-5 text-base bg-gradient-to-r from-[#6D5EF5] to-[#5142D6] hover:from-[#8B7FF7] hover:to-[#4335B0] text-white"
              data-testid="button-signup"
            >
              {loading ? "Submitting..." : "Request Account"}
            </Button>

            <div className="text-center pt-2">
              <p className="text-sm text-zinc-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#6D5EF5] hover:text-[#8B7FF7] font-medium" data-testid="link-login">
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
