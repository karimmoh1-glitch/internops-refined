import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { LogIn, Eye, EyeOff, ArrowLeft, Clock, ShieldAlert } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<any>;
}

interface LoginError extends Error {
  applicationStatus?: "pending" | "rejected";
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<"pending" | "rejected" | null>(null);
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please enter your email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPendingNotice(null);
    try {
      await onLogin(email.trim(), password.trim());
    } catch (err: any) {
      const status = (err as LoginError)?.applicationStatus;
      if (status === "pending" || status === "rejected") {
        setPendingNotice(status);
      } else {
        toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-login-title">
              Welcome back
            </h1>
            <p className="text-zinc-500 text-sm">Sign in to your InternOps account</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            {pendingNotice && (
              <div
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  pendingNotice === "rejected"
                    ? "bg-red-500/[0.06] border-red-500/20"
                    : "bg-[#6D5EF5]/[0.08] border-[#6D5EF5]/20"
                }`}
                data-testid="notice-application-status"
              >
                {pendingNotice === "rejected" ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-[#8B7FF7] mt-0.5 shrink-0" />
                )}
                <p className={`text-xs leading-relaxed ${pendingNotice === "rejected" ? "text-red-300" : "text-zinc-300"}`}>
                  {pendingNotice === "rejected"
                    ? "Your account request was not approved. Contact an admin if you think this is a mistake."
                    : "Your account is still waiting on admin approval. You'll be able to log in once it's approved."}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Email</label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#6D5EF5]/50 focus-visible:border-[#6D5EF5]/50"
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#6D5EF5]/50 focus-visible:border-[#6D5EF5]/50"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleLogin}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full py-5 text-base bg-gradient-to-r from-[#6D5EF5] to-[#5142D6] hover:from-[#8B7FF7] hover:to-[#4335B0] text-white"
              data-testid="button-login"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center pt-1">
              <Link href="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-300 font-medium">
                Forgot password?
              </Link>
            </div>

            <div className="text-center pt-2">
              <p className="text-sm text-zinc-600">
                Don't have an account?{" "}
                <Link href="/signup" className="text-[#6D5EF5] hover:text-[#8B7FF7] font-medium" data-testid="link-signup">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
