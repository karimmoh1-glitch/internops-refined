// Shared skill-tag normalization/aggregation — used by both the server
// (task routes, AI narrative digest, alumni snapshot) and the client
// (intern profile skill graph), hence living outside client/ or server/.

const MAX_TAG_LENGTH = 40;

export function normalizeSkillTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
}

export interface SkillCount {
  tag: string;
  count: number;
}

// Groups tags case-insensitively (so "React" and "react" count together)
// while keeping whichever exact casing occurred most often as the display
// label, then sorts by frequency descending.
export function aggregateSkillTags(tasks: { skillTags?: string[] | null }[]): SkillCount[] {
  const casingCounts = new Map<string, Map<string, number>>();

  for (const task of tasks) {
    for (const rawTag of task.skillTags || []) {
      const tag = normalizeSkillTag(rawTag);
      if (!tag) continue;
      const key = tag.toLowerCase();
      const casings = casingCounts.get(key) || new Map<string, number>();
      casings.set(tag, (casings.get(tag) || 0) + 1);
      casingCounts.set(key, casings);
    }
  }

  const results: SkillCount[] = [];
  for (const casings of Array.from(casingCounts.values())) {
    let bestLabel = "";
    let total = 0;
    let bestCount = -1;
    for (const [label, count] of Array.from(casings)) {
      total += count;
      if (count > bestCount) {
        bestCount = count;
        bestLabel = label;
      }
    }
    results.push({ tag: bestLabel, count: total });
  }

  return results.sort((a, b) => b.count - a.count);
}
