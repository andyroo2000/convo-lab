import { describe, expect, it, vi } from 'vitest';

import openStudyCardEditor from '../studyEditorMutationState';

describe('openStudyCardEditor', () => {
  it('clears stale card mutations before entering edit mode', () => {
    const resetAudioMutation = vi.fn();
    const resetUpdateMutation = vi.fn();
    const setEditing = vi.fn();

    openStudyCardEditor({ resetAudioMutation, resetUpdateMutation, setEditing });

    expect(resetUpdateMutation).toHaveBeenCalledTimes(1);
    expect(resetAudioMutation).toHaveBeenCalledTimes(1);
    expect(setEditing).toHaveBeenCalledWith(true);
  });
});
