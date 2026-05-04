import { ItineraryVersion } from "../../domain/models.js";

export interface WetuPublishResult {
  externalItineraryId: string;
  raw: unknown;
}

export interface WetuClientConfig {
  baseUrl: string;
  apiKey: string;
  upsertPath: string;
  timeoutMs: number;
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export class WetuClient {
  private readonly cfg: WetuClientConfig;

  constructor(cfg?: Partial<WetuClientConfig>) {
    this.cfg = {
      baseUrl: (cfg?.baseUrl ?? process.env.WETU_API_BASE_URL ?? "").replace(/\/+$/, ""),
      apiKey: cfg?.apiKey ?? process.env.WETU_API_KEY ?? "",
      upsertPath: cfg?.upsertPath ?? process.env.WETU_UPSERT_PATH ?? "/v1/itineraries",
      timeoutMs: cfg?.timeoutMs ?? Number(process.env.WETU_TIMEOUT_MS ?? 20000)
    };
  }

  async upsertItinerary(itinerary: ItineraryVersion, externalItineraryId?: string): Promise<WetuPublishResult> {
    const { baseUrl, apiKey, upsertPath, timeoutMs } = this.cfg;
    if (!baseUrl || !apiKey) {
      return {
        externalItineraryId: externalItineraryId ?? `wetu_mock_${Date.now()}`,
        raw: {
          mode: "mock",
          note: "Set WETU_API_BASE_URL and WETU_API_KEY for live Wetu (or partner) HTTP integration.",
          title: itinerary.title
        }
      };
    }

    const url = `${baseUrl}${upsertPath.startsWith("/") ? "" : "/"}${upsertPath}`;
    const method = externalItineraryId ? "PUT" : "POST";
    const targetUrl = externalItineraryId ? `${url}/${encodeURIComponent(externalItineraryId)}` : url;

    const body = {
      externalRef: itinerary.id,
      title: itinerary.title,
      destination: itinerary.destination,
      dayCount: itinerary.tripDays.length,
      isProposal: itinerary.isProposal,
      days: itinerary.tripDays.map((d) => ({
        label: d.label,
        date: d.date,
        events: d.events.map((e) => ({ title: e.title, location: e.location }))
      }))
    };

    const res = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: withTimeout(timeoutMs)
    });

    const rawText = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = { rawText: rawText.slice(0, 2000) };
    }

    if (!res.ok) {
      throw new Error(`Wetu HTTP ${res.status}: ${rawText.slice(0, 400)}`);
    }

    const ext =
      (parsed as { id?: string })?.id ??
      (parsed as { data?: { id?: string } })?.data?.id ??
      externalItineraryId ??
      `wetu_${Date.now()}`;

    return {
      externalItineraryId: String(ext),
      raw: parsed
    };
  }
}
