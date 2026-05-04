import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createProjectRouter } from "./routes/projects.js";
import { TravefyClient } from "./integrations/travefy/client.js";
import { WetuClient } from "./integrations/wetu/client.js";
import { PublishService } from "./services/publishService.js";
import { createSearchProvider, ResearchQueue } from "./services/researchQueue.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static("uploads"));

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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studytour-backend" });
});

app.use("/api/projects", createProjectRouter(researchQueue, publishService));

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
