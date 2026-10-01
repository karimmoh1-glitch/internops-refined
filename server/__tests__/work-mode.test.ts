import { describe, it, expect, beforeAll } from "vitest";
import { getApp, request, resetDatabase, seedWorkspace, auth, pool } from "./helpers";

describe("Work Mode sessions and activity boundary", () => {
  let ws: Awaited<ReturnType<typeof seedWorkspace>>;
  let sessionId: string;

  beforeAll(async () => {
    await resetDatabase();
    ws = await seedWorkspace();
  });

  it("activity is rejected before a shift starts", async () => {
    const app = await getApp();
    const now = Date.now();
    const res = await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({
      activities: [{ application: "Code", startedAt: new Date(now - 60000).toISOString(), endedAt: new Date(now).toISOString(), durationSeconds: 60 }],
    });
    expect(res.status).toBe(400);
  });

  it("starts a shift once and refuses a duplicate start", async () => {
    const app = await getApp();
    const first = await request(app).post("/api/work-sessions/start").set(auth(ws.internToken));
    expect(first.status).toBe(201);
    sessionId = first.body.id;
    const second = await request(app).post("/api/work-sessions/start").set(auth(ws.internToken));
    expect(second.status).toBe(400);
    const active = await request(app).get("/api/work-sessions/active").set(auth(ws.internToken));
    expect(active.body?.id).toBe(sessionId);
  });

  it("two concurrent starts only ever create one active session (DB-enforced)", async () => {
    const app = await getApp();
    const results = await Promise.all(Array.from({ length: 5 }, () => request(app).post("/api/work-sessions/start").set(auth(ws.intern2Token))));
    const created = results.filter((r) => r.status === 201);
    expect(created.length).toBe(1);
    expect(results.filter((r) => r.status === 400).length).toBe(4);
    const rows = await pool.query("select count(*)::int as c from work_sessions where intern_id=$1 and status='active'", [ws.intern2.id]);
    expect(rows.rows[0].c).toBe(1);
    await request(app).post("/api/work-sessions/end").set(auth(ws.intern2Token));
  });

  it("admins cannot start shifts", async () => {
    const app = await getApp();
    expect((await request(app).post("/api/work-sessions/start").set(auth(ws.adminToken))).status).toBe(403);
  });

  it("accepts in-window activity, rejects future and pre-shift samples, never trusts client ids", async () => {
    const app = await getApp();
    // The shift began milliseconds ago in this file; backdate it so a
    // realistic multi-second sample fits inside it.
    await pool.query("update work_sessions set started_at = started_at - interval '5 minutes' where id=$1", [sessionId]);
    const now = Date.now();
    const res = await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({
      activities: [
        // Starts inside the shift (it began moments ago in this file).
        { application: "Visual Studio Code", documentName: "routes.ts", startedAt: new Date(now - 120000).toISOString(), endedAt: new Date(now - 60000).toISOString(), durationSeconds: 60, sessionId: "spoofed", internId: ws.intern2.id },
        { application: "Google Chrome", browserDomain: "github.com", startedAt: new Date(now + 3600000).toISOString(), endedAt: new Date(now + 3660000).toISOString(), durationSeconds: 60 },
        { application: "Slack", startedAt: new Date(now - 86400000).toISOString(), endedAt: new Date(now - 86400000 + 60000).toISOString(), durationSeconds: 60 },
        { application: "Bad", startedAt: new Date(now - 1000).toISOString(), endedAt: new Date(now - 2000).toISOString(), durationSeconds: 1 },
        { application: "Huge", startedAt: new Date(now - 1000).toISOString(), endedAt: new Date(now).toISOString(), durationSeconds: 999999 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.rejected).toBe(4);
    const rows = await pool.query("select session_id, intern_id, application, category from work_activities where session_id=$1", [sessionId]);
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].intern_id).toBe(ws.intern.id);
    expect(rows.rows[0].category).toBe("development");
  });

  it("clips a sample that straddles the shift start instead of recording time before it", async () => {
    const app = await getApp();
    const active = await request(app).get("/api/work-sessions/active").set(auth(ws.internToken));
    const startMs = new Date(active.body.startedAt).getTime();
    const res = await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({
      activities: [{ application: "Figma", startedAt: new Date(startMs - 90_000).toISOString(), endedAt: new Date(startMs + 30_000).toISOString(), durationSeconds: 120 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    const rows = await pool.query("select started_at, duration_seconds from work_activities where session_id=$1 and application='Figma'", [sessionId]);
    expect(new Date(rows.rows[0].started_at).getTime()).toBeGreaterThanOrEqual(startMs - 1000);
    expect(rows.rows[0].duration_seconds).toBeLessThanOrEqual(31);
    await pool.query("delete from work_activities where session_id=$1 and application='Figma'", [sessionId]);
  });

  it("rejects malformed payloads", async () => {
    const app = await getApp();
    expect((await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({ activities: "nope" })).status).toBe(400);
    expect((await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({})).status).toBe(400);
  });

  it("another intern cannot read this session's activity or timeline", async () => {
    const app = await getApp();
    expect((await request(app).get(`/api/work-sessions/${sessionId}/activities`).set(auth(ws.intern2Token))).status).toBe(404);
    expect((await request(app).get(`/api/work-sessions/${sessionId}/timeline`).set(auth(ws.intern2Token))).status).toBe(404);
    expect((await request(app).get(`/api/work-sessions/${sessionId}/activity-breakdown`).set(auth(ws.intern2Token))).status).toBe(404);
  });

  it("ends the shift, generates a factual report, and refuses a double end", async () => {
    const app = await getApp();
    const ended = await request(app).post("/api/work-sessions/end").set(auth(ws.internToken));
    expect(ended.status).toBe(200);
    expect(ended.body.session.status).toBe("completed");
    expect(ended.body.report.sessionId).toBe(sessionId);
    expect(ended.body.report.activityBreakdown[0].category).toBe("development");
    const again = await request(app).post("/api/work-sessions/end").set(auth(ws.internToken));
    expect(again.status).toBe(400);
  });

  it("STOPS collection immediately after End Shift — post-shift activity is rejected", async () => {
    const app = await getApp();
    const now = Date.now();
    const res = await request(app).post("/api/work-sessions/activity").set(auth(ws.internToken)).send({
      activities: [{ application: "Code", startedAt: new Date(now - 60000).toISOString(), endedAt: new Date(now).toISOString(), durationSeconds: 60 }],
    });
    expect(res.status).toBe(400);
    const rows = await pool.query("select count(*)::int as c from work_activities where session_id=$1", [sessionId]);
    expect(rows.rows[0].c).toBe(1);
  });

  it("the timeline distinguishes system events from observed activity", async () => {
    const app = await getApp();
    const res = await request(app).get(`/api/work-sessions/${sessionId}/timeline`).set(auth(ws.adminToken));
    expect(res.status).toBe(200);
    const types = res.body.events.map((e: any) => e.type);
    expect(types[0]).toBe("shift_started");
    expect(types).toContain("app_active");
    expect(types).toContain("shift_ended");
    const observed = res.body.events.find((e: any) => e.type === "app_active");
    expect(observed.evidenceIds.length).toBe(1);
    expect(observed.interpretation.inferred).toBeNull();
  });

  it("report submission notifies admins and cannot be submitted twice", async () => {
    const app = await getApp();
    const patched = await request(app).patch(`/api/work-sessions/${sessionId}/summary`).set(auth(ws.internToken)).send({ internNote: "Focused on routing" });
    expect(patched.status).toBe(200);
    expect((await request(app).patch(`/api/work-sessions/${sessionId}/summary`).set(auth(ws.intern2Token)).send({ internNote: "x" })).status).toBe(404);
    const sub = await request(app).post(`/api/work-sessions/${sessionId}/summary/submit`).set(auth(ws.internToken));
    expect(sub.status).toBe(200);
    expect((await request(app).post(`/api/work-sessions/${sessionId}/summary/submit`).set(auth(ws.internToken))).status).toBe(400);
    const notifs = await request(app).get("/api/notifications").set(auth(ws.adminToken));
    expect(notifs.body.some((n: any) => n.title === "Shift Report Submitted")).toBe(true);
  });
});
