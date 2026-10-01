import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AuthLayout, AuthResult, AuthSkeleton, Notice } from "@/components/public/AuthLayout";

export default function VerifyEmail({ token }: { token: string }) {
  const check = useQuery<{ email: string }>({
    queryKey: ["verify-email", token],
    queryFn: () => api<{ email: string }>("GET", `/api/auth/verify-email/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: Infinity,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await api("POST", `/api/auth/verify-email/${encodeURIComponent(token)}`);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "We couldn't verify this email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (check.isLoading) {
    return (
      <AuthLayout title="Checking your link" description="One moment.">
        <AuthSkeleton fields={0} />
      </AuthLayout>
    );
  }

  if (check.error || !check.data) {
    return (
      <AuthLayout title="Verification link not valid">
        <AuthResult
          tone="danger"
          title={(check.error as Error)?.message || "Invalid or expired verification link"}
          action={<Button asChild variant="outline"><Link href="/login">Go to log in</Link></Button>}
        >
          <p>You can request a new verification email from Settings once you're logged in.</p>
        </AuthResult>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Email verified">
        <AuthResult tone="ok" title={`${check.data.email} is confirmed`} action={<Button asChild><Link href="/">Open InternOps</Link></Button>} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Confirm your email"
      description={<>Confirm that <strong className="font-medium text-ink-2">{check.data.email}</strong> is your address.</>}
      footer={<p><Link href="/login" className="text-ink-2 hover:text-ink">Back to log in</Link></p>}
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="button" className="w-full" onClick={confirm} disabled={loading} aria-busy={loading}>
          {loading ? "Verifying…" : "Verify email"}
        </Button>
      </div>
    </AuthLayout>
  );
}
