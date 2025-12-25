/**
 * Progress Watchdog
 *
 * Monitors harness progress by tracking time since last message received.
 * Triggers warnings and timeouts when no progress is detected.
 */

export interface ProgressWatchdogConfig {
  timeoutMs: number;           // No progress for this long = stuck (default: 120000ms)
  warningThresholdMs?: number; // Warn at specified ms before timeout (optional)
  onWarning?: () => void;      // Callback when warning triggers
  onTimeout: () => void;       // Callback when timeout triggers
}

export class ProgressWatchdog {
  private lastProgressTime: number = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;
  private shouldAbort = false;
  private warningFired = false;

  constructor(
    private config: ProgressWatchdogConfig,
    abortController?: AbortController
  ) {
    this.abortController = abortController || null;
  }

  /**
   * Start monitoring for progress timeouts
   */
  start(): void {
    this.lastProgressTime = Date.now();
    this.resetTimers();
  }

  /**
   * Record that progress was made (resets the timeout timers)
   */
  recordProgress(): void {
    this.lastProgressTime = Date.now();
    this.warningFired = false; // Reset warning so it can fire again if needed
    this.resetTimers();
  }

  /**
   * Stop monitoring and clean up timers
   */
  stop(): void {
    this.clearTimers();
  }

  /**
   * Get elapsed time since last progress in milliseconds
   */
  getElapsedMs(): number {
    return Date.now() - this.lastProgressTime;
  }

  /**
   * Check if abort was triggered
   */
  getShouldAbort(): boolean {
    return this.shouldAbort;
  }

  /**
   * Reset all timers based on current configuration
   */
  private resetTimers(): void {
    this.clearTimers();

    // Set up warning timer if configured
    if (this.config.warningThresholdMs && this.config.onWarning) {
      this.warningTimer = setTimeout(() => {
        if (!this.warningFired) {
          this.warningFired = true;
          this.config.onWarning!();
        }
      }, this.config.warningThresholdMs);
    }

    // Set up timeout timer
    this.timer = setTimeout(() => {
      this.onTimeoutDetected();
    }, this.config.timeoutMs);
  }

  /**
   * Clear all active timers
   */
  private clearTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Handle timeout detection
   */
  private onTimeoutDetected(): void {
    console.log(`\n❌ Timeout detected - no progress for ${this.config.timeoutMs}ms`);
    this.shouldAbort = true;

    // Abort the current query if AbortController was provided
    if (this.abortController) {
      this.abortController.abort();
    }

    // Call the configured timeout handler
    this.config.onTimeout();
  }
}
