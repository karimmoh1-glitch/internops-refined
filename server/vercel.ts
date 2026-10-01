// Vercel serverless entry. The whole Express app (every /api route plus the
// /i/:slug OpenGraph pre-render) runs as one function; static assets are
// served by Vercel's CDN from dist/public (see vercel.json). The app is
// built once per warm instance and reused across invocations.
import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp({ quiet: true });
  const { app } = await appPromise;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
