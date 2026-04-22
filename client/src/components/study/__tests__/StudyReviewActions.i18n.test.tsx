import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n from '../../../i18n';
import StudyReviewActions from '../StudyReviewActions';

describe('StudyReviewActions localization', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('ja');
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('renders localized study action labels in Japanese', () => {
    render(
      <StudyReviewActions
        card={{
          id: 'card-1',
          noteId: 'note-1',
          cardType: 'recognition',
          prompt: {},
          answer: {},
          state: {
            dueAt: null,
            queueState: 'review',
            scheduler: null,
            source: {},
          },
          answerAudioSource: 'missing',
          createdAt: '2026-04-22T12:00:00.000Z',
          updatedAt: '2026-04-22T12:00:00.000Z',
        }}
        onEdit={() => {}}
        onBury={() => {}}
        onToggleSuspend={() => {}}
        onForget={() => {}}
        onToggleSetDue={() => {}}
        onOpenBrowse={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'カードを編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '今回のセッションだけ隠す' })).toBeInTheDocument();
  });
});
