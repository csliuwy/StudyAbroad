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
