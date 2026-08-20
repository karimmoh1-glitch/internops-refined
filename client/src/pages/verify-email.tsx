import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/api-error";
import { Link } from "wouter";
import { ArrowLeft, MailCheck, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface VerifyEmailProps {
  token: string;
}

export default function VerifyEmail({ token }: VerifyEmailProps) {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`);
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Invalid or expired verification link"));
        const data = await res.json();
        setEmail(data.email);
      } catch (err: any) {
        setError(err.message || "Invalid or expired verification link");
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, [token]);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/verify-email/${token}`, { method: "POST" });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to verify email"));
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to verify email", variant: "destructive" });
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
          {validating ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-[#6D5EF5] animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Validating verification link...</p>
            </div>
          ) : error ? (
            <div className="text-center" data-testid="text-verify-error">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-white mb-3">Invalid Verification Link</h1>
              <p className="text-zinc-400 text-sm mb-6">{error}</p>
              <Link href="/login">
                <Button variant="ghost" className="w-full text-zinc-500 hover:text-white">
                  Back to login
                </Button>
              </Link>
            </div>
          ) : success ? (
            <div className="text-center" data-testid="text-verify-success">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-white mb-3">Email Verified!</h1>
              <p className="text-zinc-400 text-sm mb-6">
                <span className="text-zinc-300">{email}</span> is confirmed. You're all set.
              </p>
              <Link href="/">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6D5EF5]/10 border border-[#6D5EF5]/20 rounded-full mb-4">
                  <MailCheck className="w-6 h-6 text-[#6D5EF5]" />
                </div>
                <h1 className="text-3xl font-bold font-heading text-white mb-2">Confirm your email</h1>
                <p className="text-zinc-500 text-sm">
                  Confirm that <span className="text-zinc-300">{email}</span> is your email address
                </p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6">
                <Button
                  onClick={handleVerify}
                  disabled={loading}
                  data-testid="button-verify-email"
                  className="w-full py-5 text-base bg-gradient-to-r from-[#6D5EF5] to-[#e85d5d] hover:from-[#8B7FF7] hover:to-[#d54d4d] text-white"
                >
                  {loading ? "Verifying..." : "Verify Email"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
