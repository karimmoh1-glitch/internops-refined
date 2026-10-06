import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2, RotateCcw, ArrowDown, Database, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, streamSSE, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTime, dayLabel } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Page, ErrorState, SkeletonRows, Avatar, Pill, PulseMarkdown, RefChip, CopyButton, ConfirmDialog, Kbd } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Msg { id: string; role: "user" | "assistant"; content: string; aiGenerated: boolean; references: { type: string; id: string; label: string }[]; createdAt: string; pending?: boolean; error?: string }
interface Suggestion { label: string; prompt: string }

export default function PulsePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const params = new URLSearchParams(useSearch());
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const history = useQuery<Msg[]>({ queryKey: ["/api/pulse/history"] });
  const suggestions = useQuery<{ suggestions: Suggestion[]; aiAvailable: boolean }>({ queryKey: [`/api/pulse/suggestions?tzOffsetMinutes=${tzOffset()}`], refetchInterval: 60_000 });
  const [local, setLocal] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const askedFromUrl = useRef(false);

  const messages = useMemo(() => [...(history.data ?? []), ...local], [history.data, local]);

  const scrollToBottom = (smooth = true) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); };
  useEffect(() => { if (atBottom) scrollToBottom(false); }, [messages.length, atBottom]);
  useEffect(() => { const t = setTimeout(() => scrollToBottom(false), 50); return () => clearTimeout(t); }, [history.data]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true); setInput("");
    const tempUser = `u-${Date.now()}`, tempBot = `a-${Date.now()}`;
    setLocal((l) => [...l, { id: tempUser, role: "user", content: q, aiGenerated: false, references: [], createdAt: new Date().toISOString() }, { id: tempBot, role: "assistant", content: "", aiGenerated: false, references: [], createdAt: new Date().toISOString(), pending: true }]);
    setAtBottom(true);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      await streamSSE("/api/pulse/ask", { question: q, tzOffsetMinutes: tzOffset() }, (event, data) => {
        if (event === "accepted") setLocal((l) => l.map((m) => (m.id === tempUser ? { ...data.message } : m)));
        else if (event === "delta") setLocal((l) => l.map((m) => (m.id === tempBot ? { ...m, content: m.content + data.text, aiGenerated: true } : m)));
        else if (event === "done") setLocal((l) => l.map((m) => (m.id === tempBot ? { ...data.message, pending: false } : m.id === tempUser ? m : m)));
        else if (event === "error") setLocal((l) => l.map((m) => (m.id === tempBot ? { ...m, pending: false, error: data.message } : m)));
      }, ac.signal);
    } catch (e) {
      setLocal((l) => l.map((m) => (m.id === tempBot ? { ...m, pending: false, error: (e as Error).message } : m)));
    } finally {
      setBusy(false); abortRef.current = null;
      qc.invalidateQueries({ queryKey: [`/api/pulse/suggestions?tzOffsetMinutes=${tzOffset()}`] });
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q && !askedFromUrl.current && history.isSuccess) { askedFromUrl.current = true; setLocation("/pulse", { replace: true }); void ask(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.isSuccess]);

  const clear = async () => {
    try { await api("DELETE", "/api/pulse/history"); setLocal([]); qc.setQueryData(["/api/pulse/history"], []); setConfirmClear(false); }
    catch (e) { toast({ title: "Couldn't clear", description: (e as Error).message, variant: "destructive" }); }
  };
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const aiAvailable = suggestions.data?.aiAvailable ?? false;

  return (
    <Page className="pb-0 md:pb-0">
      <div className="flex h-[calc(100dvh-56px-56px)] md:h-[calc(100dvh-56px)] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-pulse-soft text-pulse"><Sparkles className="h-4 w-4" /></span>
            <div><h1 className="t-page leading-tight">Pulse</h1><p className="text-xs text-ink-3">{isAdmin ? "Answers from your team's real tasks, sessions, and signals." : "Answers from your own tasks, sessions, and feedback."}{" "}{aiAvailable ? <Pill tone="pulse" className="ml-1 text-[11px]"><Bot className="h-3 w-3" />AI</Pill> : <Pill tone="neutral" className="ml-1 text-[11px]"><Database className="h-3 w-3" />Data lookups</Pill>}</p></div>
          </div>
          {messages.length > 0 && <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}><Trash2 className="h-3.5 w-3.5" />Clear</Button>}
        </header>

        <div ref={listRef} onScroll={(e) => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40); }} className="relative flex-1 overflow-y-auto scroll-thin rounded-lg border border-line bg-surface">
          {history.isLoading ? <div className="p-6"><SkeletonRows rows={4} /></div>
            : history.error ? <ErrorState message={(history.error as Error).message} onRetry={() => history.refetch()} />
            : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-soft text-pulse"><Sparkles className="h-6 w-6" /></span>
                <h2 className="text-[15px] font-semibold text-ink">Ask about what's actually happening</h2>
                <p className="mt-1 max-w-md text-[13px] text-ink-3">Pulse reads the workspace's recorded data and answers with links to the exact tasks, people, and sessions. It says so when something isn't recorded.</p>
                {suggestions.data && suggestions.data.suggestions.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">{suggestions.data.suggestions.map((s) => <button key={s.prompt} onClick={() => ask(s.prompt)} className="rounded-md border border-line bg-surface px-3 h-8 text-[13px] text-ink hover:border-pulse/40 hover:bg-pulse-soft/40 transition-colors">{s.label}</button>)}</div>
                )}
              </div>
            ) : (
              <ol className="divide-y divide-line">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
                  return (
                    <li key={m.id}>
                      {newDay && <div className="px-4 pt-3 pb-1 t-label">{dayLabel(m.createdAt)}</div>}
                      <div className={cn("group flex gap-3 px-4 py-3.5", m.role === "assistant" && "bg-surface-2/40")}>
                        {m.role === "user" ? <Avatar name={user?.name ?? "?"} size="sm" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-pulse-soft text-pulse"><Sparkles className="h-3.5 w-3.5" /></span>}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-ink-3"><span className="font-medium text-ink-2">{m.role === "user" ? "You" : "Pulse"}</span><span className="t-num">{formatTime(m.createdAt)}</span>{m.role === "assistant" && !m.pending && !m.error && <span>· {m.aiGenerated ? "AI-written from recorded data" : "Data lookup"}</span>}</div>
                          <div className="mt-1">
                            {m.role === "user" ? <p className="text-[13.5px] text-ink whitespace-pre-wrap">{m.content}</p>
                              : m.error ? <p className="text-[13px] text-danger">{m.error}</p>
                              : m.pending && !m.content ? <span className="inline-flex items-center gap-1 text-ink-4"><span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse" /><span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse [animation-delay:150ms]" /><span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse [animation-delay:300ms]" /></span>
                              : <PulseMarkdown text={m.content} streaming={!!m.pending} />}
                          </div>
                          {m.role === "assistant" && !m.pending && m.references.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.references.slice(0, 8).map((r) => <RefChip key={`${r.type}-${r.id}`} type={r.type} id={r.id} label={r.label} />)}</div>}
                          {m.role === "assistant" && !m.pending && !m.error && <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"><CopyButton value={m.content.replace(/\[\[(?:[a-z]+):[^|]+\|([^\]]+)\]\]/g, "$1")} size="xs" /></div>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          {!atBottom && messages.length > 0 && <button onClick={() => { setAtBottom(true); scrollToBottom(); }} className="sticky bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-line bg-surface-raised px-3 h-7 text-xs text-ink pop" aria-label="Scroll to latest"><ArrowDown className="h-3 w-3" />Latest</button>}
        </div>

        <div className="py-3">
          {messages.length > 0 && suggestions.data && suggestions.data.suggestions.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto scroll-thin pb-1">{suggestions.data.suggestions.slice(0, 5).map((s) => <button key={s.prompt} onClick={() => ask(s.prompt)} disabled={busy} className="shrink-0 rounded-md border border-line bg-surface px-2.5 h-7 text-xs text-ink-2 hover:border-pulse/40 hover:text-ink disabled:opacity-50">{s.label}</button>)}</div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface p-2 focus-within:border-pulse focus-within:ring-2 focus-within:ring-pulse/20">
            <label htmlFor="pulse-input" className="sr-only">Ask Pulse</label>
            <Textarea id="pulse-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }} rows={1} placeholder={isAdmin ? "Who is working right now? What changed today?" : "What should I do next? What's due soon?"} className="min-h-[36px] max-h-32 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-0 px-1.5" />
            {lastUser && !busy && <Button type="button" variant="ghost" size="icon-sm" aria-label="Ask the last question again" onClick={() => ask(lastUser.content)}><RotateCcw className="h-4 w-4" /></Button>}
            <Button type="submit" variant="pulse" size="icon-sm" aria-label="Send" disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
          </form>
          <p className="mt-1.5 hidden md:flex items-center gap-1 text-[11px] text-ink-4"><Kbd>↵</Kbd> send · <Kbd>⇧↵</Kbd> newline · answers only come from recorded data</p>
        </div>
      </div>
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} title="Clear this conversation?" description="Your Pulse history is deleted. Nothing else changes." confirmLabel="Clear" destructive onConfirm={clear} />
    </Page>
  );
}

