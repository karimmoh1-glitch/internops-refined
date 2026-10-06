import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, Flame, Layers, RotateCcw, Scale, Send, Shield, Shuffle, Sparkles, Target, ThumbsDown, Trash2, TrendingUp, Zap } from "lucide-react";
import { api, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog, PulseMarkdown, Segmented } from "@/components/kit";
import { invalidateProject } from "./dialogs";

type ChatMode = "brainstorm" | "plan";
interface ChatMessage { role: "user" | "assistant"; content: string }

// Port of the legacy UnifiedAIChat. The [ACTION:...] contract with
// /api/ai/chat and /api/ai/action is preserved byte-for-byte: the model
// emits tags, the client strips them and calls the action endpoint.
export function UnifiedAIChat({ projectId, projectStatus, hasPlan, minimumHours, onRefresh, className }: {
  projectId: string; projectStatus: string; hasPlan: boolean; minimumHours: number; onRefresh?: () => void; className?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  // The server says whether an AI key is configured. Without one the mentor
  // can only return its connection-error line, so say so up front instead
  // of letting the welcome message promise a conversation that can't happen.
  const availability = useQuery<{ aiAvailable: boolean }>({ queryKey: [`/api/pulse/suggestions?tzOffsetMinutes=${tzOffset()}`], staleTime: 5 * 60_000 });
  const aiUnavailable = availability.data?.aiAvailable === false;

  const brainstormWelcome = () => `I'm your brainstorming partner. Let's explore ideas for this project.\n\nWe can:\n- Challenge assumptions and flip ideas around\n- Weigh pros and cons of different approaches\n- Break down hard problems with analogies\n- Explore technologies, architectures, and edge cases\n\nTry a starter below, hit Spark for a random prompt, or just start typing.`;
  const planWelcome = () => {
    if (!hasPlan && (projectStatus === "assigned" || projectStatus === "planning")) {
      return `I'm your project mentor. Let's build a solid plan.\n\nStart with your schedule:\n- How many hours per day can you work?\n- How many days per week?\n- How many weeks do you want to spread this over?\n${minimumHours ? `\nYour manager requires at least ${minimumHours} hours in total. I'll make sure we hit that.\n` : ""}\nI'll turn that into weekly milestones with buffer time and dependencies.`;
    }
    if (hasPlan && projectStatus === "active") return "Your plan is approved and you're in execution. I can help you track progress against milestones, flag pacing concerns, or suggest adjustments. How is it going?";
    if (projectStatus === "planning") return "Your manager may have sent feedback on your plan. I can help you understand what they're looking for and make the changes. Use the quick actions or tell me what to adjust.";
    return "I'm your mentor. I can help you create, refine, or restructure your project plan, flag risks, and suggest best practices. What do you need?";
  };

  const defaultMode: ChatMode = !hasPlan && (projectStatus === "assigned" || projectStatus === "planning") ? "brainstorm" : "plan";
  const [mode, setMode] = useState<ChatMode>(defaultMode);
  const [brainstormMessages, setBrainstormMessages] = useState<ChatMessage[]>([{ role: "assistant", content: brainstormWelcome() }]);
  const [planMessages, setPlanMessages] = useState<ChatMessage[]>([{ role: "assistant", content: planWelcome() }]);
  const messages = mode === "brainstorm" ? brainstormMessages : planMessages;
  const setMessages = mode === "brainstorm" ? setBrainstormMessages : setPlanMessages;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sparkLoading, setSparkLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Persisted history per mode, prefixed with the welcome message.
  useEffect(() => {
    let cancelled = false;
    const load = async (m: ChatMode) => {
      try {
        const data = await api<{ messages: ChatMessage[] }>("GET", `/api/ai/chat-history/${projectId}/${m}`);
        if (cancelled || !data.messages?.length) return;
        const setter = m === "brainstorm" ? setBrainstormMessages : setPlanMessages;
        setter([{ role: "assistant", content: m === "brainstorm" ? brainstormWelcome() : planWelcome() }, ...data.messages]);
      } catch { /* welcome only */ }
    };
    void load("brainstorm"); void load("plan");
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, sending]);

  const refresh = () => { invalidateProject(qc, projectId); onRefresh?.(); };

  const executeAction = async (action: "generate_plan" | "modify_plan" | "delete_plan", instruction?: string, params?: { hoursPerDay?: number; daysPerWeek?: number; numberOfWeeks?: number }) => {
    try {
      const body: Record<string, unknown> = { projectId, action };
      if (instruction) body.instruction = instruction;
      if (action === "generate_plan") {
        body.hoursPerDay = params?.hoursPerDay || 4;
        body.daysPerWeek = params?.daysPerWeek || 5;
        body.numberOfWeeks = params?.numberOfWeeks || 8;
      }
      const data = await api<{ success?: boolean }>("POST", "/api/ai/action", body);
      if (data.success) { refresh(); return true; }
      return false;
    } catch (err) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "destructive" });
      return false;
    }
  };

  const sendMessage = async (override?: string) => {
    const userMsg = (override ?? input).trim();
    if (!userMsg || sending) return;
    if (!override) setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(next);
    setSending(true);
    try {
      const data = await api<{ response: string }>("POST", "/api/ai/chat", { projectId, messages: next.map((m) => ({ role: m.role, content: m.content })), mode });
      let response: string = data.response ?? "";

      const modifyMatch = response.match(/\[ACTION:MODIFY_PLAN\]\s*([\s\S]*?)(?:\[|$)/);
      const generateMatch = response.match(/\[ACTION:GENERATE_PLAN(?::(\d+),(\d+),(\d+))?\]/);
      const deleteMatch = response.match(/\[ACTION:DELETE_PLAN\]/);

      if (modifyMatch) {
        const instruction = modifyMatch[1]?.trim() || userMsg;
        await executeAction("modify_plan", instruction);
        response = response.replace(/\[ACTION:MODIFY_PLAN\][\s\S]*?(?:\[|$)/, "").trim();
        if (!response) response = "Done. I've updated your plan — the changes are in the plan panel.";
        toast({ title: "Plan modified", description: "Your draft has been updated." });
      } else if (generateMatch) {
        const params = {
          hoursPerDay: generateMatch[1] ? parseInt(generateMatch[1]) : 4,
          daysPerWeek: generateMatch[2] ? parseInt(generateMatch[2]) : 5,
          numberOfWeeks: generateMatch[3] ? parseInt(generateMatch[3]) : 8,
        };
        await executeAction("generate_plan", undefined, params);
        response = response.replace(/\[ACTION:GENERATE_PLAN(?::\d+,\d+,\d+)?\]/g, "").trim();
        if (!response) response = "I've generated your plan. It's in the plan panel — tell me if you'd like to adjust anything.";
        toast({ title: "Plan generated", description: "Your draft is ready to review." });
      } else if (deleteMatch) {
        await executeAction("delete_plan");
        response = response.replace(/\[ACTION:DELETE_PLAN\]/g, "").trim();
        if (!response) response = "Plan deleted. Tell me your schedule and I'll draft a new one.";
        toast({ title: "Plan deleted", description: "You can start fresh." });
      }
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      toast({ title: "The mentor didn't answer", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const spark = async () => {
    if (sparkLoading || sending) return;
    setSparkLoading(true);
    try {
      const data = await api<{ spark?: string }>("POST", "/api/ai/spark", { projectId });
      if (data.spark) await sendMessage(data.spark);
    } catch (err) {
      toast({ title: "Spark failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSparkLoading(false); }
  };

  const clearHistory = async () => {
    try {
      await api("DELETE", `/api/ai/chat-history/${projectId}/${mode}`);
      setMessages([{ role: "assistant", content: mode === "brainstorm" ? brainstormWelcome() : planWelcome() }]);
      setConfirmClear(false);
      toast({ title: "Conversation cleared" });
    } catch (err) {
      toast({ title: "Couldn't clear conversation", description: (err as Error).message, variant: "destructive" });
    }
  };

  const starters = [
    { label: "Challenge my idea", Icon: ThumbsDown, prompt: "Play devil's advocate with my project idea. What are the weaknesses, risks, and things I haven't thought of?" },
    { label: "Flip it", Icon: Shuffle, prompt: "What if we approached this project from the completely opposite direction? Explore reverse or contrarian approaches." },
    { label: "Surprise me", Icon: Flame, prompt: "Give me a completely unexpected, creative suggestion for my project that I probably haven't considered." },
    { label: "Pros & cons", Icon: Scale, prompt: "Give me a structured pros and cons analysis of my current project approach." },
    { label: "Architect it", Icon: Building2, prompt: "Help me think through the technical architecture for this project. What components, services, and data flows should I consider?" },
    { label: "Alternatives", Icon: Layers, prompt: "What are some completely different technologies, frameworks, or approaches I could use for this project?" },
  ];

  const quickActions = [
    ...(!hasPlan ? [{ label: "Generate plan", Icon: Sparkles, run: async () => {
      setMessages((prev) => [...prev, { role: "user", content: "Generate a plan for my project" }, { role: "assistant", content: "Drafting a plan for your project…" }]);
      const ok = await executeAction("generate_plan");
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: ok ? "Your plan is ready — it's in the plan panel. Ask me to change weeks, adjust hours, update deliverables, or restructure anything." : "I couldn't generate a plan just now. Try again, or use the Generate button above the plan." };
        return copy;
      });
    } }] : []),
    ...(hasPlan ? [
      { label: "Review plan", Icon: Shield, run: () => sendMessage("Review my plan critically — flag any risks, unrealistic time estimates, missing dependencies, or areas that need more thought.") },
      { label: "Optimize hours", Icon: TrendingUp, run: () => sendMessage("Analyze my hour allocations across all weeks. Am I spending too much or too little time on any particular week? Where should I add buffer time?") },
      { label: "Best practices", Icon: BookOpen, run: () => sendMessage("What industry best practices should I apply to my current plan? Are there patterns from real production teams I should follow?") },
      { label: "Start over", Icon: RotateCcw, run: async () => setConfirmReset(true) },
    ] : []),
  ];

  const startOver = async () => {
    setConfirmReset(false);
    setMessages((prev) => [...prev, { role: "user", content: "Delete my plan and start over" }, { role: "assistant", content: "Deleting your plan…" }]);
    const ok = await executeAction("delete_plan");
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { role: "assistant", content: ok ? "Plan deleted. Tell me your schedule (hours per day, days per week, number of weeks) and I'll draft a new one." : "I couldn't delete the plan. It may already be submitted or approved." };
      return copy;
    });
  };

  const fresh = messages.length <= 2;

  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)} aria-label="AI mentor">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 hairline-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pulse-soft text-pulse">{mode === "brainstorm" ? <Zap className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}</span>
          <h3 className="t-section truncate">{mode === "brainstorm" ? "Brainstorm" : "Mentor"}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Segmented value={mode} onChange={(m) => { if (!sending) setMode(m); }} options={[{ value: "brainstorm", label: "Ideas" }, { value: "plan", label: "Plan" }]} />
          <Button variant="ghost" size="icon-xs" aria-label="Clear this conversation" onClick={() => setConfirmClear(true)} disabled={sending || fresh}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-3 py-3 space-y-3" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="max-w-[88%] rounded-lg rounded-br-sm bg-accent px-3 py-2 text-[13px] leading-relaxed text-accent-ink whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-surface-2 px-3 py-2"><PulseMarkdown text={m.content} className="text-[13px]" /></div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex justify-start"><div className="rounded-lg rounded-bl-sm border border-line bg-surface-2 px-3 py-2 text-xs text-pulse caret">{mode === "brainstorm" ? "Thinking" : "Working on it"}</div></div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-2.5 space-y-2">
        {aiUnavailable && (
          <p className="rounded-md border border-warn/25 bg-warn-soft/60 px-2.5 py-1.5 text-xs text-ink-2" role="status">No AI key is configured on this server, so the mentor can't answer messages. Plan drafts are still generated from a template.</p>
        )}
        {mode === "brainstorm" && fresh && (
          <div className="flex flex-wrap gap-1.5">
            {starters.map((s) => (
              <button key={s.label} type="button" onClick={() => sendMessage(s.prompt)} disabled={sending} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 h-7 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50 transition-colors">
                <s.Icon className="h-3 w-3 text-pulse" />{s.label}
              </button>
            ))}
          </div>
        )}
        {mode === "plan" && quickActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((q) => (
              <button key={q.label} type="button" onClick={() => void q.run()} disabled={sending} className="inline-flex items-center gap-1 rounded-md bg-pulse-soft px-2 h-7 text-xs font-medium text-pulse hover:brightness-95 disabled:opacity-50 transition-[filter]">
                <q.Icon className="h-3 w-3" />{q.label}
              </button>
            ))}
          </div>
        )}
        <form className="flex items-end gap-1.5" onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}>
          {mode === "brainstorm" && (
            <Button type="button" variant="outline" size="icon" aria-label="Spark a random creative prompt" title="Spark" onClick={spark} disabled={sparkLoading || sending} className="shrink-0 text-pulse"><Zap className="h-4 w-4" /></Button>
          )}
          <Textarea
            aria-label="Message the mentor"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
            rows={1}
            placeholder={mode === "brainstorm" ? "Share an idea, explore an approach…" : "Ask about planning, scope, or pacing…"}
            className="min-h-[36px] max-h-32 resize-none py-2"
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim() || sending} className="shrink-0"><Send className="h-4 w-4" /></Button>
        </form>
      </div>

      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Delete your plan and start over?" description="Every version of this plan is removed and the project goes back to Assigned. Submitted or approved plans can't be deleted." confirmLabel="Delete plan" destructive onConfirm={startOver} />
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} title={`Clear the ${mode === "brainstorm" ? "brainstorm" : "mentor"} conversation?`} description="Messages are removed from the server. Your plan is not affected." confirmLabel="Clear" destructive onConfirm={clearHistory} />
    </div>
  );
}
