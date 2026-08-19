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
