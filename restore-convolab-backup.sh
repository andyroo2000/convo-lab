#!/usr/bin/env bash

set -Eeuo pipefail

umask 077

BACKUP_BUCKET="${BACKUP_BUCKET:-convolab-db-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-daily}"
GCS_SERVICE_ACCOUNT_FILE="${GCS_SERVICE_ACCOUNT_FILE:-/opt/convolab-runtime/secrets/gcloud-key.json}"
POSTGRES_DATABASES="${POSTGRES_DATABASES:-languageflow learning_os}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15-alpine}"

usage() {
  printf 'Usage: %s <backup timestamp or local backup directory>\n' "$0" >&2
  exit 2
}

[[ $# -eq 1 ]] || usage

for required_command in docker mktemp openssl rclone sha256sum; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    printf 'Required command is missing: %s\n' "${required_command}" >&2
    exit 1
  fi
done

source_value="$1"
work_dir="$(mktemp -d)"
container_name="convolab-restore-test-$(date -u +%Y%m%d%H%M%S)"
database_password="$(openssl rand -hex 24)"

cleanup() {
  local status=$?

  if [[ ${status} -ne 0 ]]; then
    printf 'Restore verification failed with exit status %s.\n' "${status}" >&2
    docker logs --tail 40 "${container_name}" >&2 || true
  fi
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
  rm -rf -- "${work_dir}"

  exit "${status}"
}

trap cleanup EXIT

if [[ -d "${source_value}" ]]; then
  cp -R "${source_value}/." "${work_dir}/"
else
  [[ "${source_value}" =~ ^20[0-9]{6}T[0-9]{6}Z$ ]] || usage
  rclone copy \
    ":gcs:${BACKUP_BUCKET}/${BACKUP_PREFIX}/${source_value}" \
    "${work_dir}" \
    --gcs-service-account-file "${GCS_SERVICE_ACCOUNT_FILE}" \
    --gcs-bucket-policy-only
fi

(
  cd "${work_dir}"
  sha256sum --check SHA256SUMS
)

docker run --detach \
  --name "${container_name}" \
  --env "POSTGRES_PASSWORD=${database_password}" \
  "${POSTGRES_IMAGE}" \
  >/dev/null

printf 'Started temporary PostgreSQL container.\n'
for _ in {1..30}; do
  if docker exec "${container_name}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "${container_name}" pg_isready -U postgres >/dev/null
printf 'Temporary PostgreSQL is ready.\n'

docker exec -i "${container_name}" psql -U postgres \
  <"${work_dir}/globals.sql" \
  >/dev/null
printf 'Restored PostgreSQL globals.\n'

for database in ${POSTGRES_DATABASES}; do
  [[ "${database}" =~ ^[A-Za-z0-9_]+$ ]] || {
    printf 'Unsupported database name: %s\n' "${database}" >&2
    exit 1
  }
  [[ -s "${work_dir}/${database}.dump" ]] || {
    printf 'Missing database dump: %s\n' "${database}" >&2
    exit 1
  }

  docker exec "${container_name}" createdb -U postgres -O languageflow "${database}"
  docker exec -i "${container_name}" pg_restore \
    -U postgres \
    --dbname "${database}" \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    <"${work_dir}/${database}.dump"

  table_count="$(docker exec "${container_name}" psql -U postgres -d "${database}" -Atc \
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")"
  if [[ ! "${table_count}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'Restored database %s has no public tables.\n' "${database}" >&2
    exit 1
  fi
  printf 'Restored %s successfully (%s public tables).\n' "${database}" "${table_count}"
done

printf 'Backup restore verification completed successfully.\n'
