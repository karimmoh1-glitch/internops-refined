import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AuthLayout, AuthResult, AuthSkeleton, Field, Notice, PasswordInput } from "@/components/public/AuthLayout";

const MIN_PASSWORD = 6;

interface PublicCompany { name: string; slug: string; acceptingApplications: boolean }

export default function Apply({ slug }: { slug: string }) {
  const company = useQuery<PublicCompany>({
    queryKey: ["apply-company", slug],
    queryFn: () => api<PublicCompany>("GET", `/api/companies/${encodeURIComponent(slug)}/public`),
    retry: false,
    staleTime: Infinity,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [skills, setSkills] = useState("");
  const [motivation, setMotivation] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length > 0 && confirm.length > 0 && !mismatch && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) { setPasswordError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    setLoading(true);
    try {
      await api("POST", "/api/applications", {
        slug,
        name: name.trim(),
        email: email.trim(),
        password,
        skills: skills.trim() || undefined,
        motivation: motivation.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "We couldn't submit your application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (company.isLoading) {
    return (
      <AuthLayout width="md" title="Loading application" description="One moment.">
        <AuthSkeleton fields={4} />
      </AuthLayout>
    );
  }

  if (company.error || !company.data) {
    return (
      <AuthLayout title="Applications closed">
        <AuthResult
          tone="danger"
          title={(company.error as Error)?.message || "This company isn't accepting applications right now"}
          action={<Button asChild variant="outline"><Link href="/">Back to InternOps</Link></Button>}
        />
      </AuthLayout>
    );
  }

  const companyName = company.data.name;

  if (submitted) {
    return (
      <AuthLayout title="Application received">
        <AuthResult tone="ok" title={`Thanks for applying to ${companyName}`}>
          <p>We've emailed you a confirmation. You'll hear back once your application has been reviewed. No action is needed from you right now.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      width="md"
      eyebrow="Internship application"
      title={`Apply to ${companyName}`}
      description="Tell us a bit about yourself. This takes about two minutes."
      footer={<p>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            {(id, describedBy) => <Input id={id} autoComplete="name" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} autoFocus required aria-describedby={describedBy} />}
          </Field>
          <Field label="Email">
            {(id, describedBy) => <Input id={id} type="email" autoComplete="email" inputMode="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby={describedBy} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={passwordError}>
            {(id, describedBy) => <PasswordInput id={id} autoComplete="new-password" placeholder="Choose a password" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }} required aria-invalid={!!passwordError} aria-describedby={describedBy} />}
          </Field>
          <Field label="Confirm password" error={mismatch ? "Passwords don't match." : null}>
            {(id, describedBy) => <PasswordInput id={id} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} aria-describedby={describedBy} />}
          </Field>
        </div>

        <div className="border-t border-line pt-4 space-y-4">
          <Field label="Relevant skills" optional>
            {(id, describedBy) => <Input id={id} placeholder="React, Python, UI design…" value={skills} onChange={(e) => setSkills(e.target.value)} aria-describedby={describedBy} />}
          </Field>
          <Field label="Why do you want to join?" optional hint="A couple of sentences is plenty.">
            {(id, describedBy) => <Textarea id={id} rows={3} value={motivation} onChange={(e) => setMotivation(e.target.value)} aria-describedby={describedBy} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="GitHub" optional>
              {(id, describedBy) => <Input id={id} inputMode="url" placeholder="github.com/you" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} aria-describedby={describedBy} />}
            </Field>
            <Field label="LinkedIn" optional>
              {(id, describedBy) => <Input id={id} inputMode="url" placeholder="linkedin.com/in/you" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} aria-describedby={describedBy} />}
            </Field>
            <Field label="Portfolio" optional>
              {(id, describedBy) => <Input id={id} inputMode="url" placeholder="you.dev" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} aria-describedby={describedBy} />}
            </Field>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Submitting…" : "Submit application"}
        </Button>
        <p className="text-center text-xs text-ink-3">
          By applying you agree to the <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link> and <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
