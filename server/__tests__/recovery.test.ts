import { describe, it, expect, beforeAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";
import { getApp, request, resetDatabase, seedWorkspace, auth, PASSWORD, createUser, createCompany, login } from "./helpers";

// Account recovery and role boundaries when no email provider is
// configured (the production default today): the client must be told the
// truth, and managers must have a working, scoped recovery path.
describe("recovery without email", () => {
  let ws: Awaited<ReturnType<typeof seedWorkspace>>;
  beforeAll(async () => {
    await resetDatabase();
    ws = await seedWorkspace();
  });

  it("exposes emailConfigured publicly and nothing else", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ emailConfigured: false });
  });

  it("invitations say honestly that no email went out", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/invitations").set(auth(ws.adminToken)).send({ name: "New Person", email: `new-${Date.now()}@example.com` });
    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(false);
    expect(res.body.message).toMatch(/no email was sent/i);
    expect(res.body.inviteLink).toMatch(/\/invite\//);
  });

  it("a manager can issue a reset link that actually resets the password", async () => {
    const app = await getApp();
    const res = await request(app).post(`/api/users/${ws.intern.id}/reset-link`).set(auth(ws.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ws.intern.email);
    const token = String(res.body.resetLink).split("/reset-password/")[1];
    expect(token).toBeTruthy();

    const verify = await request(app).get(`/api/auth/verify-reset/${token}`);
    expect(verify.status).toBe(200);

    const newPassword = "Brand-New-Pass-42!";
    const reset = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: newPassword });
    expect(reset.status).toBe(200);

    const old = await request(app).post("/api/auth/login").send({ email: ws.intern.email, password: PASSWORD });
    expect(old.status).toBe(401);
    const fresh = await request(app).post("/api/auth/login").send({ email: ws.intern.email, password: newPassword });
    expect(fresh.status).toBe(200);

    const reuse = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: "Another-Pass-43!" });
    expect(reuse.status).toBeGreaterThanOrEqual(400);
  });

  it("interns cannot issue reset links, and managers cannot reach other workspaces or themselves", async () => {
    const app = await getApp();
    // ws.intern's password was reset above, which revoked their old token
    // by design; intern2's session is still live.
    const asIntern = await request(app).post(`/api/users/${ws.intern.id}/reset-link`).set(auth(ws.intern2Token));
    expect(asIntern.status).toBe(403);

    const other = await createCompany("Elsewhere");
    const outsider = await createUser({ role: "admin", companyId: other.id });
    const outsiderToken = await login(outsider.email);
    const cross = await request(app).post(`/api/users/${ws.intern2.id}/reset-link`).set(auth(outsiderToken));
    expect(cross.status).toBe(404);

    const self = await request(app).post(`/api/users/${ws.admin.id}/reset-link`).set(auth(ws.adminToken));
    expect(self.status).toBe(400);

    const anon = await request(app).post(`/api/users/${ws.intern2.id}/reset-link`);
    expect(anon.status).toBe(401);
  });

  it("an intern cannot promote anyone, including themselves", async () => {
    const app = await getApp();
    const self = await request(app).post(`/api/interns/${ws.intern2.id}/promote`).set(auth(ws.intern2Token));
    expect(self.status).toBe(403);
    const peer = await request(app).post(`/api/interns/${ws.intern.id}/promote`).set(auth(ws.intern2Token));
    expect(peer.status).toBe(403);
    const me = await request(app).get("/api/auth/me").set(auth(ws.intern2Token));
    expect(me.body.role).toBe("intern");
  });

  it("ending an internship closes sign-in, and reopening it restores an active account", async () => {
    const app = await getApp();
    const company = await createCompany("Alumni Co");
    const admin = await createUser({ role: "admin", companyId: company.id });
    const intern = await createUser({ role: "intern", companyId: company.id, name: "Grad Uate" });
    const adminToken = await login(admin.email);

    const end = await request(app).post(`/api/interns/${intern.id}/transition-alumni`).set(auth(adminToken)).send({});
    expect(end.status).toBe(200);
    expect(end.body.user.alumniAt).toBeTruthy();
    const alumni = await request(app).get("/api/alumni").set(auth(adminToken));
    expect(alumni.body.some((a: any) => a.id === intern.id)).toBe(true);
    // Alumni get a specific, honest refusal (403), not the generic 401.
    const blocked = await request(app).post("/api/auth/login").send({ email: intern.email, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/alumni|ended|no longer/i);

    const reopen = await request(app).post(`/api/alumni/${intern.id}/reactivate`).set(auth(adminToken)).send({});
    expect(reopen.status).toBe(200);
    expect(reopen.body.alumniAt).toBeNull();
    expect(reopen.body.deactivatedAt).toBeNull();
    const back = await request(app).post("/api/auth/login").send({ email: intern.email, password: PASSWORD });
    expect(back.status).toBe(200);
  });

  it("a configured but failing email provider is reported honestly, never as sent", async () => {
    const app = await getApp();
    process.env.RESEND_API_KEY = "re_test_not_a_real_key";
    try {
      const cfg = await request(app).get("/api/config");
      expect(cfg.body.emailConfigured).toBe(true);
      const res = await request(app).post("/api/invitations").set(auth(ws.adminToken)).send({ name: "Fail Case", email: `fail-${Date.now()}@example.com` });
      expect(res.status).toBe(201);
      expect(res.body.emailSent).toBe(false);
      // The SDK wraps a connection failure in its own error object rather than throwing.
      expect(typeof res.body.emailError).toBe("string");
      expect(res.body.emailError.length).toBeGreaterThan(0);
      expect(res.body.message).toMatch(/could not be delivered/i);
      expect(res.body.inviteLink).toMatch(/\/invite\//);
    } finally {
      delete process.env.RESEND_API_KEY;
    }
  });

  it("a provider that accepts the connection but never answers is cut off by the timeout", async () => {
    const app = await getApp();
    const sockets = new Set<Socket>();
    const hang: Server = createServer(() => { /* never respond */ });
    hang.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
    await new Promise<void>((r) => hang.listen(47391, "127.0.0.1", r));
    process.env.RESEND_API_KEY = "re_test_not_a_real_key";
    process.env.EMAIL_PROVIDER_TIMEOUT_MS = "800";
    const started = Date.now();
    try {
      const res = await request(app).post("/api/invitations").set(auth(ws.adminToken)).send({ name: "Hang Case", email: `hang-${Date.now()}@example.com` });
      expect(res.status).toBe(201);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.emailError).toBe("provider_unreachable");
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_PROVIDER_TIMEOUT_MS;
      for (const s of sockets) s.destroy();
      await new Promise<void>((r) => hang.close(() => r()));
    }
  }, 15000);
});
