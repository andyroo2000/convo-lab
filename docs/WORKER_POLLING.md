# Worker Polling Configuration

## Overview

ConvoLab uses BullMQ workers to process background jobs (dialogue generation, audio generation, courses, etc.). These workers poll Redis to check for new jobs. The polling frequency directly impacts Redis usage and costs.

## Current Setup

- **6 workers** running continuously
- **Polling frequency** controlled by `WORKER_DRAIN_DELAY` environment variable
- **Default:** 30 seconds (30000ms)

## Cost Impact by Polling Frequency

| Delay       | Polls/min | Redis Cmds/Day | Monthly Cost   | Use Case                    |
| ----------- | --------- | -------------- | -------------- | --------------------------- |
| 5s          | 12/min    | ~103,000       | ~$15           | Active testing with friends |
| 30s         | 2/min     | ~17,000        | ~$3-5          | Balanced default            |
| 60s         | 1/min     | ~8,600         | $0 (free tier) | Efficient operation         |
| 300s (5min) | 0.2/min   | ~1,700         | $0 (minimal)   | Idle/not in use             |

_Upstash free tier: 10,000 commands/day_

## Changing Polling Frequency

### Option 1: Using the Helper Script (Recommended)

```bash
# Set to 5 seconds for testing with friends
./scripts/set-worker-polling.sh 5000

# Set to 5 minutes when not in use
./scripts/set-worker-polling.sh 300000

# Set to 60 seconds for efficient free-tier operation
./scripts/set-worker-polling.sh 60000

# Reset to default (30 seconds)
./scripts/set-worker-polling.sh 30000
```

The script automatically updates Cloud Run and triggers a restart (~30 seconds).

### Option 2: Manual via gcloud CLI

```bash
gcloud run services update convolab \
  --region=us-central1 \
  --update-env-vars WORKER_DRAIN_DELAY=300000
```

### Option 3: Via Google Cloud Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select the `convolab` service
3. Click **"Edit & Deploy New Revision"**
4. Go to **"Variables & Secrets"** tab
5. Add/Update environment variable:
   - Name: `WORKER_DRAIN_DELAY`
   - Value: `300000` (or your desired delay in milliseconds)
6. Click **Deploy**

## Trade-offs

### Faster Polling (5s)

✅ Jobs start processing within 5 seconds
✅ Better UX for immediate feedback
❌ Higher Redis costs (~$15/month)

### Slower Polling (300s)

✅ Minimal Redis costs (~$0/month)
✅ Ideal when app is idle
❌ Jobs may take up to 5 minutes to start processing

## Recommended Workflow

**When actively testing/demoing:**

```bash
./scripts/set-worker-polling.sh 5000
```

**When done for the day:**

```bash
./scripts/set-worker-polling.sh 300000
```

**For normal operation:**

```bash
./scripts/set-worker-polling.sh 30000
```

## Monitoring

Check your current Redis usage at: https://console.upstash.com

Look at the "Daily Commands" chart to see the impact of polling frequency changes.

## Future: Separate Worker Service

For long-term cost optimization, see the proposal at `docs/proposals/separate-worker-service.md` which would:

- Eliminate polling costs entirely when idle
- Scale workers to zero when no jobs pending
- Reduce costs by ~88% overall
