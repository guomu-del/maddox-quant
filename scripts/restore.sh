#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_directory>"
  echo "Example: $0 backups/maddox_quant_20260831_120000"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$(cd "$1" && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/maddox_quant}"

if [[ ! -f "$BACKUP_DIR/database.dump" ]]; then
  echo "Missing database dump: $BACKUP_DIR/database.dump"
  exit 1
fi

echo "Restoring database (this replaces current data)..."
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$BACKUP_DIR/database.dump"

if [[ -f "$BACKUP_DIR/storage.tar.gz" ]]; then
  echo "Restoring storage..."
  tar -xzf "$BACKUP_DIR/storage.tar.gz" -C "$ROOT_DIR"
fi

echo "Restore complete from $BACKUP_DIR"
