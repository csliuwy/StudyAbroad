import express from "express";
import multer from "multer";
import { z } from "zod";
import { PublishTarget } from "../domain/models.js";
import { PublishService } from "../services/publishService.js";
import { ResearchQueue } from "../services/researchQueue.js";
import {
  createResearchJob,
  createStudyTourProject,
  db,
  deleteProjectCascade,
  ensureThread,
  now,
  uid
} from "../services/store.js";

const upload = multer({ dest: "uploads/" });

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  destination: z.string().max(200).optional(),
  partnerViewNote: z.string().max(2000).optional(),
  travelerViewNote: z.string().max(2000).optional()
});

const messageSchema = z.object({
  text: z.string().min(1)
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

export function createProjectRouter(researchQueue: ResearchQueue, publishService: PublishService): express.Router {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json([...db.projects.values()]);
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

  router.post("/:projectId/proposal", upload.single("proposal"), (req, res) => {
    const project = db.projects.get(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "proposal file is required" });
    }

    const extractedText = `Uploaded proposal: ${req.file.originalname}. Parsing pipeline placeholder.`;
    const proposal = {
      id: uid("proposal"),
      projectId: project.id,
      originalName: req.file.originalname,
      storagePath: req.file.path,
      extractedText,
      uploadedAt: now()
    };
    db.proposals.set(proposal.id, proposal);

    const thread = ensureThread(project.id);
    thread.messages.push({
      id: uid("msg"),
      role: "assistant",
      text: `已接收提案《${req.file.originalname}》，已进入自动检索完善流程。`,
      createdAt: now()
    });

    const job = createResearchJob(project.id, `Improve proposal: ${req.file.originalname}`);
    researchQueue.enqueue(job);
    return res.status(202).json({ proposal, researchJob: job });
  });

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
      title: z.string().min(1)
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
