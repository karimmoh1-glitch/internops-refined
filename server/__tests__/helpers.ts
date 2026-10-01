import "dotenv/config";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { Express } from "express";

// The globalSetup hook rewrites DATABASE_URL before any test file loads,
// but module-level code here runs inside the worker, so re-derive it
// defensively in case a file is run in isolation.
if (!process.env.DATABASE_URL || !/test/.test(process.env.DATABASE_URL)) {
  const dev = process.env.DATABASE_URL;
  if (dev) process.env.DATABASE_URL = dev.replace(/\/[^/?]+(\?.*)?$/, "/internops_test$1");
}
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "vitest-secret";

const { createApp } = await import("../app");
const { db, pool } = await import("../db");
const { storage } = await import("../storage");
const schema = await import("@shared/schema");

let cached: Express | null = null;
export async function getApp(): Promise<Express> {
  if (!cached) {
    const { app } = await createApp({ quiet: true });
    cached = app;
  }
  return cached;
}

export const PASSWORD = "TestPass123!";
let counter = 0;
export function uniq(prefix = "t"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export async function resetDatabase(): Promise<void> {
  // Truncate every application table; identity/ownership FKs make ordered
  // deletes brittle, so one CASCADE truncate keeps this trivially correct.
  const tables = [
    "work_summaries", "work_activities", "work_sessions", "task_submissions", "task_comments",
    "tasks", "project_completion_criteria", "signal_dismissals", "alumni_records",
    "performance_narratives", "digest_runs", "audit_logs", "user_devices",
    "channel_messages", "channel_members", "channels", "chat_messages", "team_messages",
    "log_comments", "weekly_logs", "comments", "plan_versions", "projects",
    "notifications", "password_reset_tokens", "email_verification_tokens", "signup_tokens",
    "invitations", "applications", "users", "companies",
  ];
  const existing = await pool.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public'");
  const names = new Set(existing.rows.map((r) => r.tablename));
  const present = tables.filter((t) => names.has(t));
  await pool.query(`TRUNCATE TABLE ${present.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function createCompany(name = "Test Co") {
  return storage.createCompany({ name, slug: uniq("co") } as any);
}

export async function createUser(opts: { role?: "admin" | "intern"; companyId: string; name?: string; email?: string }) {
  const email = opts.email ?? `${uniq(opts.role ?? "intern")}@example.test`;
  return storage.createUser({
    name: opts.name ?? (opts.role === "admin" ? "Test Admin" : "Test Intern"),
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: opts.role ?? "intern",
    companyId: opts.companyId,
  } as any);
}

export async function login(email: string, password: string = PASSWORD): Promise<string> {
  const app = await getApp();
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Standard fixture: one company, one admin, two interns — all logged in.
export async function seedWorkspace() {
  const company = await createCompany();
  const admin = await createUser({ role: "admin", companyId: company.id, name: "Ada Admin" });
  const intern = await createUser({ role: "intern", companyId: company.id, name: "Ines Intern" });
  const intern2 = await createUser({ role: "intern", companyId: company.id, name: "Omar Other" });
  const [adminToken, internToken, intern2Token] = await Promise.all([
    login(admin.email), login(intern.email), login(intern2.email),
  ]);
  return { company, admin, intern, intern2, adminToken, internToken, intern2Token };
}

export { db, pool, storage, schema, request };
