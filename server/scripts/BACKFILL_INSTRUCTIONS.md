# Backfill Sentence Metadata Migration

## Overview

This migration script processes all existing sentences in the database that have empty metadata and computes furigana (Japanese) or pinyin (Chinese) data for them.

## Why is this needed?

Previously, furigana/pinyin was computed on-the-fly for every request. Now, we store this metadata in the database during dialogue generation for better performance. This script backfills metadata for dialogues created before this optimization.

## Running Locally

```bash
cd server
npm run backfill:metadata
```

**Prerequisites:**

- Furigana service running on port 8000 (for Japanese)
- Pinyin service running on port 8001 (for Chinese)

## Running in Production (Cloud Run)

### Option 1: SSH into Cloud Run instance (Recommended)

1. **Connect to Cloud Run instance:**

   ```bash
   gcloud run services proxy convo-lab --port=8080
   ```

2. **In another terminal, exec into the container:**

   ```bash
   # Find the running container
   CONTAINER_ID=$(docker ps | grep convo-lab | awk '{print $1}')

   # Exec into it
   docker exec -it $CONTAINER_ID sh
   ```

3. **Run the migration:**
   ```bash
   cd /app
   npx tsx scripts/backfill-sentence-metadata.ts
   ```

### Option 2: Deploy a one-off job

1. **Create a custom Dockerfile for the migration:**

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app

   # Copy server files
   COPY server/package*.json ./
   RUN npm install

   COPY server/src ./src
   COPY server/scripts ./scripts
   COPY server/prisma ./prisma

   # Generate Prisma client
   RUN npx prisma generate

   # Run migration
   CMD ["npx", "tsx", "scripts/backfill-sentence-metadata.ts"]
   ```

2. **Deploy as Cloud Run Job:**

   ```bash
   gcloud run jobs create backfill-metadata \
     --image gcr.io/YOUR_PROJECT/backfill-metadata \
     --region us-central1 \
     --set-env-vars DATABASE_URL=$DATABASE_URL,FURIGANA_SERVICE_URL=$FURIGANA_SERVICE_URL

   gcloud run jobs execute backfill-metadata
   ```

### Option 3: Run from local machine against production DB

⚠️ **Use with caution** - This connects your local machine to the production database.

1. **Set production DATABASE_URL in your local .env:**

   ```bash
   # Get the production DATABASE_URL from Cloud Run
   gcloud run services describe convo-lab --format='value(spec.template.spec.containers[0].env[?name=="DATABASE_URL"].value)'
   ```

2. **Make sure language services are accessible:**

   ```bash
   # Either:
   # - Run language services locally
   # - Or set FURIGANA_SERVICE_URL and PINYIN_SERVICE_URL to production endpoints
   ```

3. **Run the migration:**
   ```bash
   cd server
   npm run backfill:metadata
   ```

## What the script does

1. **Finds sentences** with empty or null metadata
2. **Processes in batches** of 10 to avoid overwhelming the language processor
3. **Computes metadata** for each sentence using the language processor
4. **Updates the database** with the computed metadata
5. **Shows progress** with detailed statistics
6. **Handles errors gracefully** - failed sentences are logged but don't stop the migration

## Script Features

- ✅ **Idempotent**: Safe to run multiple times (skips already-processed sentences)
- ✅ **Resumable**: If it fails, just run it again
- ✅ **Progress tracking**: Shows batch progress and overall statistics
- ✅ **Error handling**: Continues processing even if some sentences fail
- ✅ **Language detection**: Only processes Japanese and Chinese sentences
- ✅ **Batch processing**: Processes 10 sentences at a time for optimal performance

## Expected Output

```
🔍 Finding sentences with empty metadata...

📊 Found 150 sentences to process

📦 Processing batch 1/15 (10 sentences)...
  ✓ Batch complete: 10 updated, 0 skipped, 0 errors
  📈 Progress: 10/150 (7%)

📦 Processing batch 2/15 (10 sentences)...
  ✓ Batch complete: 9 updated, 0 skipped, 1 errors
  📈 Progress: 20/150 (13%)

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Backfill complete!

📊 Statistics:
   Total processed: 150
   Successfully updated: 148
   Errors: 2
   Success rate: 99%

🎉 Script finished successfully
```

## Troubleshooting

### Language services not available

**Error:** `Furigana service unavailable, using fallback`

**Solution:** Make sure the furigana/pinyin microservices are running and accessible.

### Database connection issues

**Error:** `Can't reach database server`

**Solution:** Check your `DATABASE_URL` is correct and the database is accessible.

### Out of memory

**Error:** `JavaScript heap out of memory`

**Solution:** Reduce `BATCH_SIZE` in the script from 10 to 5.

## Verification

After running the migration, verify that metadata is populated:

```sql
-- Check how many sentences have metadata
SELECT
  COUNT(*) as total_sentences,
  COUNT(CASE WHEN metadata != '{}' THEN 1 END) as with_metadata,
  COUNT(CASE WHEN metadata = '{}' OR metadata IS NULL THEN 1 END) as without_metadata
FROM "Sentence";
```

## Performance Notes

- **Batch size**: 10 sentences per batch (configurable)
- **Delay between batches**: 500ms (to be nice to the language processor)
- **Expected time**: ~1-2 seconds per sentence (including API calls)
- **Total time**: For 1000 sentences: ~20-40 minutes

## Rollback

If you need to rollback (clear all metadata):

```sql
UPDATE "Sentence" SET metadata = '{}';
```

⚠️ **Don't do this unless absolutely necessary** - the on-the-fly processing is slow!
