import { GoogleAuth } from 'google-auth-library';

/**
 * Triggers the Cloud Run Job to process pending queue jobs.
 * Non-blocking - fires and forgets.
 */
export async function triggerWorkerJob(): Promise<void> {
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

    await client.request({ url, method: 'POST' });
    console.log('✅ Worker job triggered via API');
  } catch (error: any) {
    console.error('Failed to trigger worker job:', error.message);
  }
}
