import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthResult, Field, Notice } from "@/components/public/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await api("POST", "/api/auth/forgot-password", { email: email.trim() });
      setSentTo(email.trim());
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={<p><Link href="/login" className="text-ink-2 hover:text-ink">Back to log in</Link></p>}>
        <AuthResult
          tone="ok"
          title="Reset link sent"
          action={<Button variant="outline" onClick={() => { setSentTo(null); setEmail(""); }}>Use a different email</Button>}
        >
          <p>If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset its password. Check your inbox and your spam folder.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={<p><Link href="/login" className="text-ink-2 hover:text-ink">Back to log in</Link></p>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Email">
          {(id, describedBy) => (
            <Input id={id} type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required aria-describedby={describedBy} />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
