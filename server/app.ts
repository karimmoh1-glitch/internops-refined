import express, { type Express, type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";

const isProduction = process.env.NODE_ENV === "production";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Builds the full API application (security headers, body parsing, request
// logging, every /api route, and the terminal error handler) without
// binding a port or attaching the SPA/static layer. index.ts adds those for
// real runs; the test suite mounts this directly with supertest.
export async function createApp(opts: { quiet?: boolean } = {}): Promise<{ app: Express; httpServer: Server }> {
  const app = express();
  const httpServer = createServer(app);

  // Production deployments terminate TLS at a single reverse proxy in front
  // of this app. Without this, req.ip and express-rate-limit both see the
  // proxy's IP for every request, which defeats per-client rate limiting.
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // Content-Security-Policy is only enforced in production: the dev server
  // injects inline scripts for Vite's HMR/React-refresh runtime, which a
  // CSP would block. The production build only emits external <script src>
  // tags, so a strict policy is safe there.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "https:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  if (!opts.quiet) {
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      res.on("finish", () => {
        if (path.startsWith("/api")) {
          log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
        }
      });
      next();
    });
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Below 500 the error was raised intentionally (validation, a body
    // parser rejecting malformed JSON) so its message is safe to show; a
    // 500 means something unexpected broke and its message may contain
    // internal details, so only the generic fallback goes to the client.
    const message = status < 500 && err.message ? err.message : "Internal Server Error";
    if (status >= 500 || !opts.quiet) console.error("Request error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  return { app, httpServer };
}
