#!/usr/bin/env bash
# Dumps the database to a compressed, restorable file and checks that it can be read back.
#
#   scripts/backup-db.sh [output-dir]
#
# Uses DATABASE_URL when pg_dump is installed locally, otherwise the tshirt_postgres
# container from docker-compose. Copy the result somewhere other than the database's
# own disk (see docs/DEPLOYMENT.md, "Backups").
set -euo pipefail

OUT_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${OUT_DIR}/tshirt_db-${STAMP}.dump"
mkdir -p "$OUT_DIR"

if command -v pg_dump >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"
  pg_restore --list "$FILE" >/dev/null
else
  CONTAINER="${POSTGRES_CONTAINER:-tshirt_postgres}"
  docker exec "$CONTAINER" pg_dump --format=custom --no-owner -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-tshirt_db}" > "$FILE"
  docker exec -i "$CONTAINER" pg_restore --list < "$FILE" >/dev/null
fi

SIZE="$(wc -c < "$FILE" | tr -d ' ')"
[ "$SIZE" -gt 1024 ] || { echo "backup looks empty ($SIZE bytes): $FILE" >&2; exit 1; }
echo "backup ok: $FILE ($SIZE bytes)"
