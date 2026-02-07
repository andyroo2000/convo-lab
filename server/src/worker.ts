/* eslint-disable no-console */
// Console logging is necessary for worker monitoring
import { audioWorker } from './jobs/audioQueue.js';
import { courseAudioWorker } from './jobs/courseAudioQueue.js';
import { courseWorker } from './jobs/courseQueue.js';
import { dialogueWorker } from './jobs/dialogueQueue.js';
import { emailWorker } from './jobs/emailQueue.js';
import { imageWorker } from './jobs/imageQueue.js';

console.log('🚀 BullMQ Workers Starting...');
console.log('Workers initialized:', {
  audioWorker: !!audioWorker,
  courseAudioWorker: !!courseAudioWorker,
  dialogueWorker: !!dialogueWorker,
  imageWorker: !!imageWorker,
  courseWorker: !!courseWorker,
  emailWorker: !!emailWorker,
});

const workers = [
  audioWorker,
  courseAudioWorker,
  dialogueWorker,
  imageWorker,
  courseWorker,
  emailWorker,
];

// Check if all queues are empty
async function areQueuesEmpty(): Promise<boolean> {
  try {
    const { audioQueue } = await import('./jobs/audioQueue.js');
    const { courseAudioQueue } = await import('./jobs/courseAudioQueue.js');
    const { dialogueQueue } = await import('./jobs/dialogueQueue.js');
    const { imageQueue } = await import('./jobs/imageQueue.js');
    const { courseQueue } = await import('./jobs/courseQueue.js');
    const { emailQueue } = await import('./jobs/emailQueue.js');

    const queues = [
      audioQueue,
      courseAudioQueue,
      dialogueQueue,
      imageQueue,
      courseQueue,
      emailQueue,
    ];

    const counts = await Promise.all(
      queues.map(async (queue) => {
        const waiting = await queue.getWaitingCount();
        const active = await queue.getActiveCount();
        const delayed = await queue.getDelayedCount();
        return waiting + active + delayed;
      })
    );

    const totalJobs = counts.reduce((sum, count) => sum + count, 0);
    console.log(`📊 Total pending jobs: ${totalJobs}`);

    return totalJobs === 0;
  } catch (error) {
    console.error('Error checking queue status:', error);
    return false;
  }
}

// Auto-shutdown when idle
let idleTimeout: NodeJS.Timeout | null = null;
const IDLE_SHUTDOWN_DELAY = 5 * 60 * 1000; // 5 minutes

async function checkAndShutdown() {
  const empty = await areQueuesEmpty();

  if (empty) {
    if (!idleTimeout) {
      console.log('⏳ Queues empty, will shutdown in 5 minutes if still idle...');
      idleTimeout = setTimeout(async () => {
        const stillEmpty = await areQueuesEmpty();
        if (stillEmpty) {
          console.log('✅ Queues still empty after 5 min, shutting down gracefully...');
          await gracefulShutdown();
        } else {
          console.log('🔄 New jobs arrived, cancelling shutdown');
          idleTimeout = null;
        }
      }, IDLE_SHUTDOWN_DELAY);
    }
  } else if (idleTimeout) {
    clearTimeout(idleTimeout);
    idleTimeout = null;
    console.log('🔄 Jobs detected, staying alive');
  }
}

// Check every 30 seconds
setInterval(checkAndShutdown, 30000);

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🛑 Shutting down workers...');

  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
      } catch (error) {
        console.error('Error closing worker:', error);
      }
    })
  );

  console.log('✅ All workers closed');
  process.exit(0);
}

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

console.log('✅ Workers ready and listening for jobs...');
