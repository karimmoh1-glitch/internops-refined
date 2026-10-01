export function formatDuration(seconds: number, opts: { compact?: boolean } = {}): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (opts.compact) return h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function relativeTime(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return "";
  const d = new Date(input);
  const diff = now.getTime() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const min = Math.round(abs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return future ? `in ${min}m` : `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return future ? `in ${days}d` : `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(input: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  if (!input) return "";
  return new Date(input).toLocaleDateString(undefined, opts);
}

export function formatTime(input: string | Date | null | undefined): string {
  if (!input) return "";
  return new Date(input).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${formatTime(d)}`;
}

export function dayLabel(input: string | Date, now: Date = new Date()): string {
  const d = new Date(input);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function dueLabel(dueDate: string | Date | null | undefined, status?: string, now: Date = new Date()): { text: string; tone: "danger" | "warn" | "muted" | "ok" } | null {
  if (!dueDate) return null;
  if (status === "completed") return { text: `Due ${formatDate(dueDate)}`, tone: "muted" };
  const due = new Date(dueDate);
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const days = Math.round((dueDay.getTime() - startToday.getTime()) / 86_400_000);
  if (days < 0) return { text: `${-days}d overdue`, tone: "danger" };
  if (days === 0) return { text: "Due today", tone: "warn" };
  if (days === 1) return { text: "Due tomorrow", tone: "warn" };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "muted" };
  return { text: `Due ${formatDate(dueDate)}`, tone: "muted" };
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralize(n: number, word: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? word : pluralWord ?? word + "s"}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
