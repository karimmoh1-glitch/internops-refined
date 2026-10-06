import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, Hash, FolderKanban, Send, Trash2, Users, UserMinus, UserPlus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { dayLabel, formatTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, ConfirmDialog, EmptyState, ErrorState, Pill, Skeleton } from "@/components/kit";
import { type Channel, type ChannelMember, type ChannelMessage, type CompanyUser, CHANNELS_KEY, UNREAD_KEY, channelKindLabel, membersKey, messagesKey, roleLabel, usePageVisible, dmDisplayName } from "./types";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const BOTTOM_THRESHOLD_PX = 48;

export function Conversation({ channel, user, onBack, onDeleted }: {
  channel: Channel;
  user: AuthUser;
  onBack?: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const visible = usePageVisible();
  const isAdmin = user.role === "admin";
  const key = messagesKey(channel.id);

  const messages = useQuery<ChannelMessage[]>({
    queryKey: key,
    refetchInterval: visible ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const list = messages.data ?? [];

  // ─── Mark read: on open, and whenever the number of messages changes ───
  const readKeyRef = useRef("");
  const loaded = messages.data !== undefined;
  useEffect(() => {
    // Wait for the first page of messages: marking read while still loading
    // sends one PUT for "0 messages" and a second as soon as they arrive.
    if (!visible || !loaded) return;
    const k = `${channel.id}:${list.length}`;
    if (readKeyRef.current === k) return;
    readKeyRef.current = k;
    api("PUT", `/api/channels/${channel.id}/read`)
      .then(() => { qc.invalidateQueries({ queryKey: CHANNELS_KEY }); qc.invalidateQueries({ queryKey: UNREAD_KEY }); })
      .catch(() => { /* read receipts are best-effort */ });
  }, [channel.id, list.length, visible, loaded, qc]);

  // ─── Scroll: stick to the bottom unless the reader has scrolled up ───
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const lastLenRef = useRef(0);
  const [newCount, setNewCount] = useState(0);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setNewCount(0);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const at = dist < BOTTOM_THRESHOLD_PX;
    atBottomRef.current = at;
    if (at && newCount) setNewCount(0);
  };

  useLayoutEffect(() => {
    if (messages.isLoading) return;
    const prev = lastLenRef.current;
    lastLenRef.current = list.length;
    if (prev === 0) { scrollToBottom(); return; }
    if (list.length > prev) {
      const added = list.slice(prev);
      const mineOnly = added.every((m) => m.userId === user.id);
      if (atBottomRef.current || mineOnly) scrollToBottom(true);
      else setNewCount((n) => n + added.filter((m) => m.userId !== user.id).length);
    }
  }, [list, messages.isLoading, user.id, scrollToBottom]);

  // ─── Send (optimistic) ───
  const [draft, setDraft] = useState("");
  const send = useMutation({
    mutationFn: (content: string) => api<ChannelMessage>("POST", `/api/channels/${channel.id}/messages`, { content }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChannelMessage[]>(key);
      const tempId = `tmp-${Date.now()}`;
      const temp: ChannelMessage = { id: tempId, channelId: channel.id, userId: user.id, userName: user.name, userRole: user.role, content, createdAt: new Date().toISOString(), pending: true };
      qc.setQueryData<ChannelMessage[]>(key, (old) => [...(old ?? []), temp]);
      return { previous, tempId, content };
    },
    onSuccess: (saved, _content, ctx) => {
      qc.setQueryData<ChannelMessage[]>(key, (old) => (old ?? []).map((m) => (m.id === ctx?.tempId ? { ...saved, userName: user.name, userRole: user.role } : m)));
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
    },
    onError: (err: Error, _content, ctx) => {
      qc.setQueryData<ChannelMessage[]>(key, (old) => (old ?? []).filter((m) => m.id !== ctx?.tempId));
      setDraft((d) => d || ctx?.content || "");
      toast({ title: "Message not sent", description: err.message, variant: "destructive" });
    },
  });

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    send.mutate(content);
  };

  // ─── Delete (admin; DMs and custom channels only) ───
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useMutation({
    mutationFn: () => api("DELETE", `/api/channels/${channel.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
      toast({ title: channel.type === "dm" ? "Conversation deleted" : `#${channel.name} deleted` });
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err: Error) => toast({ title: "Couldn't delete", description: err.message, variant: "destructive" }),
  });
  const canDelete = isAdmin && (channel.type === "dm" || channel.type === "custom");

  // ─── Render groups: day separators + 5-minute author runs ───
  const rows = useMemo(() => {
    const result: Array<{ kind: "day"; label: string; key: string } | { kind: "msg"; m: ChannelMessage; head: boolean }> = [];
    let lastDay = "";
    let prev: ChannelMessage | null = null;
    for (const m of list) {
      const day = new Date(m.createdAt).toDateString();
      const newDay = day !== lastDay;
      if (newDay) { result.push({ kind: "day", label: dayLabel(m.createdAt), key: day }); lastDay = day; }
      const head = newDay || !prev || prev.userId !== m.userId || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_WINDOW_MS;
      result.push({ kind: "msg", m, head });
      prev = m;
    }
    return result;
  }, [list]);

  const Icon = channel.type === "project" ? FolderKanban : Hash;
  const displayName = channel.type === "dm" ? dmDisplayName(channel.name, user?.name) : channel.name;
  const placeholder = channel.type === "dm" ? `Message ${displayName}` : `Message #${displayName}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2 md:px-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back to conversations" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        )}
        {channel.type === "dm" ? <Avatar name={displayName} size="sm" /> : <Icon className="h-4 w-4 shrink-0 text-ink-3" />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold leading-tight text-ink">{displayName}</h2>
          <p className="hidden truncate text-[11px] leading-tight text-ink-3 sm:block">{channelKindLabel(channel.type)}</p>
        </div>
        <MembersPopover channel={channel} isAdmin={isAdmin} currentUserId={user.id} />
        {canDelete && (
          <Button variant="ghost" size="icon-sm" aria-label={channel.type === "dm" ? "Delete conversation" : "Delete channel"} title={channel.type === "dm" ? "Delete conversation" : "Delete channel"}
            className="text-ink-3 hover:text-danger hover:bg-danger-soft" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto scroll-thin px-1 py-3 md:px-2" role="log" aria-live="polite" aria-label={`Messages in ${displayName}`}>
          {messages.isLoading ? (
            <MessageSkeleton />
          ) : messages.error ? (
            <ErrorState title="Couldn't load messages" message={(messages.error as Error).message} onRetry={() => messages.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={channel.type === "dm" ? <Users /> : <Icon />}
              title={channel.type === "dm" ? `This is the start of your conversation with ${displayName}` : `Welcome to #${channel.name}`}
              description={channel.type === "general" ? "Everyone in the workspace is here. Say hello, share links, ask questions." : channel.type === "project" ? "Project updates and questions live here. Only people on the project can see it." : channel.type === "dm" ? "Messages here are private to the two of you." : "Only the members of this channel can see what's posted here."}
            />
          ) : (
            rows.map((r) =>
              r.kind === "day" ? (
                <div key={r.key} className="my-3 flex items-center gap-3 px-3" role="separator" aria-label={r.label}>
                  <div className="h-px flex-1 bg-line" />
                  <span className="t-label text-[10px]">{r.label}</span>
                  <div className="h-px flex-1 bg-line" />
                </div>
              ) : (
                <MessageRow key={r.m.id} m={r.m} head={r.head} mine={r.m.userId === user.id} />
              ),
            )
          )}
        </div>

        {newCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button type="button" onClick={() => scrollToBottom(true)}
              className="pointer-events-auto anim-pop inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[12.5px] font-medium text-accent-ink pop">
              <span className="t-num">{newCount}</span> new {newCount === 1 ? "message" : "messages"} <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer value={draft} onChange={setDraft} onSubmit={submit} placeholder={placeholder} channelId={channel.id} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={channel.type === "dm" ? "Delete this conversation?" : `Delete #${channel.name}?`}
        description={channel.type === "dm" ? `Every message between you and ${displayName} is permanently removed for both of you.` : "The channel and every message in it are permanently removed for all members."}
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

function MessageRow({ m, head, mine }: { m: ChannelMessage; head: boolean; mine: boolean }) {
  const time = formatTime(m.createdAt);
  return (
    <div className={cn("group relative flex gap-3 rounded-md px-2 transition-colors hover:bg-surface-2/80 md:px-3", head ? "mt-2.5 py-1" : "py-px", m.pending && "opacity-60")}>
      {head ? (
        <Avatar name={m.userName} size="md" className="mt-0.5" />
      ) : (
        <div className="w-8 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        {head && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="text-[13px] font-semibold text-ink">{mine ? "You" : m.userName}</span>
            {m.userRole === "system" && <Pill tone="pulse" className="translate-y-px">Pulse</Pill>}
            <time dateTime={m.createdAt} className="t-num text-[11px] text-ink-3">{time}</time>
            {m.pending && <span className="text-[11px] text-ink-4">Sending…</span>}
          </div>
        )}
        <p className={cn("whitespace-pre-wrap break-words text-[13.5px] leading-[1.55] text-ink-2", !head && "pr-14")}>{m.content}</p>
      </div>
      {!head && (
        <time dateTime={m.createdAt} className="t-num absolute right-3 top-0.5 text-[10.5px] text-ink-4 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          {m.pending ? "Sending…" : time}
        </time>
      )}
    </div>
  );
}

function Composer({ value, onChange, onSubmit, placeholder, channelId }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; channelId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow between one and ~six lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => { ref.current?.focus(); }, [channelId]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit(); }
  };

  const canSend = value.trim().length > 0;
  return (
    <form className="shrink-0 border-t border-line bg-surface px-3 py-2.5 md:px-4 md:py-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={1}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-[16px] leading-6 text-ink outline-none placeholder:text-ink-4 md:text-[13.5px]"
        />
        <Button type="submit" size="icon-sm" aria-label="Send message" disabled={!canSend} className="shrink-0 rounded-md"><Send className="h-4 w-4" /></Button>
      </div>
      <p className="mt-1.5 hidden text-[11px] text-ink-4 md:block">Enter to send · Shift+Enter for a new line</p>
    </form>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-5 px-3 pt-2" aria-busy aria-label="Loading messages">
      {[3, 1, 2, 1].map((lines, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="flex items-center gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-10" /></div>
            {Array.from({ length: lines }).map((_, j) => <Skeleton key={j} className={cn("h-3.5", j % 2 ? "w-2/5" : "w-4/5")} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Members ───
function MembersPopover({ channel, isAdmin, currentUserId }: { channel: Channel; isAdmin: boolean; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = isAdmin && channel.type === "custom";

  const members = useQuery<ChannelMember[]>({ queryKey: membersKey(channel.id), enabled: open });
  const users = useQuery<CompanyUser[]>({ queryKey: ["/api/company/users"], enabled: open && adding });

  const invalidate = () => { qc.invalidateQueries({ queryKey: membersKey(channel.id) }); qc.invalidateQueries({ queryKey: CHANNELS_KEY }); };
  const add = useMutation({
    mutationFn: (userId: string) => api("POST", `/api/channels/${channel.id}/members`, { userId }),
    onSuccess: invalidate,
    onError: (err: Error) => toast({ title: "Couldn't add member", description: err.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api("DELETE", `/api/channels/${channel.id}/members/${userId}`),
    onSuccess: invalidate,
    onError: (err: Error) => toast({ title: "Couldn't remove member", description: err.message, variant: "destructive" }),
  });

  const memberIds = new Set((members.data ?? []).map((m) => m.userId));
  const candidates = (users.data ?? [])
    .filter((u) => u.role !== "system" && !memberIds.has(u.id))
    .filter((u) => !q.trim() || u.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setAdding(false); setQ(""); } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Members" title="Members" className="gap-1.5 px-2 text-ink-3 hover:text-ink">
          <Users className="h-4 w-4" />
          {members.data && <span className="t-num hidden text-[12px] sm:inline">{members.data.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 border-line bg-surface-raised p-0 pop">
        <div className="flex items-center justify-between px-3 py-2 hairline-b">
          <span className="t-label">{adding ? "Add people" : "Members"}</span>
          {canManage && (
            <Button variant="ghost" size="xs" onClick={() => setAdding((a) => !a)} aria-label={adding ? "Back to members" : "Add people"}>
              {adding ? "Done" : <><UserPlus className="h-3.5 w-3.5" />Add</>}
            </Button>
          )}
        </div>
        {adding ? (
          <div>
            <div className="relative px-2 pt-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 mt-1 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-8 pl-8 md:text-[13px]" autoFocus aria-label="Search people to add" />
            </div>
            <ul className="max-h-64 overflow-y-auto scroll-thin py-1">
              {users.isLoading ? <li className="px-3 py-3 text-[12.5px] text-ink-3">Loading…</li>
                : users.error ? <li className="px-3 py-3 text-[12.5px] text-danger">{(users.error as Error).message}</li>
                : candidates.length === 0 ? <li className="px-3 py-3 text-[12.5px] text-ink-3">{q ? "No one matches." : "Everyone's already here."}</li>
                : candidates.map((u) => (
                  <li key={u.id}>
                    <button type="button" disabled={add.isPending} onClick={() => add.mutate(u.id)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left row-hover disabled:opacity-60">
                      <Avatar name={u.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{u.name}</span>
                      <UserPlus className="h-3.5 w-3.5 text-ink-4" />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto scroll-thin py-1">
            {members.isLoading ? (
              <li className="space-y-2 px-3 py-2">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-2"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-3 flex-1" /></div>)}</li>
            ) : members.error ? (
              <li className="px-3 py-3 text-[12.5px] text-danger">{(members.error as Error).message}</li>
            ) : (members.data ?? []).length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-ink-3">No members yet.</li>
            ) : (
              (members.data ?? []).map((m) => (
                <li key={m.id} className="group flex items-center gap-2.5 px-3 py-1.5">
                  <Avatar name={m.userName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{m.userName}{m.userId === currentUserId && <span className="text-ink-4"> (you)</span>}</span>
                    <span className="block text-[11px] text-ink-3">{roleLabel(m.userRole)}</span>
                  </span>
                  {canManage && m.userId !== currentUserId && (
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove ${m.userName}`} title="Remove" disabled={remove.isPending} className="text-ink-4 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" onClick={() => remove.mutate(m.userId)}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
