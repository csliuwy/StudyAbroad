# Backend

Express + TypeScript API for study-tour planning and execution.

## Features in this scaffold

- Canonical itinerary/budget/logistics models
- Collaboration messages and proposal upload intake
- Async research queue (mock search provider)
- Publish flow with retry and audit records
- Travefy adapter (real HTTP when key provided, mock otherwise)
- Wetu adapter placeholder for dual-publish mode
- Partner/traveler audience views

## Run

```bash
npm install
npm run dev
```

## Main API

- `GET /api/projects`
- `POST /api/projects` (JSON: `name`, optional `destination`, `partnerViewNote`, `travelerViewNote`)
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/chat`
- `POST /api/projects/:projectId/proposal` (form-data, key: `proposal`)
- `GET /api/projects/:projectId/research-jobs`
- `POST /api/projects/:projectId/budget/lines`
- `POST /api/projects/:projectId/logistics`
- `POST /api/projects/:projectId/runbook`
- `POST /api/projects/:projectId/publish` (`target`: `travefy|wetu|file`)
- `GET /api/projects/:projectId/publishes`
- `GET /api/projects/:projectId/view/partner`
- `GET /api/projects/:projectId/view/traveler`
