import { describe, it, expect, beforeAll } from "vitest";
import { getApp, request, resetDatabase, seedWorkspace, auth, createUser, pool } from "./helpers";

// Reads the SSE stream the Pulse endpoint produces and returns the parsed events.
async function ask(token: string, question: string) {
  const app = await getApp();
  const res = await request(app).post("/api/pulse/ask").set(auth(token)).send({ question });
  expect(res.status).toBe(200);
  const events: { event: string; data: any }[] = [];
  for (const block of res.text.split("\n\n")) {
    const ev = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
  }
  const done = events.find((e) => e.event === "done");
  return { events, text: done?.data.message.content as string, refs: done?.data.message.references as any[], aiGenerated: done?.data.message.aiGenerated as boolean };
}

describe("Pulse Chat (deterministic engine, no OpenAI key)", () => {
  let ws: Awaited<ReturnType<typeof seedWorkspace>>;
  let overdueId: string;
  let blockedId: string;

  beforeAll(async () => {
    await resetDatabase();
    ws = await seedWorkspace();
    const app = await getApp();
    const overdue = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "Ship onboarding email", assigneeId: ws.intern.id, dueDate: new Date(Date.now() - 3 * 86400000).toISOString() });
    overdueId = overdue.body.id;
    const blocked = await request(app).post("/api/tasks").set(auth(ws.adminToken)).send({ title: "Connect analytics", assigneeId: ws.intern2.id });
    blockedId = blocked.body.id;
    await request(app).post(`/api/tasks/${blockedId}/block`).set(auth(ws.intern2Token)).send({ reason: "Waiting on API key" });
    await request(app).post("/api/work-sessions/start").set(auth(ws.internToken));
  });

  it("answers 'who is working right now' from live sessions with a replay reference", async () => {
    const { text, refs, aiGenerated } = await ask(ws.adminToken, "Who is working right now?");
    expect(aiGenerated).toBe(false);
    expect(text).toContain("1 person in Work Mode");
    expect(refs.some((r) => r.type === "person" && r.id === ws.intern.id)).toBe(true);
    expect(refs.some((r) => r.type === "replay")).toBe(true);
  });

  it("answers overdue and blocked with task references", async () => {
    const overdue = await ask(ws.adminToken, "What tasks are overdue?");
    expect(overdue.text).toContain("Ship onboarding email");
    expect(overdue.refs.some((r) => r.type === "task" && r.id === overdueId)).toBe(true);
    const blocked = await ask(ws.adminToken, "Show me blocked work");
    expect(blocked.text).toContain("Waiting on API key");
    expect(blocked.refs.some((r) => r.id === blockedId)).toBe(true);
  });

  it("asks for clarification when a name is ambiguous", async () => {
    const app = await getApp();
    await createUser({ role: "intern", companyId: ws.company.id, name: "Ines Alvarez" });
    const { text } = await ask(ws.adminToken, "What is Ines working on?");
    expect(text).toMatch(/not sure which person/i);
    expect(text).toContain("Ines Intern");
    expect(text).toContain("Ines Alvarez");
    void app;
  });

  it("says plainly when there is no recorded evidence", async () => {
    const { text } = await ask(ws.adminToken, "What is Omar Other doing right now?");
    expect(text).toMatch(/isn't in Work Mode right now/);
  });

  it("does not answer an unrecognised question with invented data", async () => {
    const { text } = await ask(ws.adminToken, "What is the meaning of life?");
    expect(text).toMatch(/didn't recognise that question/);
  });

  it("the intern engine only ever sees the intern's own data", async () => {
    const { text, refs } = await ask(ws.intern2Token, "What's blocked?");
    expect(text).toContain("Connect analytics");
    expect(refs.every((r) => r.type !== "person" || r.id === ws.intern2.id)).toBe(true);
    const other = await ask(ws.intern2Token, "What is Ines working on?");
    expect(other.text).not.toContain("Ship onboarding email");
  });

  it("persists the conversation and can clear it", async () => {
    const app = await getApp();
    const history = await request(app).get("/api/pulse/history").set(auth(ws.adminToken));
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThan(4);
    expect(history.body[0].role).toBe("user");
    await request(app).delete("/api/pulse/history").set(auth(ws.adminToken));
    expect((await request(app).get("/api/pulse/history").set(auth(ws.adminToken))).body.length).toBe(0);
    // Clearing one user's history must not touch another's.
    expect((await request(app).get("/api/pulse/history").set(auth(ws.intern2Token))).body.length).toBeGreaterThan(0);
  });

  it("suggestions only offer prompts that have data behind them", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/pulse/suggestions").set(auth(ws.adminToken));
    expect(res.status).toBe(200);
    const labels = res.body.suggestions.map((s: any) => s.label);
    expect(labels.some((l: string) => l.startsWith("Who is working right now"))).toBe(true);
    expect(labels.some((l: string) => l.startsWith("Show overdue work"))).toBe(true);
    expect(res.body.aiAvailable).toBe(false);
  });

  it("the admin overview reports live state, approvals, and companion status honestly", async () => {
    const app = await getApp();
    await request(app).post(`/api/tasks/${overdueId}/start`).set(auth(ws.internToken));
    await request(app).post(`/api/tasks/${overdueId}/submit`).set(auth(ws.internToken)).send({ submission: "done" });
    const res = await request(app).get("/api/overview").set(auth(ws.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.counts.working).toBe(1);
    expect(res.body.working[0].companion).toBe("none");
    expect(res.body.approvals.some((a: any) => a.kind === "task_review" && a.id === overdueId)).toBe(true);
    expect(res.body.counts.blocked).toBe(1);
    expect(res.body.onboarding.steps.firstSession).toBe(true);
    expect(res.body.onboarding.steps.companionActivity).toBe(false);
    const rows = await pool.query("select count(*)::int as c from assistant_messages");
    expect(rows.rows[0].c).toBeGreaterThan(0);
  });

  it("the intern overview surfaces the priority task and in-review work", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/me/overview").set(auth(ws.internToken));
    expect(res.status).toBe(200);
    expect(res.body.workMode.sessionId).toBeTruthy();
    expect(res.body.inReview.map((t: any) => t.id)).toContain(overdueId);
    expect((await request(app).get("/api/me/overview").set(auth(ws.adminToken))).status).toBe(403);
  });

  it("task detail includes submissions, comments, and notifies the other party", async () => {
    const app = await getApp();
    const c = await request(app).post(`/api/tasks/${overdueId}/comments`).set(auth(ws.adminToken)).send({ content: "Which template did you use?" });
    expect(c.status).toBe(201);
    expect((await request(app).post(`/api/tasks/${overdueId}/comments`).set(auth(ws.intern2Token)).send({ content: "snoop" })).status).toBe(404);
    const detail = await request(app).get(`/api/tasks/${overdueId}/detail`).set(auth(ws.internToken));
    expect(detail.status).toBe(200);
    expect(detail.body.comments.length).toBe(1);
    expect(detail.body.submissions.length).toBe(1);
    expect(detail.body.history.map((h: any) => h.kind)).toEqual(expect.arrayContaining(["created", "started", "submitted", "comment"]));
    const notifs = await request(app).get("/api/notifications").set(auth(ws.internToken));
    expect(notifs.body.some((n: any) => n.title === "New comment on your task" && n.link === `/tasks/${overdueId}`)).toBe(true);
  });
});
