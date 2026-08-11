import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { UserPlus, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Check, X } from "lucide-react";

interface AcceptInviteProps {
  token: string;
  onAccept: (token: string, name: string, password: string) => Promise<any>;
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
    { label: "Contains a number", met: /\d/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-2 text-xs">
          {check.met ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <X className="w-3.5 h-3.5 text-zinc-600" />
          )}
          <span className={check.met ? "text-emerald-400" : "text-zinc-600"}>{check.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AcceptInvite({ token, onAccept }: AcceptInviteProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [inviteData, setInviteData] = useState<{ valid: boolean; email: string; companyName: string; inviterName?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invitations/validate/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message);
        }
        return res.json();
      })
      .then(setInviteData)
      .catch((err) => setError(err.message || "Invalid invitation"))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!name.trim() || !password.trim()) {
      toast({ title: "Name and password are required", variant: "destructive" });
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
      await onAccept(token, name.trim(), password);
      toast({ title: "Welcome to InternOps!", description: "Your account has been created." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#EF7878]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-invite-error">Invalid Invitation</h1>
          <p className="text-zinc-500 mb-6">{error}</p>
          <Link href="/intern-login">
            <Button variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white" data-testid="link-back-login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Intern Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50";

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline" data-testid="link-home">
            <div className="w-8 h-8 bg-gradient-to-br from-[#EF7878] to-[#e05555] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#EF7878]/20">I</div>
            InternOps
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-invite-title">
              You're Invited!
            </h1>
            {inviteData?.inviterName ? (
              <p className="text-zinc-400 text-sm">
                <span className="text-white font-medium">{inviteData.inviterName}</span> invited you to join <span className="text-white font-medium">{inviteData.companyName}</span> on InternOps
              </p>
            ) : (
              <p className="text-zinc-400 text-sm">
                Join <span className="text-white font-medium">{inviteData?.companyName}</span> as an intern on InternOps
              </p>
            )}
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
              Invited email: <strong className="text-blue-200">{inviteData?.email}</strong>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Your Name</label>
              <Input
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className={inputClass}
                data-testid="input-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Set Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordRequirements password={password} />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className={`${inputClass} ${passwordsMismatch ? "border-red-500/50 focus-visible:ring-red-500/50" : passwordsMatch ? "border-emerald-500/50 focus-visible:ring-emerald-500/50" : ""}`}
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !password.trim() || !confirmPassword.trim() || password !== confirmPassword}
              className="w-full py-5 text-base bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
              data-testid="button-accept"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              {loading ? "Creating account..." : "Accept Invitation & Join"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
