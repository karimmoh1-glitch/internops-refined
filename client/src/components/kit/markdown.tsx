import { Fragment, type ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { ListTodo, User, FolderKanban, History } from "lucide-react";

// Renders the restricted markdown Pulse produces: paragraphs, bullet lists,
// **bold**, *italics*, `code`, and [[type:id|label]] references which
// become links into the product. Deliberately not a general markdown
// engine — no raw HTML, no images, no tables.

const REF_RE = /\[\[(task|person|project|replay):([A-Za-z0-9-]+)\|([^\]]+)\]\]/g;

function refHref(type: string, id: string): string {
  switch (type) {
    case "task": return `/tasks/${id}`;
    case "person": return `/people/${id}`;
    case "project": return `/projects/${id}`;
    case "replay": return `/work/replay/${id}`;
    default: return "/";
  }
}
const REF_ICON: Record<string, typeof ListTodo> = { task: ListTodo, person: User, project: FolderKanban, replay: History };

export function RefChip({ type, id, label, className }: { type: string; id: string; label: string; className?: string }) {
  const Icon = REF_ICON[type] ?? ListTodo;
  return (
    <Link href={refHref(type, id)} className={cn("inline-flex max-w-full items-center gap-1 rounded-sm border border-line bg-surface px-1.5 py-px text-[12.5px] font-medium text-ink align-baseline hover:border-line-strong hover:bg-surface-2 transition-colors", className)}>
      <Icon className="h-3 w-3 text-ink-3 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0; let i = 0;
  const pushText = (t: string) => {
    // bold / italic / code
    const parts = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith("**")) out.push(<strong key={`${keyPrefix}-${i++}`} className="font-semibold text-ink">{part.slice(2, -2)}</strong>);
      else if (part.startsWith("`")) out.push(<code key={`${keyPrefix}-${i++}`} className="rounded-sm bg-bg-sunken px-1 py-px font-mono text-[12px]">{part.slice(1, -1)}</code>);
      else if (part.startsWith("*")) out.push(<em key={`${keyPrefix}-${i++}`} className="italic text-ink-2">{part.slice(1, -1)}</em>);
      else out.push(<Fragment key={`${keyPrefix}-${i++}`}>{part}</Fragment>);
    }
  };
  for (const m of text.matchAll(REF_RE)) {
    pushText(text.slice(last, m.index));
    out.push(<RefChip key={`${keyPrefix}-${i++}`} type={m[1]} id={m[2]} label={m[3]} />);
    last = (m.index ?? 0) + m[0].length;
  }
  pushText(text.slice(last));
  return out;
}

export function PulseMarkdown({ text, className, streaming = false }: { text: string; className?: string; streaming?: boolean }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cn("space-y-2.5 text-[13.5px] leading-[1.6] text-ink-2 [&_strong]:text-ink", className)}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l) || l.trim() === "");
        if (isList) {
          return (
            <ul key={bi} className="space-y-1.5 pl-1">
              {lines.filter((l) => l.trim()).map((l, li) => {
                const indent = /^\s{2,}/.test(l);
                return <li key={li} className={cn("flex gap-2", indent && "pl-4")}><span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-ink-4" /><span className="min-w-0">{inline(l.replace(/^\s*[-•]\s+/, ""), `${bi}-${li}`)}</span></li>;
              })}
            </ul>
          );
        }
        return (
          <p key={bi} className={cn(streaming && bi === blocks.length - 1 && "caret")}>
            {lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</Fragment>)}
          </p>
        );
      })}
    </div>
  );
}
