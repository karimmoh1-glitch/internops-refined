import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Hash, PenSquare, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/kit";
import { ChannelRail } from "@/components/messages/ChannelRail";
import { Conversation } from "@/components/messages/Conversation";
import { NewMessageDialog } from "@/components/messages/NewMessageDialog";
import { CreateChannelDialog } from "@/components/messages/CreateChannelDialog";
import { type Channel, CHANNELS_KEY, UNREAD_KEY, channelHref, usePageVisible } from "@/components/messages/types";

// /messages           → rail (mobile) / rail + "pick a conversation" (desktop)
// /messages/:id       → that conversation
// /messages?userId=X  → opens (or creates) the DM with X, then replaces the URL
export default function MessagesPage({ channelId }: { channelId?: string }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const qc = useQueryClient();
  const { toast } = useToast();
  const visible = usePageVisible();

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const channels = useQuery<Channel[]>({ queryKey: CHANNELS_KEY, refetchInterval: visible ? 10_000 : false, refetchIntervalInBackground: false });

  const openDM = useMutation({
    mutationFn: (targetUserId: string) => api<Channel>("POST", "/api/channels/dm", { targetUserId }),
    onSuccess: (channel) => {
      // Seed the list so the conversation renders the moment we navigate,
      // instead of flashing "not found" for one network round trip.
      qc.setQueryData<Channel[]>(CHANNELS_KEY, (old) => old && !old.some((c) => c.id === channel.id) ? [...old, { ...channel, unreadCount: channel.unreadCount ?? 0 }] : old);
      qc.invalidateQueries({ queryKey: CHANNELS_KEY });
      setNewMessageOpen(false);
      setLocation(channelHref(channel.id), { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't open conversation", description: err.message, variant: "destructive" }),
  });

  // ?userId= deep link (from a person's profile, a task, a notification…)
  const userIdParam = new URLSearchParams(search).get("userId");
  const handledUserIdRef = useRef<string | null>(null);
  const { mutate: openDMWith } = openDM;
  const selfId = user?.id;
  useEffect(() => {
    if (!userIdParam || handledUserIdRef.current === userIdParam) return;
    handledUserIdRef.current = userIdParam;
    if (userIdParam === selfId) { setLocation("/messages", { replace: true }); return; }
    openDMWith(userIdParam);
  }, [userIdParam, selfId, setLocation, openDMWith]);

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const list = channels.data ?? [];
  const active = channelId ? list.find((c) => c.id === channelId) ?? null : null;
  const general = list.find((c) => c.type === "general");
  const showingConversation = !!channelId;

  const afterDeleted = () => {
    qc.invalidateQueries({ queryKey: UNREAD_KEY });
    setLocation("/messages");
  };

  return (
    <div className="flex h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] overflow-hidden md:h-[calc(100dvh-3.5rem)]">
      <aside className={cn("flex w-full min-w-0 flex-col border-line bg-bg-sunken/40 md:w-[264px] md:shrink-0 md:border-r", showingConversation && "hidden md:flex")} aria-label="Conversations">
        <ChannelRail
          channels={list}
          activeId={channelId ?? null}
          isLoading={channels.isLoading}
          error={channels.error}
          onRetry={() => channels.refetch()}
          onNewMessage={() => setNewMessageOpen(true)}
          onNewChannel={() => setCreateOpen(true)}
          isAdmin={isAdmin}
        />
      </aside>

      <section className={cn("flex min-w-0 flex-1 flex-col", !showingConversation && "hidden md:flex")} aria-label="Conversation">
        {!channelId ? (
          openDM.isPending ? (
            <ConversationPlaceholder label="Opening conversation…" />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface">
              <EmptyState
                icon={<MessageSquare />}
                title="Pick a conversation"
                description="Channels keep the whole team in the loop. Direct messages are private between you and one person. Unread counts clear as soon as you open a conversation."
                action={
                  <>
                    {general && <Button asChild variant="outline" size="sm"><Link href={channelHref(general.id)}><Hash className="h-3.5 w-3.5" />Open #{general.name}</Link></Button>}
                    <Button size="sm" onClick={() => setNewMessageOpen(true)}><PenSquare className="h-3.5 w-3.5" />New message</Button>
                  </>
                }
              />
            </div>
          )
        ) : channels.isLoading ? (
          <ConversationPlaceholder />
        ) : channels.error ? (
          <div className="flex h-full items-center justify-center bg-surface">
            <EmptyState icon={<MessageSquare />} title="Couldn't load this conversation" description={(channels.error as Error).message} action={<Button variant="outline" size="sm" onClick={() => channels.refetch()}>Try again</Button>} />
          </div>
        ) : !active ? (
          <div className="flex h-full items-center justify-center bg-surface">
            <EmptyState
              icon={<MessageSquare />}
              title="Conversation not found"
              description="It may have been deleted, or you're no longer a member."
              action={<Button asChild variant="outline" size="sm"><Link href="/messages"><ArrowLeft className="h-3.5 w-3.5" />All conversations</Link></Button>}
            />
          </div>
        ) : (
          <Conversation key={active.id} channel={active} user={user} onBack={() => setLocation("/messages")} onDeleted={afterDeleted} />
        )}
      </section>

      <NewMessageDialog open={newMessageOpen} onOpenChange={setNewMessageOpen} currentUserId={user.id} onPick={(id) => openDM.mutate(id)} pending={openDM.isPending} />
      {isAdmin && <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} currentUserId={user.id} onCreated={(c) => setLocation(channelHref(c.id))} />}
    </div>
  );
}

function ConversationPlaceholder({ label = "Loading conversation" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col bg-surface" aria-busy aria-label={label}>
      <div className="flex h-12 items-center gap-2 border-b border-line px-4"><Skeleton className="h-4 w-4 rounded-full" /><Skeleton className="h-3.5 w-32" /></div>
      <div className="flex-1 space-y-5 px-4 pt-4">
        {[3, 1, 2].map((lines, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: lines }).map((_, j) => <Skeleton key={j} className={cn("h-3.5", j % 2 ? "w-2/5" : "w-3/5")} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3"><Skeleton className="h-10 w-full rounded-lg" /></div>
    </div>
  );
}
