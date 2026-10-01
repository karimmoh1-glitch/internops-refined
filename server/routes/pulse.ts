import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, aiLimiter, clampInt } from "../routes";
import { buildOrgContext } from "../services/orgContext";
import { answerOrgQuestion, orgSuggestions, buildInternContext, answerInternQuestion, internSuggestions, hasOpenAiKey, streamOrgAnswer, streamInternAnswer, type PulseAnswer } from "../services/pulse";

// Pulse Chat. One endpoint streams Server-Sent Events:
//   event: delta   data: {"text": "..."}      (LLM engine only)
//   event: done    data: {message}            (final persisted assistant row)
//   event: error   data: {"message": "..."}
// The deterministic engine answers in one "done" event — nothing is
// pretend-streamed. Both engines persist the turn to assistant_messages.
export function registerPulseRoutes(app: Express) {
  app.get("/api/pulse/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const rows = await storage.getAssistantMessages((req as any).userId, clampInt(req.query.limit, 60, 1, 200));
      res.json(rows);
    } catch (error) {
      console.error("Pulse history failed:", error);
      res.status(500).json({ message: "Couldn't load your conversation." });
    }
  });

  app.delete("/api/pulse/history", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.clearAssistantMessages((req as any).userId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Pulse clear failed:", error);
      res.status(500).json({ message: "Couldn't clear the conversation." });
    }
  });

  app.get("/api/pulse/suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tz = clampInt(req.query.tzOffsetMinutes, 0, -720, 840);
      if ((req as any).userRole === "admin") {
        const ctx = await buildOrgContext((req as any).companyId, { tzOffsetMinutes: tz });
        return res.json({ suggestions: await orgSuggestions(ctx), aiAvailable: hasOpenAiKey() });
      }
      const ctx = await buildInternContext((req as any).userId, tz);
      res.json({ suggestions: ctx ? internSuggestions(ctx) : [], aiAvailable: hasOpenAiKey() });
    } catch (error) {
      console.error("Pulse suggestions failed:", error);
      res.status(500).json({ message: "Couldn't load suggestions." });
    }
  });

  app.post("/api/pulse/ask", requireAuth, aiLimiter, async (req: Request, res: Response) => {
    const userId = (req as any).userId as string;
    const companyId = (req as any).companyId as string | null;
    const role = (req as any).userRole as string;
    const question = typeof req.body?.question === "string" ? req.body.question.trim().slice(0, 2000) : "";
    const tz = clampInt(req.body?.tzOffsetMinutes, 0, -720, 840);
    if (!question) return res.status(400).json({ message: "Ask a question first." });
    if (!companyId) return res.status(400).json({ message: "No workspace." });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const send = (event: string, data: unknown) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

    try {
      const userRow = await storage.createAssistantMessage({ userId, companyId, role: "user", content: question, aiGenerated: false, references: [] });
      send("accepted", { message: userRow });

      // Recent history gives the LLM engine conversational context. The
      // deterministic engine only ever looks at the latest question.
      const history = (await storage.getAssistantMessages(userId, 12))
        .filter((m) => m.id !== userRow.id)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const messages = [...history, { role: "user" as const, content: question }];

      let answer: PulseAnswer;
      if (role === "admin") {
        const ctx = await buildOrgContext(companyId, { tzOffsetMinutes: tz });
        if (hasOpenAiKey()) {
          try {
            answer = await streamOrgAnswer(ctx, messages, (delta) => send("delta", { text: delta }));
          } catch (err) {
            console.error("Pulse LLM failed, falling back:", (err as Error).message);
            answer = await answerOrgQuestion(ctx, question);
          }
        } else {
          answer = await answerOrgQuestion(ctx, question);
        }
      } else {
        const ctx = await buildInternContext(userId, tz);
        if (!ctx) throw new Error("no intern context");
        if (hasOpenAiKey()) {
          try {
            answer = await streamInternAnswer(ctx, messages, (delta) => send("delta", { text: delta }));
          } catch (err) {
            console.error("Pulse LLM failed, falling back:", (err as Error).message);
            answer = answerInternQuestion(ctx, question);
          }
        } else {
          answer = answerInternQuestion(ctx, question);
        }
      }

      const saved = await storage.createAssistantMessage({ userId, companyId, role: "assistant", content: answer.text, aiGenerated: answer.aiGenerated, references: answer.references });
      send("done", { message: saved });
    } catch (error) {
      console.error("Pulse ask failed:", error);
      send("error", { message: "Pulse couldn't answer right now. Try again in a moment." });
    } finally {
      res.end();
    }
  });
}
