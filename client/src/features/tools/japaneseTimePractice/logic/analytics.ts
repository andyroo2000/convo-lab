import trackToolEvent from '../../analytics/toolAnalytics';
import type { TimePracticeMode } from './types';

type AnalyticsPrimitive = string | number | boolean | null;

export default function trackTimePracticeEvent(
  event: string,
  mode: TimePracticeMode,
  properties?: Record<string, AnalyticsPrimitive>
): void {
  trackToolEvent({
    tool: 'japanese-time-practice',
    event,
    mode,
    properties,
  });
}
