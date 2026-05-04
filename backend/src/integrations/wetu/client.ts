import { ItineraryVersion } from "../../domain/models.js";

export interface WetuPublishResult {
  externalItineraryId: string;
  raw: unknown;
}

export class WetuClient {
  async upsertItinerary(itinerary: ItineraryVersion, externalItineraryId?: string): Promise<WetuPublishResult> {
    return {
      externalItineraryId: externalItineraryId ?? `wetu_mock_${Date.now()}`,
      raw: {
        mode: "mock",
        note: "Wetu sandbox credentials required from vendor registration.",
        title: itinerary.title
      }
    };
  }
}
