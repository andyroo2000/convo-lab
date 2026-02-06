# Proposal: Separate Worker Service for Job Processing

**Status:** Proposed
**Date:** 2025-11-28
**Author:** Claude Code
**Priority:** Medium (Cost optimization)

## Problem Statement

Our current architecture runs 4 BullMQ workers continuously in the main Cloud Run service, polling Redis every 5 seconds when idle. This results in approximately **70,000 Redis commands per day**, which significantly exceeds the Upstash free tier limit of 10,000 commands/day.

### Current Cost Impact

- **Redis (Upstash):** ~$10-15/month on pay-as-you-go
- **Cloud Run:** Workers consume CPU/memory even when no jobs are pending
- **Scalability:** All 4 workers must scale together with the API service

### Current Architecture

```
┌─────────────────────────────────────────┐
│   Cloud Run: convolab                   │
│                                         │
│  ┌──────────┐     ┌────────────────┐   │
│  │   API    │────▶│  4 Workers     │   │
│  │  Routes  │     │  (Always On)   │   │
│  └──────────┘     └────────────────┘   │
│                          │              │
└──────────────────────────┼──────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Redis     │
                    │  (Upstash)  │
                    └─────────────┘
                    100K cmds/day
```

**Workers running 24/7:**

1. `audioWorker` - Audio generation
2. `dialogueWorker` - Dialogue generation
3. `imageWorker` - Image generation
4. `courseWorker` - Course generation

**Polling calculation:**

- 4 workers × 12 polls/minute (every 5 sec) = 48 polls/minute
- 48 × 60 × 24 = **69,120 polls/day**
- Each poll = 1-2 Redis commands

## Proposed Solution: Separate Worker Service

Split the application into two independent Cloud Run services:

### Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│  Cloud Run: convolab │         │ Cloud Run: workers   │
│       (API)          │         │   (Job Processing)   │
│                      │         │                      │
│  ┌────────────────┐  │         │  ┌────────────────┐  │
│  │  API Routes    │  │         │  │  4 Workers     │  │
│  │  - Add jobs    │  │         │  │  (Auto-scale)  │  │
│  │  - Job status  │  │         │  └────────────────┘  │
│  └────────────────┘  │         │         │            │
│         │            │         └─────────┼────────────┘
└─────────┼────────────┘                   │
          │                                │
          ▼                                ▼
     ┌─────────────────────────────────────┐
     │          Redis (Upstash)            │
     │                                     │
     │  Queue: jobs waiting/processing     │
     └─────────────────────────────────────┘
          ▲
          │
     ┌────┴──────────────────┐
     │  Cloud Scheduler      │
     │  (Every 2-5 minutes)  │
     │  Triggers worker if   │
     │  jobs pending         │
     └───────────────────────┘
```

### How It Works

1. **API Service** (`convolab`):
   - Handles all HTTP requests from frontend
   - Adds jobs to Redis queue via BullMQ
   - Returns job ID to client immediately
   - Optionally triggers worker service via HTTP
   - **No workers running** = No polling = Minimal Redis usage

2. **Worker Service** (`convolab-workers`):
   - Same codebase, different entry point
   - Runs all 4 workers
   - Cloud Run scales to **zero instances** when no jobs
   - Wakes up when:
     - API service makes HTTP call to wake endpoint
     - OR Cloud Scheduler checks every 2-5 minutes for pending jobs
   - Processes all pending jobs
   - Auto-scales down to zero after idle period (5-10 minutes)

3. **Wake Mechanism** (Choose one or both):
   - **Option A:** API calls worker service HTTP endpoint after adding job
   - **Option B:** Cloud Scheduler runs every 2-5 minutes, checks for pending jobs, wakes workers if needed
   - **Hybrid:** API wake for immediate jobs, Scheduler as backup

## Implementation Plan

### Phase 1: Create Worker Service

1. **Create new entry point:** `server/src/worker.ts`

   ```typescript
   import { audioWorker } from './jobs/audioQueue.js';
   import { dialogueWorker } from './jobs/dialogueQueue.js';
   import { imageWorker } from './jobs/imageQueue.js';
   import { courseWorker } from './jobs/courseQueue.js';

   console.log('Workers started:', {
     audioWorker,
     dialogueWorker,
     imageWorker,
     courseWorker,
   });

   // Keep process alive
   setInterval(() => {
     console.log('Worker heartbeat');
   }, 60000);
   ```

2. **Modify main API:** `server/src/index.ts`
   - Remove worker imports
   - Keep only API routes

3. **Add Dockerfile for workers:** `server/Dockerfile.worker`
   - Same as main Dockerfile but runs `worker.ts` instead of `index.ts`

4. **Deploy worker service:**
   ```bash
   gcloud run deploy convolab-workers \
     --source ./server \
     --dockerfile Dockerfile.worker \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --min-instances 0 \
     --max-instances 3 \
     --memory 2Gi \
     --cpu 2
   ```

### Phase 2: Add Wake Mechanism

**Option A: HTTP Wake Endpoint**

Add to `server/src/worker.ts`:

```typescript
import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/wake', (req, res) => {
  console.log('Wake endpoint called');
  res.json({ status: 'awake' });
});

app.listen(PORT, () => {
  console.log(`Worker service listening on port ${PORT}`);
});
```

Modify API routes to call wake endpoint after adding jobs:

```typescript
await jobQueue.add('generate-dialogue', data);

// Wake worker service (non-blocking)
fetch(process.env.WORKER_SERVICE_URL + '/wake').catch((err) =>
  console.error('Failed to wake workers:', err)
);
```

**Option B: Cloud Scheduler**

Create scheduler job:

```bash
gcloud scheduler jobs create http check-jobs \
  --schedule="*/5 * * * *" \
  --uri="https://convolab-workers-[PROJECT].run.app/wake" \
  --http-method=GET
```

### Phase 3: Testing & Monitoring

1. Test job processing with worker service
2. Monitor Redis command usage in Upstash dashboard
3. Monitor Cloud Run scaling behavior
4. Measure cost savings

## Benefits

### Cost Savings

- **Redis:** 95%+ reduction (100K → <5K commands/day)
  - Workers only poll when actually running (1-2 hours/day instead of 24/7)
  - Could fit within free tier with scheduler-based wake
- **Cloud Run (Workers):** 80%+ reduction
  - Workers scale to zero when idle
  - Pay only for actual job processing time
- **Estimated monthly savings:** $10-15/month (Redis) + $5-10/month (Cloud Run) = **$15-25/month**

### Operational Benefits

- **Independent scaling:** API and workers scale based on different needs
- **Resource isolation:** Heavy jobs don't impact API responsiveness
- **Better monitoring:** Separate logs/metrics for API vs workers
- **Easier debugging:** Worker issues don't bring down API

### Development Benefits

- **Same codebase:** No code duplication, just different entry points
- **Easy to revert:** Can switch back to monolithic if needed
- **Gradual migration:** Can run both simultaneously during transition

## Trade-offs

### Complexity

- **+1 Cloud Run service** to manage
- **Deploy coordination:** Need to deploy both services for some changes
- **Configuration:** Additional environment variables for service URLs

### Job Latency

- **Startup time:** Workers may take 10-30 seconds to start from zero
- **Scheduler delay:** With scheduler-only wake, up to 5-minute delay
- **Mitigation:** Use HTTP wake for immediate jobs, scheduler as backup

### Development Workflow

- **Local testing:** Need to run both API and worker processes locally
- **Docker Compose:** May need to update for two services

## Migration Strategy

### Minimal Risk Approach

1. **Deploy worker service** (Phase 1)
2. **Keep existing workers running** in API service
3. **Test worker service** with canary traffic
4. **Monitor both** for 1 week
5. **Remove workers from API** once confident
6. **Monitor cost reduction**

### Rollback Plan

If issues arise:

1. Re-enable workers in API service
2. Scale worker service to zero
3. Investigate and fix
4. Retry migration

## Estimated Timeline

- **Phase 1 (Worker Service):** 2-4 hours
- **Phase 2 (Wake Mechanism):** 1-2 hours
- **Phase 3 (Testing):** 1-2 days monitoring
- **Total:** Can be completed in a weekend

## Cost-Benefit Analysis

**Current Monthly Costs:**

- Redis (Upstash): ~$15
- Cloud Run (always-on workers): ~$10
- **Total:** ~$25/month

**Projected Monthly Costs:**

- Redis (minimal polling): $0 (free tier)
- Cloud Run (scale-to-zero workers): ~$3
- Cloud Scheduler: $0.10
- **Total:** ~$3/month

**Savings:** ~$22/month (~88% reduction)

## Alternative Considered

**Single General-Purpose Worker:**

- Consolidate 4 workers into 1 worker handling all job types
- Reduces polling by 75% (4 workers → 1 worker)
- **Pros:** Simpler to implement, no new service
- **Cons:** Jobs queue sequentially, still polls 24/7, doesn't optimize Cloud Run costs
- **Verdict:** Good short-term fix, but separate service is better long-term

## Decision

**Recommended:** Implement separate worker service when:

- App structure stabilizes
- Development velocity slows
- Cost optimization becomes priority

**For now:** Consider single worker as interim solution if experimenting heavily.

## References

- BullMQ Documentation: https://docs.bullmq.io/
- Cloud Run Scale-to-Zero: https://cloud.google.com/run/docs/about-instance-autoscaling
- Upstash Redis Pricing: https://upstash.com/pricing

## Questions & Discussion

- What's acceptable job latency for users? (affects wake mechanism choice)
- Expected job volume/frequency? (affects cost savings estimate)
- How often do we deploy changes to worker logic? (affects deploy coordination complexity)
