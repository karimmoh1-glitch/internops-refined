import { useId, useState, type ReactNode, type ComponentProps } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoMark from "@/components/logo-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/kit";

/* ------------------------------------------------------------------
   AuthLayout — the one frame every public auth screen shares:
   bg-bg canvas, faded dot grid, mark, title, helper, card, link row.
   ------------------------------------------------------------------ */
export function AuthLayout({ title, description, children, footer, width = "sm", eyebrow }: {
  title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; width?: "sm" | "md"; eyebrow?: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh bg-bg flex flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] grid-dots mask-fade-b opacity-70" />
      <div className="relative mx-auto flex w-full flex-1 flex-col items-center px-4 pt-8 pb-12 sm:pt-14">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-md" aria-label="InternOps home">
          <LogoMark size={32} />
        </Link>
        <main className={cn("w-full anim-fade-up", width === "md" ? "max-w-[520px]" : "max-w-[400px]")}>
          <header className="mb-5 text-center">
            {eyebrow && <div className="t-label mb-2">{eyebrow}</div>}
            <h1 className="t-page">{title}</h1>
            {description && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{description}</p>}
          </header>
          <div className="panel p-5 sm:p-6">{children}</div>
          {footer && <div className="mt-5 text-center text-[13px] text-ink-3 space-y-1.5">{footer}</div>}
        </main>
      </div>
    </div>
  );
}

/* ---------------- form helpers ---------------- */

export function Field({ label, hint, error, children, optional = false, id }: {
  label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy: string | undefined) => ReactNode; optional?: boolean; id?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={fieldId} className="text-[13px] text-ink">{label}</Label>
        {optional && <span className="text-xs text-ink-4">Optional</span>}
      </div>
      {children(fieldId, describedBy)}
      {hint && !error && <p id={hintId} className="text-xs text-ink-3">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className={cn("pr-10", className)} autoComplete={props.autoComplete ?? "current-password"} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Inline, form-level message. `danger` is announced as an alert. */
export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger" | "ok" | "pending"; children: ReactNode; className?: string }) {
  const map = {
    info: { cls: "bg-info-soft text-info border-info/20", Icon: Info },
    warn: { cls: "bg-warn-soft text-warn border-warn/20", Icon: AlertTriangle },
    danger: { cls: "bg-danger-soft text-danger border-danger/20", Icon: AlertTriangle },
    ok: { cls: "bg-ok-soft text-ok border-ok/20", Icon: CheckCircle2 },
    pending: { cls: "bg-accent-soft text-accent border-accent/20", Icon: Clock },
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-relaxed", map.cls, className)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 text-ink-2 [&_strong]:text-ink [&_strong]:font-medium">{children}</div>
    </div>
  );
}

/** A finished state (success / invalid link) inside the auth card. */
export function AuthResult({ tone, title, children, action }: { tone: "ok" | "danger" | "pending"; title: string; children?: ReactNode; action?: ReactNode }) {
  const { cls, Icon } = {
    ok: { cls: "bg-ok-soft text-ok", Icon: CheckCircle2 },
    danger: { cls: "bg-danger-soft text-danger", Icon: AlertTriangle },
    pending: { cls: "bg-accent-soft text-accent", Icon: Clock },
  }[tone];
  return (
    <div className="flex flex-col items-center text-center py-2" role={tone === "danger" ? "alert" : "status"}>
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-lg", cls)}><Icon className="h-5 w-5" /></div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-[13px] leading-relaxed text-ink-3 [&_strong]:text-ink [&_strong]:font-medium">{children}</div>}
      {action && <div className="mt-4 flex w-full flex-col gap-2">{action}</div>}
    </div>
  );
}

/** Skeleton shaped like a short form, for token-validation loads. */
export function AuthSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default AuthLayout;
