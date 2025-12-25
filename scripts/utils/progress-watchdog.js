/**
 * Progress Watchdog
 *
 * Monitors harness progress by tracking time since last message received.
 * Triggers warnings and timeouts when no progress is detected.
 */
export class ProgressWatchdog {
    config;
    lastProgressTime = Date.now();
    timer = null;
    warningTimer = null;
    abortController = null;
    shouldAbort = false;
    warningFired = false;
    constructor(config, abortController) {
        this.config = config;
        this.abortController = abortController || null;
    }
    /**
     * Start monitoring for progress timeouts
     */
    start() {
        this.lastProgressTime = Date.now();
        this.resetTimers();
    }
    /**
     * Record that progress was made (resets the timeout timers)
     */
    recordProgress() {
        this.lastProgressTime = Date.now();
        this.warningFired = false; // Reset warning so it can fire again if needed
        this.resetTimers();
    }
    /**
     * Stop monitoring and clean up timers
     */
    stop() {
        this.clearTimers();
    }
    /**
     * Get elapsed time since last progress in milliseconds
     */
    getElapsedMs() {
        return Date.now() - this.lastProgressTime;
    }
    /**
     * Check if abort was triggered
     */
    getShouldAbort() {
        return this.shouldAbort;
    }
    /**
     * Reset all timers based on current configuration
     */
    resetTimers() {
        this.clearTimers();
        // Set up warning timer if configured
        if (this.config.warningThresholdMs && this.config.onWarning) {
            this.warningTimer = setTimeout(() => {
                if (!this.warningFired) {
                    this.warningFired = true;
                    this.config.onWarning();
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
    clearTimers() {
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
    onTimeoutDetected() {
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
