import crypto from "crypto";
import {
  CollaborationThread,
  ItineraryVersion,
  ProposalDocument,
  PublishRecord,
  ResearchFinding,
  ResearchJob,
  StudyTourProject
} from "../domain/models.js";
import {
  PERSISTENCE_VERSION,
  readSnapshot,
  writeSnapshot,
  type PersistedSnapshot
} from "./filePersistence.js";

const now = () => new Date().toISOString();

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function viewToken(): string {
  return `vt_${crypto.randomBytes(24).toString("hex")}`;
}

function emptyDb() {
  return {
    projects: new Map<string, StudyTourProject>(),
    itineraries: new Map<string, ItineraryVersion>(),
    threads: new Map<string, CollaborationThread>(),
    proposals: new Map<string, ProposalDocument>(),
    researchJobs: new Map<string, ResearchJob>(),
    researchFindings: new Map<string, ResearchFinding[]>(),
    publishes: new Map<string, PublishRecord>(),
    iicByProjectId: new Map<string, { updatedAt: string; document: unknown }>()
  };
}

export const db = emptyDb();

function seedDefaultProject(): void {
  const defaultProjectId = uid("project");
  const defaultItineraryId = uid("itv");
  const defaultItinerary: ItineraryVersion = {
    id: defaultItineraryId,
    projectId: defaultProjectId,
    version: 1,
    createdAt: now(),
    isProposal: true,
    title: "游学草案",
    destination: "待定",
    tripDays: [{ id: uid("day"), label: "Day 1", events: [] }],
    budget: { currency: "CNY", assumptions: [], lines: [] },
    logistics: [],
    runbook: []
  };
  db.projects.set(defaultProjectId, {
    id: defaultProjectId,
    name: "示例游学项目",
    destination: "Singapore",
    createdAt: now(),
    latestItineraryVersionId: defaultItineraryId,
    partnerViewNote: "合作商看板：仅显示供应商执行数据。",
    travelerViewNote: "团员看板：仅显示对客版行程与须知。",
    partnerViewToken: viewToken(),
    travelerViewToken: viewToken()
  });
  db.itineraries.set(defaultItineraryId, defaultItinerary);
}

function ensureProjectViewTokens(p: StudyTourProject): StudyTourProject {
  let changed = false;
  const next = { ...p };
  if (!next.partnerViewToken) {
    next.partnerViewToken = viewToken();
    changed = true;
  }
  if (!next.travelerViewToken) {
    next.travelerViewToken = viewToken();
    changed = true;
  }
  if (changed) {
    db.projects.set(next.id, next);
  }
  return next;
}

function inferItineraryProjectId(itId: string, projects: Map<string, StudyTourProject>): string {
  for (const pr of projects.values()) {
    if (pr.latestItineraryVersionId === itId) {
      return pr.id;
    }
  }
  return "";
}

function applySnapshot(snap: PersistedSnapshot): void {
  const next = emptyDb();
  for (const p of snap.projects) {
    const withTokens: StudyTourProject = {
      ...p,
      partnerViewToken: p.partnerViewToken ?? viewToken(),
      travelerViewToken: p.travelerViewToken ?? viewToken()
    };
    next.projects.set(withTokens.id, withTokens);
  }
  for (const it of snap.itineraries) {
    const projectId = it.projectId || inferItineraryProjectId(it.id, next.projects);
    next.itineraries.set(it.id, { ...it, projectId: projectId || "unknown" });
  }
  for (const t of snap.threads) {
    next.threads.set(t.id, t);
  }
  for (const p of snap.proposals) {
    next.proposals.set(p.id, p);
  }
  for (const j of snap.researchJobs) {
    next.researchJobs.set(j.id, j);
  }
  for (const [pid, findings] of snap.researchFindings ?? []) {
    next.researchFindings.set(pid, findings);
  }
  for (const pub of snap.publishes) {
    next.publishes.set(pub.id, pub);
  }
  for (const [pid, doc] of snap.iicByProjectId ?? []) {
    next.iicByProjectId.set(pid, doc);
  }
  db.projects = next.projects;
  db.itineraries = next.itineraries;
  db.threads = next.threads;
  db.proposals = next.proposals;
  db.researchJobs = next.researchJobs;
  db.researchFindings = next.researchFindings;
  db.publishes = next.publishes;
  db.iicByProjectId = next.iicByProjectId;

  for (const p of db.projects.values()) {
    ensureProjectViewTokens(p);
  }
  for (const pr of db.projects.values()) {
    const it = db.itineraries.get(pr.latestItineraryVersionId);
    if (it && it.projectId === "unknown") {
      db.itineraries.set(it.id, { ...it, projectId: pr.id });
    }
  }
}

function snapshotFromDb(): PersistedSnapshot {
  return {
    version: PERSISTENCE_VERSION,
    projects: [...db.projects.values()],
    itineraries: [...db.itineraries.values()],
    threads: [...db.threads.values()],
    proposals: [...db.proposals.values()],
    researchJobs: [...db.researchJobs.values()],
    researchFindings: [...db.researchFindings.entries()],
    publishes: [...db.publishes.values()],
    iicByProjectId: [...db.iicByProjectId.entries()]
  };
}

export function persistState(): void {
  try {
    writeSnapshot(snapshotFromDb());
  } catch (e) {
    console.error("persistState failed", e);
  }
}

const snap = readSnapshot();
if (snap) {
  applySnapshot(snap);
} else {
  seedDefaultProject();
}

export function ensureThread(projectId: string): CollaborationThread {
  const existing = [...db.threads.values()].find((t) => t.projectId === projectId);
  if (existing) {
    return existing;
  }
  const thread: CollaborationThread = { id: uid("thread"), projectId, messages: [] };
  db.threads.set(thread.id, thread);
  return thread;
}

export function createResearchJob(projectId: string, query: string): ResearchJob {
  const job: ResearchJob = {
    id: uid("job"),
    projectId,
    query,
    status: "queued",
    findings: []
  };
  db.researchJobs.set(job.id, job);
  return job;
}

export function createPublishRecord(projectId: string, itineraryVersionId: string, target: PublishRecord["target"]): PublishRecord {
  const record: PublishRecord = {
    id: uid("pub"),
    projectId,
    itineraryVersionId,
    target,
    state: "queued",
    attemptCount: 0,
    updatedAt: now()
  };
  db.publishes.set(record.id, record);
  return record;
}

export function createStudyTourProject(input: {
  name: string;
  destination?: string;
  partnerViewNote?: string;
  travelerViewNote?: string;
}): StudyTourProject {
  const projectId = uid("project");
  const itineraryId = uid("itv");
  const destination = input.destination?.trim() || "待定";

  const itinerary: ItineraryVersion = {
    id: itineraryId,
    projectId,
    version: 1,
    createdAt: now(),
    isProposal: true,
    title: `${input.name.trim()} · 游学草案`,
    destination,
    tripDays: [{ id: uid("day"), label: "Day 1", events: [] }],
    budget: { currency: "CNY", assumptions: [], lines: [] },
    logistics: [],
    runbook: []
  };

  const project: StudyTourProject = {
    id: projectId,
    name: input.name.trim(),
    destination,
    createdAt: now(),
    latestItineraryVersionId: itineraryId,
    partnerViewNote: input.partnerViewNote,
    travelerViewNote: input.travelerViewNote,
    partnerViewToken: viewToken(),
    travelerViewToken: viewToken()
  };

  db.itineraries.set(itineraryId, itinerary);
  db.projects.set(projectId, project);
  return project;
}

/** Remove project and related records (threads, jobs, publishes, proposals, itineraries, IIC). */
export function deleteProjectCascade(projectId: string): boolean {
  const project = db.projects.get(projectId);
  if (!project) {
    return false;
  }
  for (const [id, it] of [...db.itineraries.entries()]) {
    if (it.projectId === projectId) {
      db.itineraries.delete(id);
    }
  }
  db.projects.delete(projectId);
  db.researchFindings.delete(projectId);
  db.iicByProjectId.delete(projectId);

  for (const [id, t] of [...db.threads.entries()]) {
    if (t.projectId === projectId) {
      db.threads.delete(id);
    }
  }
  for (const [id, j] of [...db.researchJobs.entries()]) {
    if (j.projectId === projectId) {
      db.researchJobs.delete(id);
    }
  }
  for (const [id, r] of [...db.publishes.entries()]) {
    if (r.projectId === projectId) {
      db.publishes.delete(id);
    }
  }
  for (const [id, p] of [...db.proposals.entries()]) {
    if (p.projectId === projectId) {
      db.proposals.delete(id);
    }
  }
  return true;
}

export function getIicPersist(projectId: string): { updatedAt: string; document: unknown } | undefined {
  return db.iicByProjectId.get(projectId);
}

export function setIicPersist(projectId: string, document: unknown): { updatedAt: string; document: unknown } {
  const updatedAt = now();
  const row = { updatedAt, document };
  db.iicByProjectId.set(projectId, row);
  return row;
}

export { uid, now };
