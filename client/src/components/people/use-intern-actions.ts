import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { invalidatePeople } from "./types";

export interface InternRef { id: string; name: string }

// Every account-level mutation an admin can run on an intern, with the
// same toasts and cache invalidation wherever it is triggered from (roster
// row menu, profile header). Each returns the mutation so callers can
// await `mutateAsync` inside a confirm dialog.
export function useInternActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fail = (title: string) => (err: Error) => toast({ title, description: err.message, variant: "destructive" });
  const refresh = (extra: string[] = []) => invalidatePeople(qc, extra);

  const deactivate = useMutation({
    mutationFn: (i: InternRef) => api("POST", `/api/interns/${i.id}/deactivate`),
    onSuccess: (_d, i) => { refresh(["/api/tasks", "/api/signals"]); toast({ title: "Account deactivated", description: `${i.name} can no longer sign in. Tasks and history are kept.` }); },
    onError: fail("Couldn't deactivate"),
  });

  const reactivate = useMutation({
    mutationFn: (i: InternRef) => api("POST", `/api/interns/${i.id}/reactivate`),
    onSuccess: (_d, i) => { refresh(); toast({ title: "Account reactivated", description: `${i.name} can sign in again.` }); },
    onError: fail("Couldn't reactivate"),
  });

  const promote = useMutation({
    mutationFn: (i: InternRef) => api("POST", `/api/interns/${i.id}/promote`),
    onSuccess: (_d, i) => { refresh(["/api/tasks", "/api/signals"]); toast({ title: "Promoted to manager", description: `${i.name} now has full manager access.` }); },
    onError: fail("Couldn't promote"),
  });

  const remove = useMutation({
    mutationFn: (i: InternRef) => api<{ message: string }>("DELETE", `/api/interns/${i.id}`),
    onSuccess: (d) => { refresh(["/api/tasks", "/api/projects", "/api/signals", "/api/channels"]); toast({ title: "Account deleted", description: d?.message }); },
    onError: fail("Couldn't delete"),
  });

  const endShift = useMutation({
    mutationFn: (i: InternRef) => api("POST", `/api/interns/${i.id}/end-shift`),
    onSuccess: (_d, i) => { refresh(["/api/worktime", "/api/signals", "/api/work-sessions"]); toast({ title: "Shift ended", description: `${i.name}'s Work Mode session was closed and they were notified.` }); },
    onError: fail("Couldn't end shift"),
  });

  const reactivateAlumnus = useMutation({
    mutationFn: (i: InternRef) => api("POST", `/api/alumni/${i.id}/reactivate`),
    onSuccess: (_d, i) => { refresh(); toast({ title: "Internship reopened", description: `${i.name} is an active intern again.` }); },
    onError: fail("Couldn't reactivate"),
  });

  return { deactivate, reactivate, promote, remove, endShift, reactivateAlumnus };
}
