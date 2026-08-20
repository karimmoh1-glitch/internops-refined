// Desktop-companion activity categorization and shift-report generation.
//
// Everything here is deterministic and rule-based — no AI, no invented
// numbers. "Observed" data (activity durations, task completion/submission
// timestamps) comes straight from stored records; the one "inferred" field
// (primary project) is a best-effort correlation clearly computed from real
// task activity, never a claim about what specifically was accomplished.

const CATEGORY_MAP: Record<string, string> = {
  "visual studio code": "development",
  "code": "development",
  "cursor": "development",
  "xcode": "development",
  "terminal": "development",
  "iterm2": "development",
  "iterm": "development",
  "warp": "development",
  "intellij idea": "development",
  "pycharm": "development",
  "android studio": "development",
  "sublime text": "development",
  "webstorm": "development",
  "docker desktop": "development",
  "tableplus": "development",
  "postman": "development",
  "google chrome": "research",
  "safari": "research",
  "firefox": "research",
  "microsoft edge": "research",
  "arc": "research",
  "notion": "research",
  "slack": "communication",
  "discord": "communication",
  "microsoft teams": "communication",
  "mail": "communication",
  "messages": "communication",
  "zoom": "communication",
  "figma": "design",
  "sketch": "design",
  "adobe photoshop": "design",
  "adobe illustrator": "design",
};

const CATEGORY_LABELS: Record<string, string> = {
  development: "Development environment",
  research: "Documentation / research environment",
  communication: "Communication",
  design: "Design environment",
  other: "Other activity",
};

export function categorizeApplication(appName: string): string {
  return CATEGORY_MAP[appName.trim().toLowerCase()] ?? "other";
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? "Other activity";
}

export function summarizeActivityByCategory(
  rows: { category: string; totalSeconds: number }[]
): { category: string; label: string; seconds: number }[] {
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.totalSeconds);
  }
  return Array.from(byCategory.entries())
    .map(([category, seconds]) => ({ category, label: categoryLabel(category), seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

export interface RawActivityRow {
  id: string;
  application: string;
  category: string;
  windowTitle: string | null;
  documentName: string | null;
  browserDomain: string | null;
  idleSeconds: number | null;
  taskId: string | null;
  taskCorrelation: string | null;
  startedAt: Date | string;
  endedAt: Date | string;
  durationSeconds: number;
}

export interface ActivitySegment {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  application: string;
  category: string;
  label: string; // e.g. "VS Code — auth.ts, routes.ts" — built only from observed document/domain names, nothing invented
  documentNames: string[];
  browserDomains: string[];
  taskId: string | null;
  taskCorrelation: string | null; // "single_in_progress" | null — same meaning as on the raw row; lets a reader distinguish "no task, we checked" from "no task, ambiguous"
  maxIdleSeconds: number | null; // the longest single idle reading observed anywhere in this segment — never a fabricated active/idle verdict
  evidenceIds: string[]; // raw work_activities rows this segment was built from, so an admin can drill into exactly what was observed
}

// Groups raw, fine-grained activity rows (which already split on every
// application/document/domain change — see companion/src/activityTracker.js)
// into coarser segments the way a human would narrate a shift: a
// continuous span in one application working one task, even if it touched
// several files or tabs along the way. A new segment starts only when the
// application or the correlated task changes — matching how Workday Replay
// is meant to read ("VS Code — auth files", "browser research", "VS Code —
// tests"), not a fragment per keystroke-adjacent title change.
export function buildActivitySegments(rows: RawActivityRow[]): ActivitySegment[] {
  const sorted = [...rows].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const segments: ActivitySegment[] = [];

  for (const row of sorted) {
    const last = segments[segments.length - 1];
    const sameGroup = last && last.application === row.application && last.taskId === (row.taskId ?? null);

    if (sameGroup) {
      last.endedAt = new Date(row.endedAt).toISOString();
      last.durationSeconds += row.durationSeconds;
      if (row.documentName && !last.documentNames.includes(row.documentName)) last.documentNames.push(row.documentName);
      if (row.browserDomain && !last.browserDomains.includes(row.browserDomain)) last.browserDomains.push(row.browserDomain);
      if (row.idleSeconds != null) last.maxIdleSeconds = Math.max(last.maxIdleSeconds ?? 0, row.idleSeconds);
      last.evidenceIds.push(row.id);
    } else {
      segments.push({
        startedAt: new Date(row.startedAt).toISOString(),
        endedAt: new Date(row.endedAt).toISOString(),
        durationSeconds: row.durationSeconds,
        application: row.application,
        category: row.category,
        label: row.application,
        documentNames: row.documentName ? [row.documentName] : [],
        browserDomains: row.browserDomain ? [row.browserDomain] : [],
        taskId: row.taskId ?? null,
        taskCorrelation: row.taskCorrelation ?? null,
        maxIdleSeconds: row.idleSeconds ?? null,
        evidenceIds: [row.id],
      });
    }
  }

  for (const seg of segments) {
    const context = seg.documentNames.length > 0 ? seg.documentNames : seg.browserDomains;
    seg.label = context.length > 0 ? `${seg.application} — ${context.join(", ")}` : seg.application;
  }

  return segments;
}

export interface SegmentInterpretation {
  observed: string; // exactly the segment's own label — restated, never elaborated
  inferred: string | null; // the one derived claim this system will make, or null when correlation is UNKNOWN
}

// Deterministic, never AI-written: "observed" restates only what the
// segment itself already records, and "inferred" is offered only in the
// one case the system actually has a basis for it (taskCorrelation ===
// "single_in_progress") — phrased as "likely worked on", never as a claim
// about what was accomplished. Every other case returns inferred: null
// rather than a soft-sounding guess.
export function interpretSegment(segment: ActivitySegment, taskTitle: string | null): SegmentInterpretation {
  const observed = segment.label;
  if (segment.taskCorrelation === "single_in_progress" && taskTitle) {
    return {
      observed,
      inferred: `Likely worked on "${taskTitle}" during this span — the only task in progress at the time, not a confirmed link.`,
    };
  }
  return { observed, inferred: null };
}
