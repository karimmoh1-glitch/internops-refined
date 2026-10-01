// Loads .env for local development only. Production platforms inject real
// environment variables directly, and dotenv never overrides an already-set
// process.env value, so this is a no-op there.
import "dotenv/config";
import { createApp, log } from "./app";
import { serveStatic } from "./static";
import { startScheduler } from "./services/scheduler";

export { log };

(async () => {
  const { app, httpServer } = await createApp();

  // The SPA/static layer is mounted after every API route so its catch-all
  // never shadows an /api path.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Vercel runs scheduled work through /api/cron/* instead (vercel.json).
  if (!process.env.VERCEL) startScheduler();

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})();
