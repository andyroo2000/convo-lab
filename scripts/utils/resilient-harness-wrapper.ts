/**
 * Resilient Harness Wrapper
 *
 * Provides a reusable wrapper for test harnesses that adds:
 * - Progress watchdog monitoring
 * - Checkpoint logging
 * - Graceful error handling
 */

import { ProgressWatchdog, ProgressWatchdogConfig } from './progress-watchdog.js';

export interface HarnessContext {
  recordProgress: () => void;
  logCheckpoint: (messageCount: number, startTime: number, lastMessage: string) => void;
}

export interface ResilientHarnessConfig {
  harnessName: string;
  watchdogTimeoutMs?: number;  // Default: 180000 (3 min)
  enableWarning?: boolean;     // Default: true
  disableWatchdog?: boolean;   // Disable watchdog entirely (for debugging)
}

export async function runResilientHarness(
  config: ResilientHarnessConfig,
  harnessFunction: (context: HarnessContext) => Promise<void>
): Promise<void> {
  // Skip watchdog if disabled
  if (config.disableWatchdog) {
    console.log(`\n⚠️  Watchdog disabled - running without timeout protection`);
    const context: HarnessContext = {
      recordProgress: () => {}, // No-op when disabled
      logCheckpoint: (count, start, msg) => {
        const elapsed = Date.now() - start;
        console.log(`\n📊 Checkpoint: ${count} messages, ${(elapsed/1000).toFixed(1)}s elapsed`);
        console.log(`   Last: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`);
      }
    };
    await harnessFunction(context);
    return;
  }

  const timeoutMs = config.watchdogTimeoutMs || 180000; // 3 minutes default
  const warningThresholdMs = config.enableWarning !== false
    ? timeoutMs * 0.75
    : undefined;

  const watchdog = new ProgressWatchdog({
    timeoutMs,
    warningThresholdMs,
    onWarning: () => {
      const elapsed = watchdog.getElapsedMs();
      console.log(`\n⚠️  No progress for ${elapsed}ms - approaching timeout (${timeoutMs}ms limit)`);
      console.log(`   Watchdog will terminate harness if no progress within ${timeoutMs - elapsed}ms`);
    },
    onTimeout: () => {
      console.log(`\n❌ ${config.harnessName} harness stuck - no progress for ${timeoutMs}ms`);
      console.log(`   Terminating to prevent infinite hang.`);
      console.log(`   Use --disable-watchdog flag if you need to debug without timeout protection.`);
      process.exit(1);
    }
  });

  const context: HarnessContext = {
    recordProgress: () => watchdog.recordProgress(),
    logCheckpoint: (count, start, msg) => {
      const elapsed = Date.now() - start;
      console.log(`\n📊 Checkpoint: ${count} messages, ${(elapsed/1000).toFixed(1)}s elapsed`);
      console.log(`   Last: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`);
    }
  };

  watchdog.start();

  try {
    await harnessFunction(context);
    console.log(`\n✅ ${config.harnessName} harness completed successfully`);
  } catch (error) {
    console.error(`\n❌ ${config.harnessName} harness failed:`, error);
    throw error;
  } finally {
    watchdog.stop();
  }
}
