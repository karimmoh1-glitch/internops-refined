import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, Field, Notice, PasswordInput } from "@/components/public/AuthLayout";

type ApplicationStatus = "pending" | "rejected";

// Only follow same-origin paths; never a protocol-relative or absolute URL.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function Login() {
  const { login, expiredReason } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const next = safeNext(new URLSearchParams(search).get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setApplicationStatus(null);
    try {
      await login(email.trim(), password);
      setLocation(next);
    } catch (err: any) {
      const status = err?.applicationStatus as ApplicationStatus | undefined;
      if (status === "pending" || status === "rejected") setApplicationStatus(status);
      else setError(err?.message || "We couldn't sign you in. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Log in"
      description="Use the email and password on your InternOps account."
      footer={
        <>
          <p><Link href="/forgot-password" className="text-ink-2 hover:text-ink">Forgot your password?</Link></p>
          <p>New here? <Link href="/signup" className="font-medium text-accent hover:underline">Request an account</Link></p>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {expiredReason && !error && !applicationStatus && <Notice tone="info">{expiredReason}</Notice>}
        {applicationStatus === "pending" && (
          <Notice tone="pending">Your account request is still waiting for a manager to approve it. You'll be able to log in once it's approved.</Notice>
        )}
        {applicationStatus === "rejected" && (
          <Notice tone="danger">Your account request was not approved. Contact your workspace manager if you think this is a mistake.</Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}

        <Field label="Email">
          {(id, describedBy) => (
            <Input id={id} type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Password">
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-describedby={describedBy} />
          )}
        </Field>

        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
