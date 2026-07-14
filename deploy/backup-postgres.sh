#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_DIR=/opt/truemetaverse
BACKUP_DIR=/opt/backups/truemetaverse
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$BACKUP_DIR/postgres-$STAMP.dump"

find "$BACKUP_DIR" -type f -name 'postgres-*.dump' -mtime +7 -delete
