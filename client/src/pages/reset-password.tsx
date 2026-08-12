import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/api-error";
import { Link } from "wouter";
import { ArrowLeft, Eye, EyeOff, KeyRound, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface ResetPasswordProps {
  token: string;
}

export default function ResetPassword({ token }: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/auth/verify-reset/${token}`);
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Invalid or expired reset link"));
        const data = await res.json();
        setValid(true);
        setEmail(data.email);
      } catch (err: any) {
        setError(err.message || "Invalid or expired reset link");
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, [token]);

  const handleReset = async () => {
    if (!password.trim()) {
      toast({ title: "Please enter a new password", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to reset password"));
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline">
            <LogoMark size={32} />
            InternOps
          </Link>
          <Link href="/manager-login">
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
              <Loader2 className="w-8 h-8 text-[#E8604F] animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Validating reset link...</p>
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-white mb-3">Invalid Reset Link</h1>
              <p className="text-zinc-400 text-sm mb-6">{error}</p>
              <div className="space-y-3">
                <Link href="/forgot-password">
                  <Button className="w-full bg-gradient-to-r from-[#E8604F] to-[#e85d5d] text-white">
                    Request a new link
                  </Button>
                </Link>
                <Link href="/manager-login">
                  <Button variant="ghost" className="w-full text-zinc-500 hover:text-white">
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold font-heading text-white mb-3">Password Reset!</h1>
              <p className="text-zinc-400 text-sm mb-6">Your password has been reset successfully. You can now log in with your new password.</p>
              <Link href="/manager-login">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#E8604F]/10 border border-[#E8604F]/20 rounded-full mb-4">
                  <KeyRound className="w-6 h-6 text-[#E8604F]" />
                </div>
                <h1 className="text-3xl font-bold font-heading text-white mb-2">Set new password</h1>
                <p className="text-zinc-500 text-sm">
                  Enter a new password for <span className="text-zinc-300">{email}</span>
                </p>
              </div>

              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-1.5 block">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#E8604F]/50 focus-visible:border-[#E8604F]/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Confirm Password</label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#E8604F]/50 focus-visible:border-[#E8604F]/50"
                  />
                </div>

                <Button
                  onClick={handleReset}
                  disabled={loading || !password.trim() || !confirmPassword.trim()}
                  className="w-full py-5 text-base bg-gradient-to-r from-[#E8604F] to-[#e85d5d] hover:from-[#EE7A6B] hover:to-[#d54d4d] text-white"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
