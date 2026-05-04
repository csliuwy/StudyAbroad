import {
  CollaborationThread,
  ItineraryVersion,
  ProposalDocument,
  PublishRecord,
  ResearchFinding,
  ResearchJob,
  StudyTourProject
} from "../domain/models.js";

const now = () => new Date().toISOString();

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const defaultProjectId = uid("project");
const defaultItineraryId = uid("itv");

const defaultItinerary: ItineraryVersion = {
  id: defaultItineraryId,
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

export const db = {
  projects: new Map<string, StudyTourProject>([
    [
      defaultProjectId,
      {
        id: defaultProjectId,
        name: "示例游学项目",
        destination: "Singapore",
        createdAt: now(),
        latestItineraryVersionId: defaultItineraryId,
        partnerViewNote: "合作商看板：仅显示供应商执行数据。",
        travelerViewNote: "团员看板：仅显示对客版行程与须知。"
      }
    ]
  ]),
  itineraries: new Map<string, ItineraryVersion>([[defaultItineraryId, defaultItinerary]]),
  threads: new Map<string, CollaborationThread>(),
  proposals: new Map<string, ProposalDocument>(),
  researchJobs: new Map<string, ResearchJob>(),
  researchFindings: new Map<string, ResearchFinding[]>(),
  publishes: new Map<string, PublishRecord>()
};

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
    travelerViewNote: input.travelerViewNote
  };

  db.itineraries.set(itineraryId, itinerary);
  db.projects.set(projectId, project);
  return project;
}

/** Remove project and related in-memory records (threads, jobs, publishes, etc.). */
export function deleteProjectCascade(projectId: string): boolean {
  const project = db.projects.get(projectId);
  if (!project) {
    return false;
  }
  db.itineraries.delete(project.latestItineraryVersionId);
  db.projects.delete(projectId);
  db.researchFindings.delete(projectId);

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

export { uid, now };
