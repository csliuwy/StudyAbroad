export type PublishTarget = "travefy" | "wetu" | "file";
export type PublishState = "idle" | "queued" | "syncing" | "synced" | "failed";

export interface MoneyLineItem {
  id: string;
  category: "transport" | "accommodation" | "activity" | "food" | "staff" | "insurance" | "other";
  name: string;
  amount: number;
  currency: string;
  note?: string;
}

export interface BudgetModel {
  currency: string;
  assumptions: string[];
  lines: MoneyLineItem[];
}

export interface LogisticsRequirement {
  id: string;
  type: "vehicle" | "leader" | "visa" | "insurance" | "safety" | "supplier" | "other";
  title: string;
  owner?: string;
  dueDate?: string;
  done: boolean;
  note?: string;
}

export interface RunbookItem {
  id: string;
  phase: "pretrip" | "ontrip" | "posttrip";
  title: string;
  done: boolean;
}

export interface ItineraryEvent {
  id: string;
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  ideas?: string[];
}

export interface ItineraryDay {
  id: string;
  label: string;
  date?: string;
  events: ItineraryEvent[];
}

export interface ItineraryVersion {
  id: string;
  /** Owning project (used for persistence and cascade delete). */
  projectId: string;
  version: number;
  createdAt: string;
  isProposal: boolean;
  title: string;
  destination: string;
  participantCount?: number;
  tripDays: ItineraryDay[];
  budget: BudgetModel;
  logistics: LogisticsRequirement[];
  runbook: RunbookItem[];
}

export interface ResearchFinding {
  id: string;
  query: string;
  summary: string;
  sourceUrl: string;
  createdAt: string;
}

export interface ResearchJob {
  id: string;
  projectId: string;
  query: string;
  status: "queued" | "running" | "done" | "failed";
  findings: ResearchFinding[];
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "employee" | "assistant";
  text: string;
  createdAt: string;
}

export interface CollaborationThread {
  id: string;
  projectId: string;
  messages: ChatMessage[];
}

export interface ProposalDocument {
  id: string;
  projectId: string;
  originalName: string;
  storagePath: string;
  extractedText: string;
  uploadedAt: string;
}

export interface PublishRecord {
  id: string;
  projectId: string;
  itineraryVersionId: string;
  target: PublishTarget;
  state: PublishState;
  externalId?: string;
  attemptCount: number;
  lastError?: string;
  updatedAt: string;
}

export interface StudyTourProject {
  id: string;
  name: string;
  destination: string;
  createdAt: string;
  latestItineraryVersionId: string;
  partnerViewNote?: string;
  travelerViewNote?: string;
  /** Secret token for read-only partner audience API (query param `token`). */
  partnerViewToken: string;
  /** Secret token for read-only traveler audience API (query param `token`). */
  travelerViewToken: string;
}
