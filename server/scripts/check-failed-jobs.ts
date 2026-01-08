import { courseQueue } from '../src/jobs/courseQueue.js';

async function checkFailedJobs() {
  console.log('\n📊 Checking Course Generation Jobs\n');

  const failed = await courseQueue.getFailed();
  const completed = await courseQueue.getCompleted();
  const waiting = await courseQueue.getWaiting();
  const active = await courseQueue.getActive();

  console.log(`Waiting: ${waiting.length}`);
  console.log(`Active: ${active.length}`);
  console.log(`Completed: ${completed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed Jobs:\n');
    for (const job of failed) {
      console.log(`Job ID: ${job.id}`);
      console.log(`Course ID: ${job.data.courseId}`);
      console.log(`Failed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'Unknown'}`);
      console.log(`Error: ${job.failedReason || 'No error message'}`);
      if (job.stacktrace && job.stacktrace.length > 0) {
        console.log(`Stack trace (first 10 lines):`);
        console.log(job.stacktrace.slice(0, 10).join('\n'));
      }
      console.log('');
    }
  }

  if (completed.length > 0) {
    console.log('\n✅ Completed Jobs:\n');
    for (const job of completed.slice(0, 5)) {
      console.log(`Job ID: ${job.id}`);
      console.log(`Course ID: ${job.data.courseId}`);
      console.log(`Completed at: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'Unknown'}`);
      console.log('');
    }
  }

  await courseQueue.close();
  process.exit(0);
}

checkFailedJobs();
