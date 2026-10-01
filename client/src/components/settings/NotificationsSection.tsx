import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ErrorState } from "@/components/kit";
import { type Me, ME_KEY, Group, Row, RowsSkeleton, SectionHeader, Toggle } from "./primitives";

export function NotificationsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isIntern = user?.role === "intern";
  const me = useQuery<Me>({ queryKey: ME_KEY, enabled: isIntern });

  const digest = useMutation({
    mutationFn: (enabled: boolean) => api<{ morningDigestEnabled: boolean }>("PUT", "/api/settings/morning-digest", { enabled }),
    onSuccess: (data) => {
      qc.setQueryData<Me>(ME_KEY, (prev) => (prev ? { ...prev, ...data } : prev));
      toast({ title: data.morningDigestEnabled ? "Morning digest is on" : "Morning digest is off" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update digest", description: err.message, variant: "destructive" }),
  });

  const inApp = isIntern
    ? [
        "A task is assigned or reassigned to you",
        "Your submission is approved, or changes are requested",
        "A task you own is overdue or blocked",
        "Someone comments on your work or messages you",
      ]
    : [
        "An intern submits work for review",
        "A project proposal or application needs a decision",
        "A task is overdue or blocked",
        "An intern starts or ends a shift",
        "Someone messages you",
      ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Notifications" description="What InternOps tells you about, and where it shows up." />

      {isIntern && (
        <Group title="Morning digest" description="A weekday message from Pulse summarising what's due and what's blocked, delivered as a direct message in Messages.">
          {me.isLoading ? (
            <RowsSkeleton rows={1} />
          ) : me.error ? (
            <ErrorState compact message={(me.error as Error).message} onRetry={() => me.refetch()} />
          ) : (
            <Row
              label="Send me a morning digest"
              htmlFor="morning-digest"
              description="Weekdays only. Turning it off stops the message; it doesn't change what Pulse knows."
              control={<Toggle id="morning-digest" checked={!!me.data?.morningDigestEnabled} pending={digest.isPending} onCheckedChange={(v) => digest.mutate(v)} />}
            />
          )}
        </Group>
      )}

      <Group
        title={<span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-ink-3" />In the app</span>}
        description="These appear under the bell in the top bar and link straight to the item. They can't be switched off individually yet."
        footer="Nothing is sent by email. Push notifications aren't available."
      >
        <ul className="px-4 py-3 space-y-2">
          {inApp.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13px] text-ink-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-4" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Group>

      <Group title={<span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-ink-3" />Messages</span>} description="Unread conversations show a count on Messages in the sidebar. Opening a conversation marks it read.">
        <Row label="Unread badge" description="Always on — it's how the team knows something is waiting." control={<span className="text-[12.5px] text-ink-3">Built in</span>} />
      </Group>
    </div>
  );
}
