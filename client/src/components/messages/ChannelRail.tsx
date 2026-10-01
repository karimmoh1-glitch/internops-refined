import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Hash, FolderKanban, ChevronDown, ChevronRight, PenSquare, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, ErrorState, Skeleton } from "@/components/kit";
import { type Channel, type ChannelType, channelHref } from "./types";

const GROUPS: { key: ChannelType; label: string; hideWhenEmpty: boolean }[] = [
  { key: "general", label: "General", hideWhenEmpty: true },
  { key: "project", label: "Projects", hideWhenEmpty: true },
  { key: "dm", label: "Direct messages", hideWhenEmpty: false },
  { key: "custom", label: "Channels", hideWhenEmpty: false },
];

export function ChannelRail({ channels, activeId, isLoading, error, onRetry, onNewMessage, onNewChannel, isAdmin }: {
  channels: Channel[];
  activeId: string | null;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onNewMessage: () => void;
  onNewChannel: () => void;
  isAdmin: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Partial<Record<ChannelType, boolean>>>({});
  const toggle = (key: ChannelType) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-3 md:px-3.5">
        <h1 className="t-section truncate">Messages</h1>
        <div className="flex items-center gap-0.5">
          {isAdmin && (
            <Button variant="ghost" size="icon-sm" aria-label="New channel" title="New channel" onClick={onNewChannel}><Plus className="h-4 w-4" /></Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="New message" title="New message" onClick={onNewMessage}><PenSquare className="h-4 w-4" /></Button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto scroll-thin px-2 pb-4" aria-label="Conversations">
        {isLoading ? (
          <RailSkeleton />
        ) : error ? (
          <ErrorState compact title="Couldn't load conversations" message={(error as Error)?.message} onRetry={onRetry} />
        ) : (
          GROUPS.map((g) => {
            const items = channels.filter((c) => c.type === g.key);
            if (items.length === 0 && g.hideWhenEmpty) return null;
            const isCollapsed = !!collapsed[g.key];
            const unread = items.reduce((n, c) => n + (c.unreadCount || 0), 0);
            const action: ReactNode =
              g.key === "dm" ? <GroupAction label="New message" onClick={onNewMessage} /> :
              g.key === "custom" && isAdmin ? <GroupAction label="New channel" onClick={onNewChannel} /> : null;
            return (
              <section key={g.key} className="mt-3 first:mt-1" aria-label={g.label}>
                <div className="flex h-7 items-center justify-between pr-0.5">
                  <button type="button" onClick={() => toggle(g.key)} aria-expanded={!isCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1.5 t-label text-[10.5px] hover:text-ink-2 transition-colors">
                    {isCollapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{g.label}</span>
                    {isCollapsed && unread > 0 && <UnreadPill n={unread} className="ml-1" />}
                  </button>
                  {action}
                </div>
                {!isCollapsed && (
                  <ul className="mt-0.5 space-y-px">
                    {items.map((c) => <li key={c.id}><ChannelItem channel={c} active={c.id === activeId} /></li>)}
                    {items.length === 0 && (
                      <li className="px-2 py-1.5 text-xs text-ink-4">
                        {g.key === "dm" ? "No direct messages yet." : isAdmin ? "No channels yet." : "No channels you're in yet."}
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })
        )}
        {!isLoading && !error && channels.length === 0 && (
          <div className="mt-6 flex flex-col items-center px-4 text-center">
            <MessageSquare className="mb-2 h-5 w-5 text-ink-4" />
            <p className="text-[13px] text-ink-3">No conversations yet.</p>
          </div>
        )}
      </nav>
    </div>
  );
}

function GroupAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="flex h-6 w-6 items-center justify-center rounded-sm text-ink-4 hover:bg-surface-2 hover:text-ink-2 transition-colors">
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}

function UnreadPill({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("t-num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-ink", className)} aria-label={`${n} unread`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function ChannelItem({ channel, active }: { channel: Channel; active: boolean }) {
  const unread = channel.unreadCount > 0;
  return (
    <Link href={channelHref(channel.id)} aria-current={active ? "page" : undefined}
      className={cn("group flex h-9 items-center gap-2 rounded-md border px-2 text-[13px] transition-colors md:h-8",
        active ? "border-line bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "border-transparent text-ink-2 hover:bg-surface/70 hover:text-ink")}>
      {channel.type === "dm" ? (
        <Avatar name={channel.name} size="xs" />
      ) : channel.type === "project" ? (
        <FolderKanban className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-4 group-hover:text-ink-3")} />
      ) : (
        <Hash className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-4 group-hover:text-ink-3")} />
      )}
      <span className={cn("min-w-0 flex-1 truncate", unread && !active && "font-semibold text-ink")}>{channel.name}</span>
      {unread && <UnreadPill n={channel.unreadCount} />}
    </Link>
  );
}

function RailSkeleton() {
  return (
    <div className="space-y-4 px-1 pt-2" aria-busy aria-label="Loading conversations">
      {[2, 3, 2].map((n, gi) => (
        <div key={gi} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-1 py-1">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
