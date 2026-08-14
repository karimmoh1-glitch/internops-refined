import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/api-error";
import { Link } from "wouter";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import LogoMark from "@/components/logo-mark";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Something went wrong"));
      setSent(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="bg-background/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline">
            <LogoMark size={32} />
            InternOps
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-white mb-3">Check your email</h1>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                If an account exists for <span className="text-white font-medium">{email}</span>, we've sent a password reset link. Check your inbox (and spam folder).
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => { setSent(false); setEmail(""); }}
                  variant="outline"
                  className="w-full border-white/10 text-zinc-300 hover:bg-white/5"
                >
                  Try a different email
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-zinc-500 hover:text-white">
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6D5EF5]/10 border border-[#6D5EF5]/20 rounded-full mb-4">
                  <Mail className="w-6 h-6 text-[#6D5EF5]" />
                </div>
                <h1 className="text-3xl font-bold font-heading text-white mb-2">Forgot password?</h1>
                <p className="text-zinc-500 text-sm">Enter your email and we'll send you a reset link</p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Email address</label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoFocus
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#6D5EF5]/50 focus-visible:border-[#6D5EF5]/50"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading || !email.trim()}
                  className="w-full py-5 text-base bg-gradient-to-r from-[#6D5EF5] to-[#e85d5d] hover:from-[#8B7FF7] hover:to-[#d54d4d] text-white"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-300">
                    Back to login
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
