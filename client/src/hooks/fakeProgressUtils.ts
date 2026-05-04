function calculateFakeProgress(elapsedMs: number, expectedMs: number): number {
  if (elapsedMs <= 0) return 0;

  const warmupMs = Math.min(4_000, expectedMs * 0.25);
  if (elapsedMs <= warmupMs) {
    const ratio = elapsedMs / warmupMs;
    return 25 * (1 - (1 - ratio) ** 2);
  }

  if (elapsedMs <= expectedMs) {
    const ratio = (elapsedMs - warmupMs) / (expectedMs - warmupMs);
    return 25 + 67 * (1 - (1 - ratio) ** 1.6);
  }

  const overtimeRatio = 1 - Math.exp(-(elapsedMs - expectedMs) / 20_000);
  return Math.min(98, 92 + 6 * overtimeRatio);
}

export default calculateFakeProgress;
