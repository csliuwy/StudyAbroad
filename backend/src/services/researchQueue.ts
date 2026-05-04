import { ResearchFinding, ResearchJob } from "../domain/models.js";
import { db, now, uid } from "./store.js";

interface SearchProvider {
  search(query: string): Promise<Array<{ title: string; url: string; snippet: string }>>;
}

class MockSearchProvider implements SearchProvider {
  async search(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    return [
      {
        title: `Study tour research: ${query}`,
        url: "https://example.org/research/source-1",
        snippet: `Relevant safety and logistics notes for ${query}.`
      },
      {
        title: `Destination planning notes: ${query}`,
        url: "https://example.org/research/source-2",
        snippet: `Potential activity schedule and budget references for ${query}.`
      }
    ];
  }
}

export class ResearchQueue {
  private running = false;
  private readonly provider: SearchProvider;

  constructor(provider?: SearchProvider) {
    this.provider = provider ?? new MockSearchProvider();
  }

  enqueue(job: ResearchJob): void {
    db.researchJobs.set(job.id, job);
    this.process();
  }

  private async process(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const queued = [...db.researchJobs.values()].filter((j) => j.status === "queued");
      for (const job of queued) {
        job.status = "running";
        db.researchJobs.set(job.id, job);
        try {
          const hits = await this.provider.search(job.query);
          const findings: ResearchFinding[] = hits.map((hit) => ({
            id: uid("finding"),
            query: job.query,
            summary: `${hit.title}: ${hit.snippet}`,
            sourceUrl: hit.url,
            createdAt: now()
          }));
          job.findings = findings;
          job.status = "done";
          db.researchFindings.set(job.projectId, findings);
        } catch (error) {
          job.status = "failed";
          job.error = error instanceof Error ? error.message : "unknown research error";
        }
        db.researchJobs.set(job.id, job);
      }
    } finally {
      this.running = false;
    }
  }
}
