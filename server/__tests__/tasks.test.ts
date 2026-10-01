import { describe, it, expect, beforeAll } from "vitest";
import { getApp, request, resetDatabase, seedWorkspace, auth, createCompany, createUser, login } from "./helpers";

describe("task lifecycle and permissions", () => {
  let ws: Awaited<ReturnType<typeof seedWorkspace>>;
  let taskId: string;

  beforeAll(async () => {
    await resetDatabase();
    ws = await seedWorkspace();
  });

  it("admin creates a task for an intern in the same company", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({
      title: "Write the onboarding doc", assigneeId: ws.intern.id, priority: "high", dueDate: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("todo");
    taskId = res.body.id;
  });

  it("rejects an assignee from another company", async () => {
    const app = await getApp();
    const other = await createCompany("Other Co");
    const outsider = await createUser({ role: "intern", companyId: other.id });
    const res = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "x", assigneeId: outsider.id });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid priority and status values from the client", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "x", assigneeId: ws.intern.id, priority: "urgent" });
    expect(res.status).toBe(400);
  });

  it("intern cannot create tasks", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/tasks").set(auth(ws.internToken)).send({ title: "x", assigneeId: ws.intern.id });
    expect(res.status).toBe(403);
  });

  it("the assignee received a notification with a working deep link", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/notifications").set(auth(ws.internToken));
    expect(res.status).toBe(200);
    const n = res.body.find((n: any) => n.title === "New Task Assigned");
    expect(n).toBeTruthy();
    expect(n.link).toContain(taskId);
  });

  it("another intern cannot read, start, or submit this task", async () => {
    const app = await getApp();
    expect((await request(app).get(`/api/tasks/${taskId}`).set(auth(ws.intern2Token))).status).toBe(403);
    expect((await request(app).post(`/api/tasks/${taskId}/start`).set(auth(ws.intern2Token))).status).toBe(404);
    expect((await request(app).post(`/api/tasks/${taskId}/submit`).set(auth(ws.intern2Token)).send({ submission: "hi" })).status).toBe(404);
  });

  it("an admin from another company cannot see the task", async () => {
    const app = await getApp();
    const other = await createCompany("Other Co 2");
    const otherAdmin = await createUser({ role: "admin", companyId: other.id });
    const token = await login(otherAdmin.email);
    expect((await request(app).get(`/api/tasks/${taskId}`).set(auth(token))).status).toBe(404);
    expect((await request(app).put(`/api/tasks/${taskId}`).set(auth(token)).send({ title: "pwned" })).status).toBe(404);
    expect((await request(app).post(`/api/tasks/${taskId}/approve`).set(auth(token))).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${taskId}`).set(auth(token))).status).toBe(404);
  });

  it("follows todo -> in_progress -> in_review -> (changes) -> in_progress -> in_review -> completed", async () => {
    const app = await getApp();
    // Cannot submit before starting.
    expect((await request(app).post(`/api/tasks/${taskId}/submit`).set(auth(ws.internToken)).send({ submission: "early" })).status).toBe(400);

    const started = await request(app).post(`/api/tasks/${taskId}/start`).set(auth(ws.internToken));
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("in_progress");
    expect(started.body.startedAt).toBeTruthy();

    // Double start is rejected.
    expect((await request(app).post(`/api/tasks/${taskId}/start`).set(auth(ws.internToken))).status).toBe(400);

    // Submission requires text.
    expect((await request(app).post(`/api/tasks/${taskId}/submit`).set(auth(ws.internToken)).send({ submission: "  " })).status).toBe(400);

    const submitted = await request(app).post(`/api/tasks/${taskId}/submit`).set(auth(ws.internToken)).send({ submission: "First draft" });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("in_review");

    // Intern cannot approve their own work.
    expect((await request(app).post(`/api/tasks/${taskId}/approve`).set(auth(ws.internToken))).status).toBe(403);

    // Request changes requires feedback.
    expect((await request(app).post(`/api/tasks/${taskId}/request-changes`).set(auth(ws.adminToken)).send({})).status).toBe(400);
    const changes = await request(app).post(`/api/tasks/${taskId}/request-changes`).set(auth(ws.adminToken)).send({ feedback: "Add a section on Work Mode" });
    expect(changes.status).toBe(200);
    expect(changes.body.status).toBe("in_progress");
    expect(changes.body.feedback).toBe("Add a section on Work Mode");

    const resubmitted = await request(app).post(`/api/tasks/${taskId}/submit`).set(auth(ws.internToken)).send({ submission: "Second draft" });
    expect(resubmitted.status).toBe(200);

    // Both submissions are preserved in the append-only log.
    const detail = await request(app).get(`/api/tasks/${taskId}/detail`).set(auth(ws.adminToken));
    expect(detail.status).toBe(200);
    expect(detail.body.submissions.map((s: any) => s.submission)).toEqual(["Second draft", "First draft"]);

    const approved = await request(app).post(`/api/tasks/${taskId}/approve`).set(auth(ws.adminToken)).send({ feedback: "Great" });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("completed");
    expect(approved.body.completedAt).toBeTruthy();

    // Cannot approve twice.
    expect((await request(app).post(`/api/tasks/${taskId}/approve`).set(auth(ws.adminToken))).status).toBe(400);
  });

  it("blocks and unblocks with a reason, notifying admins", async () => {
    const app = await getApp();
    const created = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "Blocked one", assigneeId: ws.intern.id });
    const id = created.body.id;
    expect((await request(app).post(`/api/tasks/${id}/block`).set(auth(ws.internToken)).send({})).status).toBe(400);
    const blocked = await request(app).post(`/api/tasks/${id}/block`).set(auth(ws.internToken)).send({ reason: "Waiting on API keys" });
    expect(blocked.status).toBe(200);
    expect(blocked.body.status).toBe("blocked");
    const adminNotifs = await request(app).get("/api/notifications").set(auth(ws.adminToken));
    expect(adminNotifs.body.some((n: any) => n.title === "Task Blocked")).toBe(true);
    const unblocked = await request(app).post(`/api/tasks/${id}/unblock`).set(auth(ws.internToken));
    expect(unblocked.body.status).toBe("in_progress");
  });

  it("prevents circular dependencies", async () => {
    const app = await getApp();
    const a = (await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "A", assigneeId: ws.intern.id })).body;
    const b = (await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "B", assigneeId: ws.intern.id, dependsOnTaskId: a.id })).body;
    expect(b.dependsOnTaskId).toBe(a.id);
    const res = await request(app).put(`/api/tasks/${a.id}`).set(auth(ws.adminToken)).send({ dependsOnTaskId: b.id });
    expect(res.status).toBe(400);
    expect((await request(app).put(`/api/tasks/${a.id}`).set(auth(ws.adminToken)).send({ dependsOnTaskId: a.id })).status).toBe(400);
  });

  it("deleting a task with submission history succeeds", async () => {
    const app = await getApp();
    const res = await request(app).delete(`/api/tasks/${taskId}`).set(auth(ws.adminToken));
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/tasks/${taskId}`).set(auth(ws.adminToken))).status).toBe(404);
  });
});
