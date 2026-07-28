import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutomaticStudyActivity } from '../useStudyActivity';

const start = vi.fn();
const stop = vi.fn();

const Harness = ({ enabled = true }: { enabled?: boolean }) => {
  useAutomaticStudyActivity(enabled, start, stop, 5_000);
  return null;
};

describe('useAutomaticStudyActivity', () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    start.mockReset();
    stop.mockReset();
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('engages while visible and pauses after the idle timeout', () => {
    render(<Harness />);
    expect(start).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('pauses while hidden and resumes when visible again', () => {
    render(<Harness />);
    visibility = 'hidden';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(stop).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(start).toHaveBeenCalledTimes(2);
  });
});
