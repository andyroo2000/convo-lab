# Production database backups

ConvoLab stores durable production data in two databases inside the
`convolab-postgres` container:

- `languageflow` contains the legacy ConvoLab application data.
- `learning_os` contains the canonical study cards, reviews, progress, and
  analytics used by the current web and iOS applications.

The nightly backup job creates PostgreSQL custom-format dumps for both databases
plus a globals dump, manifest, and SHA-256 checksums. It uploads each immutable
backup set to `gs://convolab-db-backups/daily/<UTC timestamp>`. The bucket
lifecycle deletes daily backup objects after 30 days; Google Cloud Storage soft
delete provides its configured recovery window after lifecycle deletion.

Flashcard audio and images are not copied by this job. They remain in the
production media bucket and use that bucket's existing soft-delete protection.

## One-time installation

Create the private bucket in the same Google Cloud project as the existing
service account, enable uniform bucket-level access, and apply the lifecycle:

```bash
gcloud storage buckets create gs://convolab-db-backups \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention \
  --soft-delete-duration=7d
gcloud storage buckets update gs://convolab-db-backups \
  --lifecycle-file=deploy/gcs-backup-lifecycle.json
```

On the production droplet, pull the repository version that contains this job,
then install the timer:

```bash
cd /opt/convolab
chmod +x backup-convolab.sh restore-convolab-backup.sh deploy/install-convolab-backups.sh
deploy/install-convolab-backups.sh
systemctl start convolab-backup.service
```

The installer creates `/etc/convolab-backup.env` only when it does not already
exist. Edit that file to change the bucket or configure an optional monitoring
ping URL. Do not commit monitoring URLs or credentials.

## Routine checks

Check the most recent local success stamp and timer state:

```bash
cat /opt/convolab-data/backups/postgres/last-success
systemctl list-timers convolab-backup.timer
journalctl -u convolab-backup.service --since '7 days ago'
```

List offsite backup sets:

```bash
gcloud storage ls gs://convolab-db-backups/daily/
```

## Restore verification

Run the verification script with an offsite timestamp. It downloads the backup,
checks every checksum, starts a temporary PostgreSQL 15 container, restores both
databases, verifies that they contain public tables, and removes the temporary
container and files:

```bash
/opt/convolab/restore-convolab-backup.sh 20260815T031500Z
```

You can also pass the path to an existing local backup directory. Never point
the verification script at the production PostgreSQL container.
