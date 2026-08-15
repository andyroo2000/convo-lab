#!/usr/bin/env bash

set -Eeuo pipefail

umask 077

BACKUP_DIR="${BACKUP_DIR:-/opt/convolab-data/backups/postgres}"
BACKUP_BUCKET="${BACKUP_BUCKET:-convolab-db-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-daily}"
GCS_SERVICE_ACCOUNT_FILE="${GCS_SERVICE_ACCOUNT_FILE:-/opt/convolab-runtime/secrets/gcloud-key.json}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-2}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-convolab-postgres}"
POSTGRES_USER="${POSTGRES_USER:-languageflow}"
POSTGRES_DATABASES="${POSTGRES_DATABASES:-languageflow learning_os}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial_dir="${BACKUP_DIR}/.partial-${timestamp}"
final_dir="${BACKUP_DIR}/${timestamp}"
success_stamp="${BACKUP_DIR}/last-success"
remote_path=":gcs:${BACKUP_BUCKET}/${BACKUP_PREFIX}/${timestamp}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

ping_healthcheck() {
  local suffix="${1:-}"

  if [[ -z "${HEALTHCHECK_URL}" ]]; then
    return 0
  fi

  curl --fail --silent --show-error \
    --connect-timeout 5 \
    --max-time 10 \
    "${HEALTHCHECK_URL}${suffix}" \
    >/dev/null
}

cleanup() {
  local status=$?

  if [[ ${status} -ne 0 ]]; then
    log "Backup failed with exit status ${status}."
    ping_healthcheck "/fail" || true
    rm -rf -- "${partial_dir}"
  fi

  exit "${status}"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Required command is missing: $1"
    return 1
  fi
}

validate_configuration() {
  local database

  [[ "${BACKUP_BUCKET}" =~ ^[a-z0-9][a-z0-9._-]{1,221}[a-z0-9]$ ]] || {
    log "BACKUP_BUCKET is not a valid bucket name."
    return 1
  }
  [[ "${BACKUP_PREFIX}" =~ ^[A-Za-z0-9._/-]+$ ]] || {
    log "BACKUP_PREFIX contains unsupported characters."
    return 1
  }
  [[ "${LOCAL_RETENTION_DAYS}" =~ ^[0-9]+$ ]] || {
    log "LOCAL_RETENTION_DAYS must be a non-negative integer."
    return 1
  }
  [[ -r "${GCS_SERVICE_ACCOUNT_FILE}" ]] || {
    log "Google service-account file is not readable: ${GCS_SERVICE_ACCOUNT_FILE}"
    return 1
  }

  for database in ${POSTGRES_DATABASES}; do
    [[ "${database}" =~ ^[A-Za-z0-9_]+$ ]] || {
      log "Database name contains unsupported characters: ${database}"
      return 1
    }
  done
}

require_command curl
require_command docker
require_command rclone
require_command sha256sum
validate_configuration

if ! docker inspect --format '{{.State.Running}}' "${POSTGRES_CONTAINER}" 2>/dev/null | grep -qx true; then
  log "PostgreSQL container is not running: ${POSTGRES_CONTAINER}"
  exit 1
fi

ping_healthcheck "/start" || true

mkdir -p -- "${BACKUP_DIR}"
rm -rf -- "${partial_dir}"
mkdir -- "${partial_dir}"

log "Backing up PostgreSQL globals."
docker exec "${POSTGRES_CONTAINER}" \
  pg_dumpall -U "${POSTGRES_USER}" --globals-only \
  >"${partial_dir}/globals.sql"

for database in ${POSTGRES_DATABASES}; do
  dump_file="${partial_dir}/${database}.dump"
  log "Backing up database ${database}."
  docker exec "${POSTGRES_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" \
      --format=custom \
      --compress=6 \
      --no-owner \
      --no-privileges \
      "${database}" \
    >"${dump_file}"

  if [[ ! -s "${dump_file}" ]]; then
    log "Database dump is empty: ${database}"
    exit 1
  fi

  docker exec -i "${POSTGRES_CONTAINER}" pg_restore --list \
    <"${dump_file}" \
    >/dev/null
done

{
  printf 'created_at=%s\n' "${timestamp}"
  printf 'hostname=%s\n' "$(hostname)"
  printf 'postgres_container=%s\n' "${POSTGRES_CONTAINER}"
  printf 'postgres_databases=%s\n' "${POSTGRES_DATABASES}"
  printf 'postgres_image=%s\n' "$(docker inspect --format '{{.Config.Image}}' "${POSTGRES_CONTAINER}")"
} >"${partial_dir}/manifest.txt"

(
  cd "${partial_dir}"
  sha256sum ./*.dump globals.sql manifest.txt >SHA256SUMS
)

log "Uploading backup to gs://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${timestamp}."
rclone copy "${partial_dir}" "${remote_path}" \
  --gcs-service-account-file "${GCS_SERVICE_ACCOUNT_FILE}" \
  --gcs-bucket-policy-only \
  --immutable \
  --transfers 2 \
  --checkers 4

log "Verifying uploaded backup."
rclone check "${partial_dir}" "${remote_path}" \
  --gcs-service-account-file "${GCS_SERVICE_ACCOUNT_FILE}" \
  --gcs-bucket-policy-only \
  --one-way

mv -- "${partial_dir}" "${final_dir}"
printf '%s\n' "${timestamp}" >"${success_stamp}.tmp"
mv -- "${success_stamp}.tmp" "${success_stamp}"

find "${BACKUP_DIR}" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '20????????T??????Z' \
  -mtime "+${LOCAL_RETENTION_DAYS}" \
  -exec rm -rf -- {} +

ping_healthcheck || true
trap - EXIT
log "Backup completed successfully: ${timestamp}"
