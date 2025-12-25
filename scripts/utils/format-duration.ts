/**
 * Format a duration in milliseconds to a human-readable string
 *
 * Examples:
 * - 45000ms => "45 seconds"
 * - 90000ms => "1 minute and 30 seconds"
 * - 3600000ms => "1 hour"
 * - 5400000ms => "1 hour and 30 minutes"
 */
export const formatDuration = (durationMs: number): string => {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} and ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
  } else {
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  }
};
