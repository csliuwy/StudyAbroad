import { ItineraryVersion } from "../../domain/models.js";

export interface TravefyClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  retryCount: number;
}

export interface TravefyPublishResult {
  externalTripId: string;
  raw: unknown;
}

function withTimeout(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function requestWithRetry<T>(fn: () => Promise<T>, retryCount: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retryCount; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function toTravefyPayload(itinerary: ItineraryVersion): Record<string, unknown> {
  return {
    Name: itinerary.title,
    IsProposal: itinerary.isProposal,
    TripDays: itinerary.tripDays.map((day) => ({
      Label: day.label,
      Date: day.date,
      Events: day.events.map((event) => ({
        Name: event.title,
        StartTime: event.startTime,
        EndTime: event.endTime,
        Notes: event.description,
        LocationName: event.location
      }))
    }))
  };
}

export class TravefyClient {
  constructor(private readonly config: TravefyClientConfig) {}

  async upsertTrip(itinerary: ItineraryVersion, externalTripId?: string): Promise<TravefyPublishResult> {
    if (!this.config.apiKey) {
      return {
        externalTripId: externalTripId ?? `mock_trip_${Date.now()}`,
        raw: { mode: "mock", reason: "missing TRAVEFY_API_KEY" }
      };
    }

    const endpoint = externalTripId ? `/trips/${externalTripId}` : "/trips";
    const method = externalTripId ? "PUT" : "POST";
    const body = JSON.stringify(toTravefyPayload(itinerary));

    const raw = await requestWithRetry(async () => {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        signal: withTimeout(this.config.timeoutMs),
        body
      });

      if (!response.ok) {
        throw new Error(`Travefy API ${response.status} ${response.statusText}`);
      }
      return response.json();
    }, this.config.retryCount);

    const parsed = raw as Record<string, unknown>;
    return {
      externalTripId: String(parsed.id ?? parsed.tripId ?? externalTripId ?? ""),
      raw
    };
  }
}
