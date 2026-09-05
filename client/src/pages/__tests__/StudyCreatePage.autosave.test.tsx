import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

import { writeStudyDraftIntent } from '../../lib/studyDraftIntentStore';
import {
  createCardFromManualDraftState,
  deleteManualDraftMock,
  deleteManualDraftState,
  manualDraft,
  manualDraftsState,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
  updateManualDraftMock,
  updateManualDraftState,
} from './StudyCreatePageTestHarness';

const editSelectedDraftMeaning = async (meaning: string, rowIndex = 0) => {
  await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
  await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[rowIndex]);
  await userEvent.clear(screen.getByLabelText('Answer meaning'));
  await userEvent.type(screen.getByLabelText('Answer meaning'), meaning);
};

describe('StudyCreatePage: autosave and mutation ordering', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);

  it('selecting and editing a ready draft autosaves changes', async () => {
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await editSelectedDraftMeaning('business');

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-1',
        values: expect.objectContaining({
          answer: expect.objectContaining({ meaning: 'business' }),
          expectedRevision: 1,
        }),
      });
    });
  });

  it('replays a durable edit after reload when the server revision still matches', async () => {
    manualDraftsState.drafts = [manualDraft({ revision: 4 })];
    writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    renderPage();

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-1',
        values: { answer: { meaning: 'enterprise' }, expectedRevision: 4 },
      });
    });
    await waitFor(() => {
      expect(window.localStorage.getItem('convolab.studyDraftIntent.v2.user-1.draft-1')).toBeNull();
    });
  });

  it('retains a conflicting durable edit and requires explicit restore', async () => {
    manualDraftsState.drafts = [manualDraft({ revision: 5 })];
    writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This draft changed somewhere else.'
    );
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('company');
    expect(updateManualDraftMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create card' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Restore my edits' }));
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('enterprise');

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-1',
        values: expect.objectContaining({ expectedRevision: 5 }),
      });
    });
    expect(updateManualDraftMock).toHaveBeenCalledTimes(1);
  });

  it('clears a durable intent when the server already contains its values', async () => {
    manualDraftsState.drafts = [manualDraft({ revision: 5, answer: { meaning: 'enterprise' } })];
    writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    renderPage();

    await waitFor(() => {
      expect(window.localStorage.getItem('convolab.studyDraftIntent.v2.user-1.draft-1')).toBeNull();
    });
    expect(updateManualDraftMock).not.toHaveBeenCalled();
  });

  it('reconciles a same-owner intent written by another tab', async () => {
    manualDraftsState.drafts = [manualDraft({ revision: 4 })];
    renderPage();

    const intent = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'convolab.studyDraftIntent.v2.user-1.draft-1',
        newValue: JSON.stringify(intent),
      })
    );

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-1',
        values: { answer: { meaning: 'enterprise' }, expectedRevision: 4 },
      });
    });
  });

  it('flushes a debounced edit before selecting another draft', async () => {
    manualDraftsState.drafts = [
      manualDraft({ id: 'draft-a' }),
      manualDraft({
        id: 'draft-b',
        prompt: { cueText: '天気' },
        answer: {
          expression: '天気',
          meaning: 'weather',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
      }),
    ];

    renderPage();

    await editSelectedDraftMeaning('enterprise');
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-a',
        values: expect.objectContaining({
          answer: expect.objectContaining({ meaning: 'enterprise' }),
        }),
      });
    });
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('weather');
  });

  it('flushes a debounced edit before starting a new draft', async () => {
    manualDraftsState.drafts = [manualDraft({ id: 'draft-a' })];

    renderPage();

    await editSelectedDraftMeaning('enterprise');
    await userEvent.click(screen.getByRole('button', { name: 'New draft' }));

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-a',
        values: expect.objectContaining({
          answer: expect.objectContaining({ meaning: 'enterprise' }),
        }),
      });
    });
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('');
  });

  it('flushes a debounced edit when the page unmounts', async () => {
    manualDraftsState.drafts = [manualDraft({ id: 'draft-a' })];
    const { unmount } = renderPage();

    await editSelectedDraftMeaning('enterprise');
    unmount();

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-a',
        values: expect.objectContaining({
          answer: expect.objectContaining({ meaning: 'enterprise' }),
        }),
      });
    });
  });

  it('serializes autosaves so an older slow save cannot finish after a newer edit', async () => {
    let resolveFirstAutosave!: (draft: StudyManualCardDraft) => void;
    updateManualDraftMock
      .mockImplementationOnce(
        () =>
          new Promise<StudyManualCardDraft>((resolve) => {
            resolveFirstAutosave = resolve;
          })
      )
      .mockImplementation(async ({ draftId, values }) => manualDraft({ id: draftId, ...values }));
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await editSelectedDraftMeaning('business');

    await waitFor(() => expect(updateManualDraftMock).toHaveBeenCalledTimes(1));

    await userEvent.clear(screen.getByLabelText('Answer meaning'));
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'enterprise');
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 800);
      });
    });

    expect(updateManualDraftMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstAutosave(manualDraft());
      await Promise.resolve();
    });

    await waitFor(() => expect(updateManualDraftMock).toHaveBeenCalledTimes(2));
    expect(updateManualDraftMock).toHaveBeenLastCalledWith({
      draftId: 'draft-1',
      values: expect.objectContaining({
        answer: expect.objectContaining({ meaning: 'enterprise' }),
      }),
    });
  });

  it('waits for an active autosave before deleting its draft', async () => {
    let resolveAutosave!: (draft: StudyManualCardDraft) => void;
    updateManualDraftMock.mockReturnValueOnce(
      new Promise<StudyManualCardDraft>((resolve) => {
        resolveAutosave = resolve;
      })
    );
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await editSelectedDraftMeaning('enterprise');
    await waitFor(() => expect(updateManualDraftMock).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(deleteManualDraftMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveAutosave(manualDraft());
      await Promise.resolve();
    });

    await waitFor(() => expect(deleteManualDraftMock).toHaveBeenCalledWith('draft-1'));
  });

  it('keeps draft actions enabled while an autosave is pending', async () => {
    updateManualDraftState.isPending = true;
    manualDraftsState.drafts = [
      manualDraft({
        imagePlacement: 'both',
        imagePrompt: 'A realistic photo of a company office. No text.',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByRole('button', { name: 'Create card' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeEnabled();
  });

  it('disables draft actions while their own mutations are running', async () => {
    manualDraftsState.drafts = [manualDraft()];
    createCardFromManualDraftState.isPending = true;
    deleteManualDraftState.isPending = true;

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });
});
