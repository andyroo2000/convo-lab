#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d)"

cleanup() {
  rm -rf -- "${test_dir}"
}

trap cleanup EXIT

fake_bin="${test_dir}/bin"
backup_dir="${test_dir}/backups"
docker_log="${test_dir}/docker.log"
rclone_log="${test_dir}/rclone.log"
credentials_file="${test_dir}/service-account.json"
mkdir -p -- "${fake_bin}"
printf '{}\n' >"${credentials_file}"

cat >"${fake_bin}/docker" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"${FAKE_DOCKER_LOG}"

if [[ "$1" == "inspect" && "$2" == "--format" && "$3" == "{{.State.Running}}" ]]; then
  printf 'true\n'
  exit 0
fi

if [[ "$1" == "inspect" && "$2" == "--format" && "$3" == "{{.Config.Image}}" ]]; then
  printf 'postgres:15-alpine\n'
  exit 0
fi

if [[ "$1" == "exec" && "$3" == "pg_dumpall" ]]; then
  printf '%s\n' 'CREATE ROLE languageflow;'
  exit 0
fi

if [[ "$1" == "exec" && "$3" == "pg_dump" ]]; then
  printf 'custom dump for %s\n' "${*: -1}"
  exit 0
fi

if [[ "$1" == "exec" && "$2" == "-i" && "$4" == "pg_restore" ]]; then
  test -s /dev/stdin
  printf 'archive contents\n'
  exit 0
fi

printf 'Unexpected docker invocation: %s\n' "$*" >&2
exit 1
EOF

cat >"${fake_bin}/rclone" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >>"${FAKE_RCLONE_LOG}"
[[ "$1" == "copy" || "$1" == "check" ]]
EOF

chmod +x "${fake_bin}/docker" "${fake_bin}/rclone"

PATH="${fake_bin}:${PATH}" \
FAKE_DOCKER_LOG="${docker_log}" \
FAKE_RCLONE_LOG="${rclone_log}" \
BACKUP_DIR="${backup_dir}" \
BACKUP_BUCKET="convolab-db-backups-test" \
GCS_SERVICE_ACCOUNT_FILE="${credentials_file}" \
LOCAL_RETENTION_DAYS=0 \
"${repo_dir}/backup-convolab.sh"

success_timestamp="$(<"${backup_dir}/last-success")"
result_dir="${backup_dir}/${success_timestamp}"

test -s "${result_dir}/globals.sql"
test -s "${result_dir}/languageflow.dump"
test -s "${result_dir}/learning_os.dump"
test -s "${result_dir}/manifest.txt"
test -s "${result_dir}/SHA256SUMS"
test ! -e "${backup_dir}/.partial-${success_timestamp}"

grep -q 'pg_dump .* languageflow' "${docker_log}"
grep -q 'pg_dump .* learning_os' "${docker_log}"
grep -q '^copy .*:gcs:convolab-db-backups-test/daily/' "${rclone_log}"
grep -q '^check .*:gcs:convolab-db-backups-test/daily/' "${rclone_log}"

printf 'backup-convolab.sh test passed\n'
