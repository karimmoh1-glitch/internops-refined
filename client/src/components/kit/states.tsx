import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ icon, title, description, action, className, compact = false }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8 px-4" : "py-14 px-6", className)}>
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-ink-3 [&_svg]:h-5 [&_svg]:w-5">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "We couldn't load this", message, onRetry, className, compact = false }: { title?: string; message?: string; onRetry?: () => void; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8 px-4" : "py-14 px-6", className)} role="alert">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger"><AlertTriangle className="h-5 w-5" /></div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{message}</p>}
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" />Try again</Button>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy>
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />)}
    </div>
  );
}

// Wraps a query's three states so every page handles them the same way.
export function QueryState<T>({ isLoading, error, data, onRetry, loading, empty, isEmpty, children }: {
  isLoading: boolean; error: unknown; data: T | undefined; onRetry?: () => void;
  loading: ReactNode; empty?: ReactNode; isEmpty?: (d: T) => boolean; children: (d: T) => ReactNode;
}) {
  if (isLoading) return <>{loading}</>;
  if (error) return <ErrorState message={(error as Error)?.message} onRetry={onRetry} compact />;
  if (data === undefined) return <>{loading}</>;
  if (empty && isEmpty && isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
