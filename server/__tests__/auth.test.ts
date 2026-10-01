import { describe, it, expect, beforeAll } from "vitest";
import { getApp, request, resetDatabase, seedWorkspace, auth, PASSWORD, createUser, createCompany, storage } from "./helpers";

describe("authentication", () => {
  let ws: Awaited<ReturnType<typeof seedWorkspace>>;
  beforeAll(async () => {
    await resetDatabase();
    ws = await seedWorkspace();
  });

  it("rejects requests without a token", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/auth/me").set(auth("not-a-jwt"));
    expect(res.status).toBe(401);
  });

  it("logs in and returns the current user", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/auth/me").set(auth(ws.internToken));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ws.intern.id);
    expect(res.body.role).toBe("intern");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("rejects a wrong password with a generic message", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/login").send({ email: ws.intern.email, password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("blocks a deactivated user immediately, even with a valid token", async () => {
    const app = await getApp();
    const company = await createCompany();
    const user = await createUser({ role: "intern", companyId: company.id });
    const tokenRes = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(tokenRes.status).toBe(200);
    await storage.setUserDeactivated(user.id, true);
    const res = await request(app).get("/api/auth/me").set(auth(tokenRes.body.token));
    expect(res.status).toBe(401);
  });

  it("blocks a revoked device immediately", async () => {
    const app = await getApp();
    const loginRes = await request(app).post("/api/auth/login").send({ email: ws.intern2.email, password: PASSWORD });
    const token = loginRes.body.token as string;
    const devices = await request(app).get("/api/devices").set(auth(token));
    expect(devices.status).toBe(200);
    const current = devices.body.find((d: any) => d.current) ?? devices.body[0];
    const del = await request(app).delete(`/api/devices/${current.id}`).set(auth(token));
    expect(del.status).toBe(200);
    const after = await request(app).get("/api/auth/me").set(auth(token));
    expect(after.status).toBe(401);
  });

  it("never lets an intern reach admin-only routes", async () => {
    const app = await getApp();
    for (const path of ["/api/interns", "/api/tasks", "/api/dashboard", "/api/signals", "/api/audit-logs", "/api/alumni", "/api/worktime/overview"]) {
      const res = await request(app).get(path).set(auth(ws.internToken));
      expect(res.status, path).toBe(403);
    }
  });
});
