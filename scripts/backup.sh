#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_DIR="$BACKUP_DIR/maddox_quant_$TIMESTAMP"

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/maddox_quant}"
STORAGE_PATH="${STORAGE_PATH:-$ROOT_DIR/storage/reports}"

mkdir -p "$ARCHIVE_DIR"

echo "Backing up database..."
pg_dump "$DATABASE_URL" --format=custom --file="$ARCHIVE_DIR/database.dump"

echo "Backing up storage..."
tar -czf "$ARCHIVE_DIR/storage.tar.gz" -C "$ROOT_DIR" storage

cat > "$ARCHIVE_DIR/manifest.txt" <<EOF
timestamp=$TIMESTAMP
database_url=$DATABASE_URL
storage_path=$STORAGE_PATH
EOF

echo "Backup saved to $ARCHIVE_DIR"
