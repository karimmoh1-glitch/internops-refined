import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthResult, Field, Notice, PasswordInput } from "@/components/public/AuthLayout";

const MIN_PASSWORD = 6;

export default function Signup() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setLoading(true);
    try {
      const result = await signup(name.trim(), email.trim(), password);
      if (result.pending) {
        setSubmittedEmail(email.trim());
      } else {
        // First account in the workspace: created as the admin and signed in.
        toast({ title: "Welcome to InternOps", description: "You're the first account here, so you're set up as the admin." });
        setLocation("/");
      }
    } catch (err: any) {
      setError(err?.message || "We couldn't submit your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthLayout title="Request submitted" footer={<p>Already approved? <Link href="/login" className="font-medium text-accent hover:underline">Log in</Link></p>}>
        <AuthResult tone="pending" title="Waiting for approval">
          <p>Your request for <strong>{submittedEmail}</strong> has been sent to a manager for review. Once it's approved, log in with the password you just set.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Request an account"
      description="A manager reviews every request before the account is active."
      footer={<p>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}

        <Field label="Full name">
          {(id, describedBy) => (
            <Input id={id} autoComplete="name" placeholder="Jordan Rivera" value={name} onChange={(e) => setName(e.target.value)} autoFocus required aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Work email">
          {(id, describedBy) => (
            <Input id={id} type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={passwordError}>
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="new-password" placeholder="Choose a password" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }} required aria-invalid={!!passwordError} aria-describedby={describedBy} />
          )}
        </Field>

        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Submitting…" : "Request account"}
        </Button>
        <p className="text-center text-xs text-ink-3">
          By continuing you agree to the <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link> and <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
