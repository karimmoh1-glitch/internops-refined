import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { LogIn, Eye, EyeOff, ArrowLeft, GraduationCap, Mail } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface InternLoginProps {
  onLogin: (email: string, password: string) => Promise<any>;
}

export default function InternLogin({ onLogin }: InternLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please enter your email and password", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await onLogin(email.trim(), password.trim());
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400 font-medium mb-4">
              <GraduationCap className="w-4 h-4" />
              Intern Login
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-login-title">
              Welcome back
            </h1>
            <p className="text-zinc-500 text-sm">Sign in to your intern account</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Email</label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
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
                  className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
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
              className="w-full py-5 text-base bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
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

            <div className="pt-3 border-t border-white/5">
              <div className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                <Mail className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  New intern? Ask your manager for an invite link, or apply directly if their company has a public application page open.
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-zinc-600">
                Are you a manager?{" "}
                <Link href="/manager-login" className="text-[#EF7878] hover:text-[#e86868] font-medium" data-testid="link-manager-login">
                  Manager Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
