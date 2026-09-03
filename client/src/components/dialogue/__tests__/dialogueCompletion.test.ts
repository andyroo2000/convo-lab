import { describe, expect, it, vi } from 'vitest';
import {
  generateCompletedDialogueAudio,
  generateCompletedDialogueCourse,
} from '../dialogueCompletion';

describe('dialogue completion helpers', () => {
  it('skips automatic audio when it is disabled', async () => {
    const loadDialogueId = vi.fn();
    const generateAudio = vi.fn();

    const isCurrent = await generateCompletedDialogueAudio({
      enabled: false,
      signal: new AbortController().signal,
      isCurrentRun: () => true,
      loadDialogueId,
      generateAudio,
    });

    expect(isCurrent).toBe(true);
    expect(loadDialogueId).not.toHaveBeenCalled();
    expect(generateAudio).not.toHaveBeenCalled();
  });

  it('loads the dialogue and generates automatic audio', async () => {
    const { signal } = new AbortController();
    const generateAudio = vi.fn().mockResolvedValue(undefined);

    const isCurrent = await generateCompletedDialogueAudio({
      enabled: true,
      signal,
      isCurrentRun: () => true,
      loadDialogueId: vi.fn().mockResolvedValue('dialogue-1'),
      generateAudio,
    });

    expect(isCurrent).toBe(true);
    expect(generateAudio).toHaveBeenCalledWith('dialogue-1', signal);
  });

  it('stops automatic audio when the polling run is superseded', async () => {
    const generateAudio = vi.fn();

    const isCurrent = await generateCompletedDialogueAudio({
      enabled: true,
      signal: new AbortController().signal,
      isCurrentRun: () => false,
      loadDialogueId: vi.fn().mockResolvedValue('dialogue-1'),
      generateAudio,
    });

    expect(isCurrent).toBe(false);
    expect(generateAudio).not.toHaveBeenCalled();
  });

  it('allows completion to continue after a current audio failure', async () => {
    const error = new Error('audio failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const isCurrent = await generateCompletedDialogueAudio({
      enabled: true,
      signal: new AbortController().signal,
      isCurrentRun: () => true,
      loadDialogueId: vi.fn().mockRejectedValue(error),
      generateAudio: vi.fn(),
    });

    expect(isCurrent).toBe(true);
    expect(consoleError).toHaveBeenCalledWith('Failed to trigger audio generation:', error);
    consoleError.mockRestore();
  });

  it('returns the created audio course', async () => {
    const result = await generateCompletedDialogueCourse({
      enabled: true,
      signal: new AbortController().signal,
      isCurrentRun: () => true,
      createCourse: vi.fn().mockResolvedValue('course-1'),
      onError: vi.fn(),
    });

    expect(result).toEqual({ isCurrent: true, courseId: 'course-1' });
  });

  it.each([
    { isCurrent: true, reportsError: true },
    { isCurrent: false, reportsError: false },
  ])(
    'handles an audio course failure when current is $isCurrent',
    async ({ isCurrent, reportsError }) => {
      const error = new Error('course failed');
      const onError = vi.fn();

      const result = await generateCompletedDialogueCourse({
        enabled: true,
        signal: new AbortController().signal,
        isCurrentRun: () => isCurrent,
        createCourse: vi.fn().mockRejectedValue(error),
        onError,
      });

      expect(result).toEqual({ isCurrent, courseId: null });
      expect(onError).toHaveBeenCalledTimes(reportsError ? 1 : 0);
      if (reportsError) expect(onError).toHaveBeenCalledWith(error);
    }
  );
});
