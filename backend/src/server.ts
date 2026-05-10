import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { MulterError } from "multer";
import { createProjectRouter } from "./routes/projects.js";
import { TravefyClient } from "./integrations/travefy/client.js";
import { WetuClient } from "./integrations/wetu/client.js";
import { PublishService } from "./services/publishService.js";
import { createSearchProvider, ResearchQueue } from "./services/researchQueue.js";
import {
  applyTrustProxy,
  buildCors,
  globalRateLimiter,
  securityHeaders
} from "./middleware/httpSecurity.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8080);

applyTrustProxy(app);

app.use(securityHeaders());
app.use(buildCors());
app.use(globalRateLimiter());
app.use(express.json({ limit: "4mb" }));
app.use(
  "/uploads",
  express.static("uploads", {
    dotfiles: "deny",
    index: false,
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0
  })
);

// Auth placeholder: integrate with your existing user system later.
app.use((req, _res, next) => {
  (req as express.Request & { authUser?: { sub: string; role: string } }).authUser = {
    sub: "placeholder-user",
    role: "employee"
  };
  next();
});

const travefyClient = new TravefyClient({
  baseUrl: process.env.TRAVEFY_BASE_URL ?? "https://api.travefy.com",
  apiKey: process.env.TRAVEFY_API_KEY ?? "",
  timeoutMs: Number(process.env.TRAVEFY_TIMEOUT_MS ?? 15000),
  retryCount: Number(process.env.TRAVEFY_RETRY_COUNT ?? 2)
});

const publishService = new PublishService(travefyClient, new WetuClient());
const researchQueue = new ResearchQueue(createSearchProvider());

const exposeApiRoot = process.env.EXPOSE_API_ROOT !== "false";

app.get("/", (_req, res) => {
  if (process.env.NODE_ENV === "production" && !exposeApiRoot) {
    return res.type("json").json({ ok: true, service: "studytour-backend" });
  }
  res.type("json").json({
    service: "studytour-backend",
    message: "API has no HTML homepage; use the frontend (e.g. Vite on port 5180) or call routes below.",
    routes: {
      health: "GET /health",
      projects: "GET /api/projects"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studytour-backend" });
});

app.use("/api/projects", createProjectRouter(researchQueue, publishService));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as MulterError).code) : "";
  if (code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "file too large" });
  }
  if (code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "unexpected upload field" });
  }
  if (err instanceof Error) {
    if (err.message.includes("Only .pdf") || err.message.includes("Invalid proposal")) {
      return res.status(400).json({ error: err.message });
    }
  }
  console.error("[http]", err);
  return res.status(500).json({ error: "internal error" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
