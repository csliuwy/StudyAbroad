#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
npm run build
sudo cp -a "$ROOT/frontend/dist/." /var/www/studyabroad/
sudo chown -R nginx:nginx /var/www/studyabroad
sudo nginx -t
sudo systemctl reload nginx
echo "OK: dist -> /var/www/studyabroad, nginx reloaded"

if systemctl cat studytour-backend.service >/dev/null 2>&1; then
  sudo systemctl restart studytour-backend
  echo "OK: studytour-backend restarted"
else
  echo "NOTE: studytour-backend.service not installed — restart backend manually if server code changed (e.g. cd backend && npm run start)."
fi

if curl -sf --connect-timeout 2 "http://127.0.0.1:8080/health" >/dev/null; then
  echo "OK: backend /health reachable (API via Nginx should not 502)."
else
  echo "WARN: backend not reachable on :8080 — start it (e.g. cd backend && npm run dev) or Nginx /api returns 502."
fi
