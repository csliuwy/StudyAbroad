import fs from "fs/promises";
import path from "path";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { isValidProjectId, proposalUploadRateLimiter } from "../middleware/httpSecurity.js";
import type { ItineraryVersion, StudyTourProject } from "../domain/models.js";
import { PublishTarget } from "../domain/models.js";
import { PublishService } from "../services/publishService.js";
import { extractProposalText } from "../services/proposalExtract.js";
import { ResearchQueue } from "../services/researchQueue.js";
import {
  createResearchJob,
  createStudyTourProject,
  db,
  deleteProjectCascade,
  ensureThread,
  getIicPersist,
  now,
  persistState,
  setIicPersist,
  uid
} from "../services/store.js";

const PROPOSAL_MAX_BYTES = Math.min(
  20 * 1024 * 1024,
  Math.max(1024 * 1024, Number(process.env.PROPOSAL_MAX_BYTES ?? 12 * 1024 * 1024))
);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: PROPOSAL_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf" || ext === ".doc" || ext === ".docx") {
      return cb(null, true);
    }
    cb(new Error("Only .pdf, .doc, .docx allowed"));
  }
});

function safeProposalFilename(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^\w.\u4e00-\u9fff-]+/g, "_").slice(0, 200) || "proposal";
}

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  destination: z.string().max(200).optional(),
  partnerViewNote: z.string().max(2000).optional(),
  travelerViewNote: z.string().max(2000).optional()
});

const messageSchema = z.object({
  text: z.string().min(1).max(12000)
});

const publishSchema = z.object({
  target: z.enum(["travefy", "wetu", "file"])
});

const budgetLineSchema = z.object({
  category: z.enum(["transport", "accommodation", "activity", "food", "staff", "insurance", "other"]),
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(1),
  note: z.string().optional()
});

const logisticsSchema = z.object({
  type: z.enum(["vehicle", "leader", "visa", "insurance", "safety", "supplier", "other"]),
  title: z.string().min(1),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional()
});

const patchProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  destination: z.string().max(200).optional()
});

const itineraryEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  ideas: z.array(z.string()).optional()
});

const itineraryDaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  date: z.string().optional(),
  events: z.array(itineraryEventSchema)
});

const itineraryPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    destination: z.string().min(1).optional(),
    isProposal: z.boolean().optional(),
    participantCount: z.number().nonnegative().optional(),
    tripDays: z.array(itineraryDaySchema).optional()
  })
  .strict();

const iicPutSchema = z.object({
  document: z
    .object({
      v: z.literal(1),
      savedAt: z.string(),
      sections: z.record(z.any())
    })
    .passthrough()
});

/** When `true`, partner/traveler views require `?token=` (see project detail). Default: off for local dev. */
function requireViewToken(): boolean {
  return process.env.REQUIRE_VIEW_TOKEN === "true";
}

function assertViewAccess(
  project: StudyTourProject,
  role: "partner" | "traveler",
  token: string | undefined,
  res: express.Response
): boolean {
  if (!requireViewToken()) {
    return true;
  }
  const expected = role === "partner" ? project.partnerViewToken : project.travelerViewToken;
  if (!token || token !== expected) {
    res.status(401).json({ error: "invalid or missing view token (pass ?token= from project detail)" });
    return false;
  }
  return true;
}

function forkItinerary(current: ItineraryVersion, projectId: string): ItineraryVersion {
  const clone = structuredClone(current) as ItineraryVersion;
  clone.id = uid("itv");
  clone.projectId = projectId;
  clone.version = current.version + 1;
  clone.createdAt = now();
  for (const day of clone.tripDays) {
    day.id = uid("day");
    for (const ev of day.events) {
      ev.id = uid("evt");
    }
  }
  for (const line of clone.budget.lines) {
    line.id = uid("budget");
  }
  for (const log of clone.logistics) {
    log.id = uid("log");
  }
  for (const rb of clone.runbook) {
    rb.id = uid("rb");
  }
  return clone;
}

export function createProjectRouter(researchQueue: ResearchQueue, publishService: PublishService): express.Router {
  const router = express.Router();

  router.param("projectId", (req, res, next, id) => {
    if (!isValidProjectId(id)) {
      return res.status(400).json({ error: "invalid project id" });
    }
    next();
  });

  router.use((req, res, next) => {
    res.on("finish", () => {
      if (
        ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
        res.statusCode >= 200 &&
        res.statusCode < 300
      ) {
        persistState();
      }
    });
    next();
  });

  router.get("/", (_req, res) => {
    const list = [...db.projects.values()].map((p) => ({
      id: p.id,
      name: p.name,
      destination: p.destination,
      createdAt: p.createdAt,
      latestItineraryVersionId: p.latestItineraryVersionId,
      partnerViewNote: p.partnerViewNote,
      travelerViewNote: p.travelerViewNote
    }));
    res.json(list);
  });

  router.post("/", (req, res) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = createStudyTourProject(parsed.data);
    ensureThread(project.id);
    return res.status(201).json(project);
  });

  router.get("/:projectId/internal-information-collection/export", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const row = getIicPersist(req.params.projectId);
    res.setHeader("Content-Disposition", `attachment; filename="iic-${req.params.projectId}.json"`);
    res.type("application/json");
    return res.send(JSON.stringify(row?.document ?? null, null, 2));
  });

  router.get("/:projectId/internal-information-collection", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const row = getIicPersist(req.params.projectId);
    return res.json(row ?? null);
  });

  router.put("/:projectId/internal-information-collection", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const parsed = iicPutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const row = setIicPersist(project.id, parsed.data.document);
    return res.json(row);
  });

  router.patch("/:projectId/itinerary", (req, res) => {
    const parsed = itineraryPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    if (!itinerary) {
      return res.status(404).json({ error: "itinerary not found" });
    }
    if (parsed.data.title !== undefined) {
      itinerary.title = parsed.data.title;
    }
    if (parsed.data.destination !== undefined) {
      itinerary.destination = parsed.data.destination;
    }
    if (parsed.data.isProposal !== undefined) {
      itinerary.isProposal = parsed.data.isProposal;
    }
    if (parsed.data.participantCount !== undefined) {
      itinerary.participantCount = parsed.data.participantCount;
    }
    if (parsed.data.tripDays !== undefined) {
      itinerary.tripDays = parsed.data.tripDays as typeof itinerary.tripDays;
    }
    db.itineraries.set(itinerary.id, itinerary);
    return res.json(itinerary);
  });

  router.post("/:projectId/itinerary/versions", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const current = db.itineraries.get(project.latestItineraryVersionId);
    if (!current) {
      return res.status(404).json({ error: "itinerary not found" });
    }
    const next = forkItinerary(current, project.id);
    db.itineraries.set(next.id, next);
    project.latestItineraryVersionId = next.id;
    db.projects.set(project.id, project);
    return res.status(201).json({ project, itinerary: next });
  });

  router.get("/:projectId", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    return res.json({
      project,
      itinerary,
      thread: ensureThread(project.id),
      findings: db.researchFindings.get(project.id) ?? [],
      publishes: [...db.publishes.values()].filter((p) => p.projectId === project.id)
    });
  });

  router.patch("/:projectId", (req, res) => {
    const parsed = patchProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    if (parsed.data.name === undefined && parsed.data.destination === undefined) {
      return res.status(400).json({ error: "at least one of name, destination is required" });
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    if (parsed.data.name !== undefined) {
      project.name = parsed.data.name.trim();
    }
    if (parsed.data.destination !== undefined) {
      project.destination = parsed.data.destination.trim() || "待定";
    }
    db.projects.set(project.id, project);
    return res.json(project);
  });

  router.delete("/:projectId", (req, res) => {
    const ok = deleteProjectCascade(req.params.projectId);
    if (!ok) {
      return res.status(404).json({ error: "project not found" });
    }
    return res.status(204).send();
  });

  router.post("/:projectId/chat", (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const thread = ensureThread(project.id);
    thread.messages.push({ id: uid("msg"), role: "employee", text: parsed.data.text, createdAt: now() });

    const job = createResearchJob(project.id, parsed.data.text);
    researchQueue.enqueue(job);
    return res.status(202).json({ thread, researchJob: job });
  });

  router.post(
    "/:projectId/proposal",
    proposalUploadRateLimiter(),
    upload.single("proposal"),
    async (req, res) => {
      const project = db.projects.get(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "project not found" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "proposal file is required" });
      }

      const displayName = safeProposalFilename(req.file.originalname);
      let extractedText: string;
      try {
        extractedText = await extractProposalText(req.file.path, req.file.originalname);
      } catch (e) {
        extractedText = `Extract error: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        try {
          await fs.unlink(req.file.path);
        } catch {
          /* temp file already removed */
        }
      }

      const proposal = {
        id: uid("proposal"),
        projectId: project.id,
        originalName: displayName,
        storagePath: "(removed after ingest)",
        extractedText,
        uploadedAt: now()
      };
      db.proposals.set(proposal.id, proposal);

      const thread = ensureThread(project.id);
      thread.messages.push({
        id: uid("msg"),
        role: "assistant",
        text: `已接收提案《${displayName}》，已提取文本并创建研究任务。`,
        createdAt: now()
      });

      const job = createResearchJob(project.id, `Improve proposal: ${displayName}`);
      researchQueue.enqueue(job);
      return res.status(202).json({ proposal, researchJob: job });
    }
  );

  router.get("/:projectId/research-jobs", (req, res) => {
    const jobs = [...db.researchJobs.values()].filter((j) => j.projectId === req.params.projectId);
    res.json(jobs);
  });

  router.post("/:projectId/budget/lines", (req, res) => {
    const parsed = budgetLineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    if (!itinerary) {
      return res.status(404).json({ error: "itinerary not found" });
    }
    itinerary.budget.lines.push({ id: uid("budget"), ...parsed.data });
    res.status(201).json(itinerary.budget);
  });

  router.post("/:projectId/logistics", (req, res) => {
    const parsed = logisticsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    if (!itinerary) {
      return res.status(404).json({ error: "itinerary not found" });
    }
    itinerary.logistics.push({ id: uid("log"), done: false, ...parsed.data });
    res.status(201).json(itinerary.logistics);
  });

  router.post("/:projectId/runbook", (req, res) => {
    const schema = z.object({
      phase: z.enum(["pretrip", "ontrip", "posttrip"]),
      title: z.string().min(1).max(400)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    if (!itinerary) {
      return res.status(404).json({ error: "itinerary not found" });
    }
    itinerary.runbook.push({ id: uid("rb"), done: false, ...parsed.data });
    res.status(201).json(itinerary.runbook);
  });

  router.get("/:projectId/view/partner", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!assertViewAccess(project, "partner", token, res)) {
      return;
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    res.json({
      audience: "partner",
      note: project.partnerViewNote,
      logistics: itinerary?.logistics ?? [],
      runbook: itinerary?.runbook ?? []
    });
  });

  router.get("/:projectId/view/traveler", (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    const token = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!assertViewAccess(project, "traveler", token, res)) {
      return;
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    res.json({
      audience: "traveler",
      note: project.travelerViewNote,
      itineraryDays: itinerary?.tripDays ?? []
    });
  });

  router.post("/:projectId/publish", async (req, res) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }
    try {
      const result = await publishService.publish(req.params.projectId, parsed.data.target as PublishTarget);
      return res.status(202).json(result);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "publish failed" });
    }
  });

  router.get("/:projectId/publishes", (req, res) => {
    const records = [...db.publishes.values()].filter((p) => p.projectId === req.params.projectId);
    res.json(records);
  });

  return router;
}
