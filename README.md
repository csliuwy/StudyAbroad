# StudyTour Ops

Business system scaffold for a B/S study-tour planning and execution platform.

**建议本机路径**：`~/code/StudyAbroad`（父目录名任意；与公网域名 `studyabroad.martxdata.com` 无关）。在 Linux 服务器上同步静态站点到 Nginx：`npm run deploy:www`（需 sudo，见 `scripts/deploy-static-to-www.sh`）。

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
- Backend: Helmet headers, configurable CORS (`CORS_ORIGIN`), global + upload rate limits, strict `project_…` id format, proposal type/size limits and temp-file cleanup after ingest. Set `TRUST_PROXY=1` when running behind Nginx. See `backend/.env.example`.

## Quick Start

1. Create `.env` from `.env.example` under `backend/`.
2. Install dependencies in `backend/` and `frontend/`.
3. Start backend first, then frontend.
