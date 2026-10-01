import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, tzOffset } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Every task mutation in one place so each screen invalidates the same
// set of queries and shows the same error toasts.
export function useTaskMutations(taskId?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["/api/tasks"] });
    qc.invalidateQueries({ queryKey: ["/api/tasks/mine"] });
    qc.invalidateQueries({ queryKey: [`/api/tasks/next-best?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: [`/api/overview?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: [`/api/me/overview?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: [`/api/signals?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    if (id) qc.invalidateQueries({ queryKey: [`/api/tasks/${id}/detail`] });
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/projects") });
  };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });
  const id = (override?: string) => override ?? taskId!;

  return {
    invalidate,
    start: useMutation({ mutationFn: (override?: string) => api("POST", `/api/tasks/${id(override)}/start`), onSuccess: (_d, v) => { invalidate(id(v)); toast({ title: "Task started" }); }, onError: fail("Couldn't start the task") }),
    submit: useMutation({ mutationFn: ({ id: o, submission }: { id?: string; submission: string }) => api("POST", `/api/tasks/${id(o)}/submit`, { submission }), onSuccess: (_d, v) => { invalidate(id(v.id)); toast({ title: "Submitted for review", description: "Your manager has been notified." }); }, onError: fail("Couldn't submit") }),
    block: useMutation({ mutationFn: ({ id: o, reason }: { id?: string; reason: string }) => api("POST", `/api/tasks/${id(o)}/block`, { reason }), onSuccess: (_d, v) => { invalidate(id(v.id)); toast({ title: "Marked as blocked", description: "Your manager has been notified." }); }, onError: fail("Couldn't block the task") }),
    unblock: useMutation({ mutationFn: (override?: string) => api("POST", `/api/tasks/${id(override)}/unblock`), onSuccess: (_d, v) => { invalidate(id(v)); toast({ title: "Unblocked" }); }, onError: fail("Couldn't unblock") }),
    approve: useMutation({ mutationFn: ({ id: o, feedback }: { id?: string; feedback?: string }) => api("POST", `/api/tasks/${id(o)}/approve`, { feedback }), onSuccess: (_d, v) => { invalidate(id(v.id)); toast({ title: "Approved" }); }, onError: fail("Couldn't approve") }),
    requestChanges: useMutation({ mutationFn: ({ id: o, feedback }: { id?: string; feedback: string }) => api("POST", `/api/tasks/${id(o)}/request-changes`, { feedback }), onSuccess: (_d, v) => { invalidate(id(v.id)); toast({ title: "Changes requested" }); }, onError: fail("Couldn't request changes") }),
    update: useMutation({ mutationFn: ({ id: o, data }: { id?: string; data: Record<string, unknown> }) => api("PUT", `/api/tasks/${id(o)}`, data), onSuccess: (_d, v) => { invalidate(id(v.id)); toast({ title: "Task updated" }); }, onError: fail("Couldn't update the task") }),
    remove: useMutation({ mutationFn: (override?: string) => api("DELETE", `/api/tasks/${id(override)}`), onSuccess: () => { invalidate(); toast({ title: "Task deleted" }); }, onError: fail("Couldn't delete the task") }),
    create: useMutation({ mutationFn: (data: Record<string, unknown>) => api<{ id: string }>("POST", "/api/tasks", data), onSuccess: () => { invalidate(); toast({ title: "Task created" }); }, onError: fail("Couldn't create the task") }),
    comment: useMutation({ mutationFn: ({ id: o, content }: { id?: string; content: string }) => api("POST", `/api/tasks/${id(o)}/comments`, { content }), onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [`/api/tasks/${id(v.id)}/detail`] }), onError: fail("Couldn't post your comment") }),
  };
}
