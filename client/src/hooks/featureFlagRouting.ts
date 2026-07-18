import type { FeatureFlags } from './useFeatureFlags';

export default function resolveEffectiveFeatureFlags(
  liveFlags: FeatureFlags | undefined,
  routingFlags?: FeatureFlags | null
): FeatureFlags | undefined {
  // null pins a session to the legacy API; undefined means no session snapshot exists yet.
  return routingFlags === undefined ? liveFlags : (routingFlags ?? undefined);
}
