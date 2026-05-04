import { PublishTarget } from "../domain/models.js";
import { TravefyClient } from "../integrations/travefy/client.js";
import { WetuClient } from "../integrations/wetu/client.js";
import { createPublishRecord, db, now } from "./store.js";

export class PublishService {
  private readonly travefy: TravefyClient;
  private readonly wetu: WetuClient;

  constructor(travefyClient: TravefyClient, wetuClient: WetuClient) {
    this.travefy = travefyClient;
    this.wetu = wetuClient;
  }

  async publish(projectId: string, target: PublishTarget): Promise<{ publishId: string }> {
    const project = db.projects.get(projectId);
    if (!project) {
      throw new Error("project not found");
    }
    const itinerary = db.itineraries.get(project.latestItineraryVersionId);
    if (!itinerary) {
      throw new Error("itinerary not found");
    }

    const existing = [...db.publishes.values()].find(
      (r) => r.projectId === projectId && r.itineraryVersionId === itinerary.id && r.target === target
    );
    const record = existing ?? createPublishRecord(projectId, itinerary.id, target);

    record.state = "syncing";
    record.attemptCount += 1;
    record.updatedAt = now();
    db.publishes.set(record.id, record);

    try {
      if (target === "travefy") {
        const result = await this.travefy.upsertTrip(itinerary, record.externalId);
        record.externalId = result.externalTripId;
      } else if (target === "wetu") {
        const result = await this.wetu.upsertItinerary(itinerary, record.externalId);
        record.externalId = result.externalItineraryId;
      } else {
        record.externalId = `file_${Date.now()}`;
      }
      record.state = "synced";
      record.lastError = undefined;
    } catch (error) {
      record.state = "failed";
      record.lastError = error instanceof Error ? error.message : "unknown publish error";
    }

    record.updatedAt = now();
    db.publishes.set(record.id, record);
    return { publishId: record.id };
  }
}
