import { GoogleAuth } from 'google-auth-library';

/**
 * Triggers the Cloud Run Job to process queued jobs.
 * This is called after adding jobs to BullMQ queues to wake up the workers.
 *
 * The worker job will:
 * - Process all pending jobs across all queues
 * - Auto-shutdown after 5 minutes of idle time
 *
 * Note: This only runs in production. In development, workers run embedded in the API service.
 */
export async function triggerWorkerJob(): Promise<void> {
  // Only trigger in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('⏭️  Skipping worker trigger (not in production)');
    return;
  }

  const jobName = process.env.WORKER_JOB_NAME;
  const region = process.env.WORKER_EXECUTION_REGION || 'us-central1';

  if (!jobName) {
    console.warn('⚠️  WORKER_JOB_NAME not set, cannot trigger worker job');
    return;
  }

  try {
    const auth = new GoogleAuth();
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();

    const url = `https://${region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${projectId}/jobs/${jobName}:run`;

    await client.request({
      url,
      method: 'POST',
    });

    console.log('✅ Worker job triggered via API');
  } catch (error) {
    console.error('❌ Failed to trigger worker job:', error);
    // Don't throw - triggering is best-effort, workers may already be running
  }
}
