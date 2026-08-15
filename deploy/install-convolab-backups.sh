#!/usr/bin/env bash

set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  printf 'Run this installer as root.\n' >&2
  exit 1
fi

repo_dir="${REPO_DIR:-/opt/convolab}"
environment_file="/etc/convolab-backup.env"

if [[ ! -x "${repo_dir}/backup-convolab.sh" ]]; then
  printf 'Backup script is missing or not executable: %s\n' "${repo_dir}/backup-convolab.sh" >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  apt-get update
  apt-get install --yes rclone
fi

install -m 0644 \
  "${repo_dir}/deploy/systemd/convolab-backup.service" \
  /etc/systemd/system/convolab-backup.service
install -m 0644 \
  "${repo_dir}/deploy/systemd/convolab-backup.timer" \
  /etc/systemd/system/convolab-backup.timer

if [[ ! -e "${environment_file}" ]]; then
  install -m 0600 \
    "${repo_dir}/deploy/convolab-backup.env.example" \
    "${environment_file}"
fi

systemctl daemon-reload
systemctl enable --now convolab-backup.timer

printf 'Installed ConvoLab backups. Run the first backup with:\n'
printf '  systemctl start convolab-backup.service\n'
printf 'Inspect status with:\n'
printf '  systemctl status convolab-backup.service convolab-backup.timer\n'
