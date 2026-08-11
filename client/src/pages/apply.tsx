import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/api-error";
import { Link } from "wouter";
import { Send, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Check, X, GraduationCap } from "lucide-react";

interface ApplyProps {
  slug: string;
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
          {check.met ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-zinc-600" />}
          <span className={check.met ? "text-emerald-400" : "text-zinc-600"}>{check.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Apply({ slug }: ApplyProps) {
  const { toast } = useToast();
  const [company, setCompany] = useState<{ name: string } | null>(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skills, setSkills] = useState("");
  const [motivation, setMotivation] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${slug}/public`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await parseErrorMessage(res, "Applications aren't open for this company"));
        return res.json();
      })
      .then(setCompany)
      .catch((err) => setError(err.message))
      .finally(() => setValidating(false));
  }, [slug]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Name, email, and password are required", variant: "destructive" });
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
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, name: name.trim(), email: email.trim(), password,
          skills: skills.trim() || undefined,
          motivation: motivation.trim() || undefined,
          githubUrl: githubUrl.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to submit application"));
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Couldn't submit application", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-[#EF7878]/50 focus-visible:border-[#EF7878]/50";

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
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-apply-error">Applications Closed</h1>
          <p className="text-zinc-500 mb-6">{error}</p>
          <Link href="/">
            <Button variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to InternOps
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold font-heading text-white mb-3" data-testid="text-application-received">Application Received</h1>
          <p className="text-zinc-400 mb-2">Thanks for applying to <span className="text-white font-medium">{company?.name}</span>.</p>
          <p className="text-zinc-500 text-sm">We've emailed you a confirmation. You'll hear back once your application has been reviewed — no action is needed from you right now.</p>
        </div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF7878]/10 border border-[#EF7878]/20 rounded-full text-sm text-[#EF7878] font-medium mb-4">
              <GraduationCap className="w-4 h-4" />
              Internship Application
            </div>
            <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-apply-title">
              Apply to {company?.name}
            </h1>
            <p className="text-zinc-500 text-sm">Tell us a bit about yourself. This takes about two minutes.</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] shadow-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Full Name</label>
              <Input placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputClass} data-testid="input-apply-name" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Email</label>
              <Input type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} data-testid="input-apply-email" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Set Password</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} data-testid="input-apply-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
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
                  className={`${inputClass} ${passwordsMismatch ? "border-red-500/50 focus-visible:ring-red-500/50" : passwordsMatch ? "border-emerald-500/50 focus-visible:ring-emerald-500/50" : ""}`}
                  data-testid="input-apply-confirm-password"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMismatch && <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>}
              {passwordsMatch && <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1"><Check className="w-3 h-3" /> Passwords match</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Relevant skills <span className="text-zinc-600">(optional)</span></label>
              <Input placeholder="React, Python, UI design..." value={skills} onChange={(e) => setSkills(e.target.value)} className={inputClass} data-testid="input-apply-skills" />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1.5 block">Why do you want to join? <span className="text-zinc-600">(optional)</span></label>
              <Textarea placeholder="A couple sentences is plenty." value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={3} className={inputClass} data-testid="input-apply-motivation" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">GitHub</label>
                <Input placeholder="github.com/you" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className={inputClass} data-testid="input-apply-github" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">LinkedIn</label>
                <Input placeholder="linkedin.com/in/you" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className={inputClass} data-testid="input-apply-linkedin" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Portfolio</label>
                <Input placeholder="you.dev" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className={inputClass} data-testid="input-apply-portfolio" />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim() || password !== confirmPassword}
              className="w-full py-5 text-base bg-gradient-to-r from-[#EF7878] to-[#e05555] hover:from-[#e86868] hover:to-[#d54545] text-white"
              data-testid="button-submit-application"
            >
              <Send className="w-5 h-5 mr-2" />
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
