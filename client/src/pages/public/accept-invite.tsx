import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthResult, AuthSkeleton, Field, Notice, PasswordInput } from "@/components/public/AuthLayout";

const MIN_PASSWORD = 6;

interface InviteInfo { valid: boolean; email: string; companyName: string; inviterName?: string }

export default function AcceptInvite({ token }: { token: string }) {
  const { acceptInvite } = useAuth();
  const [, setLocation] = useLocation();

  const invite = useQuery<InviteInfo>({
    queryKey: ["invite", token],
    queryFn: () => api<InviteInfo>("GET", `/api/invitations/validate/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  });

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = name.trim().length > 0 && password.length > 0 && confirm.length > 0 && !mismatch && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD) { setPasswordError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    setLoading(true);
    try {
      await acceptInvite(token, name.trim(), password);
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || "We couldn't accept this invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (invite.isLoading) {
    return (
      <AuthLayout title="Checking your invitation" description="One moment.">
        <AuthSkeleton fields={3} />
      </AuthLayout>
    );
  }

  if (invite.error || !invite.data) {
    return (
      <AuthLayout title="Invitation not valid">
        <AuthResult
          tone="danger"
          title={(invite.error as Error)?.message || "Invalid invitation link"}
          action={<Button asChild variant="outline"><Link href="/login">Go to log in</Link></Button>}
        >
          <p>Ask the person who invited you to send a new link.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  const { email, companyName, inviterName } = invite.data;

  return (
    <AuthLayout
      eyebrow="Invitation"
      title={`Join ${companyName}`}
      description={inviterName ? <><strong className="font-medium text-ink-2">{inviterName}</strong> invited you to join {companyName} on InternOps.</> : `You've been invited to join ${companyName} on InternOps.`}
      footer={<p>Already have an account? <Link href="/login" className="font-medium text-accent hover:underline">Log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Notice tone="info">This invitation is for <strong>{email}</strong>.</Notice>

        <Field label="Your name">
          {(id, describedBy) => (
            <Input id={id} autoComplete="name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`} error={passwordError}>
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="new-password" placeholder="Choose a password" value={password} onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }} required aria-invalid={!!passwordError} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="Confirm password" error={mismatch ? "Passwords don't match." : null}>
          {(id, describedBy) => (
            <PasswordInput id={id} autoComplete="new-password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} aria-describedby={describedBy} />
          )}
        </Field>

        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Creating your account…" : "Accept invitation"}
        </Button>
      </form>
    </AuthLayout>
  );
}
