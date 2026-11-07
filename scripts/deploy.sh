#!/usr/bin/env bash
# Build and (re)start the app on the server. See docs/deploy.md.
# Usage: scripts/deploy.sh [--no-pull]
set -euo pipefail

cd "$(dirname "$0")/.."

# Pull first, then run the freshly pulled copy of this script: bash reads a
# script as it goes, so it must not change under a running instance.
if [[ "${1:-}" != "--no-pull" ]]; then
  git pull --ff-only
  exec "$0" --no-pull
fi

if [[ ! -f .env ]]; then
  echo "No .env in $(pwd). Copy .env.example and fill it in (docs/deploy.md)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a
: "${NEXT_PUBLIC_API_URL:?set NEXT_PUBLIC_API_URL in .env}"
: "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}"

echo "==> Database"
docker compose --env-file .env \
  -f docker/docker-compose.yml -f docker/docker-compose.prod.yml \
  up -d --wait postgres

echo "==> Dependencies"
# devDependencies are needed for the build, whatever NODE_ENV says.
npm ci --include=dev

echo "==> Build (base path: ${NEXT_PUBLIC_BASE_PATH:-/})"
npm run build

echo "==> Migrations"
(cd apps/api && npx prisma migrate deploy)

echo "==> Restart"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "Done."
