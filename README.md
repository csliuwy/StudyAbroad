# StudyTour Ops

Business system scaffold for a B/S study-tour planning and execution platform.

## Structure

- `frontend/`: web UI for collaboration, proposal intake, planning, and publishing.
- `backend/`: API server, domain models, queue workers, integrations.
- `doc/`: communication records and daily decision summaries.

## Delivery Scope

- User management is intentionally excluded and kept behind auth placeholders.
- Canonical itinerary/budget/logistics models are internal source of truth.
- Travefy and Wetu are publish targets via adapters.

## Security Notes

- Keep third-party credentials on the server only.
- Never commit `.env` with real keys.

## Quick Start

1. Create `.env` from `.env.example` under `backend/`.
2. Install dependencies in `backend/` and `frontend/`.
3. Start backend first, then frontend.
