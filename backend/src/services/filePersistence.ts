import fs from "fs";
import path from "path";
import type {
  CollaborationThread,
  ItineraryVersion,
  ProposalDocument,
  PublishRecord,
  ResearchFinding,
  ResearchJob,
  StudyTourProject
} from "../domain/models.js";

export const PERSISTENCE_VERSION = 1 as const;

export interface PersistedSnapshot {
  version: typeof PERSISTENCE_VERSION;
  projects: StudyTourProject[];
  itineraries: ItineraryVersion[];
  threads: CollaborationThread[];
  proposals: ProposalDocument[];
  researchJobs: ResearchJob[];
  researchFindings: [string, ResearchFinding[]][];
  publishes: PublishRecord[];
  iicByProjectId: [string, { updatedAt: string; document: unknown }][];
}

function statePath(): string {
  const custom = process.env.STUDYTOUR_STATE_FILE;
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  }
  return path.join(process.cwd(), "data", "studytour-state.json");
}

export function ensureDataDir(): void {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function readSnapshot(): PersistedSnapshot | null {
  const file = statePath();
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (parsed?.version !== PERSISTENCE_VERSION || !Array.isArray(parsed.projects)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: PersistedSnapshot): void {
  ensureDataDir();
  const file = statePath();
  const tmp = `${file}.${process.pid}.tmp`;
  const payload = JSON.stringify(snapshot, null, 0);
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, file);
}
