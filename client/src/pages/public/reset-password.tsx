import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AuthLayout, AuthResult, AuthSkeleton, Field, Notice, PasswordInput } from "@/components/public/AuthLayout";

const MIN_PASSWORD = 6;

export default function ResetPassword({ token }: { token: string }) {
  const verify = useQuery<{ email: string }>({
    queryKey: ["verify-reset", token],
    queryFn: () => api<{ email: string }>("GET", `/api/auth/verify-reset/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length > 0 && confirm.length > 0 && !mismatch && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) { setPasswordError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    setLoading(true);
    try {
      await api("POST", `/api/auth/reset-password/${encodeURIComponent(token)}`, { password });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "We couldn't reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (verify.isLoading) {
    return (
      <AuthLayout title="Checking your link" description="One moment.">
        <AuthSkeleton fields={2} />
      </AuthLayout>
    );
  }

  if (verify.error || !verify.data) {
    return (
      <AuthLayout title="Reset link not valid" footer={<p><Link href="/login" className="text-ink-2 hover:text-ink">Back to log in</Link></p>}>
        <AuthResult
          tone="danger"
          title={(verify.error as Error)?.message || "Invalid or expired reset link"}
          action={<Button asChild><Link href="/forgot-password">Request a new link</Link></Button>}
        >
          <p>Reset links only work once and expire after a short while.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <AuthResult tone="ok" title="Your password has been reset" action={<Button asChild><Link href="/login">Log in</Link></Button>}>
          <p>Log in with your new password to continue.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      description={<>For <strong className="font-medium text-ink-2">{verify.data.email}</strong></>}
      footer={<p><Link href="/login" className="text-ink-2 hover:text-ink">Back to log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`} error={passwordError}>
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="new-password" placeholder="Choose a password" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }} autoFocus required aria-invalid={!!passwordError} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Confirm password" error={mismatch ? "Passwords don't match." : null}>
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} aria-describedby={describedBy} />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
