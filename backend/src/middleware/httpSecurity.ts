import cors from "cors";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

/** Matches `uid("project")` in store: `project_` + base36 slice. */
export const PROJECT_ID_RE = /^project_[a-z0-9]{4,32}$/;

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_RE.test(id);
}

export function applyTrustProxy(app: Express): void {
  if (process.env.TRUST_PROXY === "1") {
    const hops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
    app.set("trust proxy", Number.isFinite(hops) && hops > 0 ? hops : 1);
  }
}

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });
}

export function buildCors() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const allow = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
    return cors({
      origin(origin, cb) {
        if (!origin) {
          return cb(null, true);
        }
        if (allow.has(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      }
    });
  }
  if (process.env.NODE_ENV === "production") {
    return cors({ origin: false });
  }
  return cors({ origin: true });
}

export function globalRateLimiter() {
  const max = Number(
    process.env.RATE_LIMIT_MAX_PER_IP ?? (process.env.NODE_ENV === "production" ? 500 : 3000)
  );
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Math.max(50, max),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health"
  });
}

export function proposalUploadRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Math.max(5, Number(process.env.RATE_LIMIT_PROPOSALS_PER_HOUR ?? 40)),
    standardHeaders: true,
    legacyHeaders: false
  });
}
