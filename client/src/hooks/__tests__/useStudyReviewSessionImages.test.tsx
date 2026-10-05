import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  baseCardOne,
  baseCardTwo,
  createDeferred,
  createWrapper,
  prepareStudyAnswerAudioMock,
  regenerateStudyCardImageMock,
  resetStudyCardImageMock,
  setUpStudyReviewSession,
  updateStudyCardMock,
} from './studyReviewSessionTestHarness';
import useStudyReviewSession from '../useStudyReviewSession';

const generatedCard = {
  ...baseCardOne,
  revision: 5,
  answer: {
    ...baseCardOne.answer,
    answerImage: {
      url: 'https://example.com/kappa.png',
      filename: 'kappa.png',
      mediaKind: 'image' as const,
      source: 'generated' as const,
    },
  },
};
const request = { imagePrompt: 'A friendly kappa.', imageRole: 'answer' as const };

describe('review session image generation', () => {
  beforeEach(setUpStudyReviewSession);

  it('keeps the generated image and fresh revision when immediately saving the editor', async () => {
    regenerateStudyCardImageMock.mockResolvedValue(generatedCard);
    updateStudyCardMock.mockResolvedValue(generatedCard);
    const { result } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    prepareStudyAnswerAudioMock.mockResolvedValue(generatedCard);
    await act(async () => {
      const card = await result.current.regenerateCurrentCardImage(request);
      await result.current.saveCurrentCard({ prompt: card!.prompt, answer: card!.answer });
    });
    expect(regenerateStudyCardImageMock).toHaveBeenCalledWith({ cardId: 'card-1', ...request });
    expect(updateStudyCardMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedRevision: 5,
      prompt: generatedCard.prompt,
      answer: generatedCard.answer,
    });
    expect(result.current.currentCard?.answer.answerImage).toEqual(
      generatedCard.answer.answerImage
    );
  });

  it('ignores an image response after leaving the review session', async () => {
    const generation = createDeferred<typeof generatedCard>();
    regenerateStudyCardImageMock.mockReturnValue(generation.promise);
    const { result } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    const pending = result.current.regenerateCurrentCardImage(request);
    act(() => result.current.exitFocusMode());
    await act(async () => {
      generation.resolve(generatedCard);
      await pending;
    });
    expect(result.current.currentCard).toBeNull();
    expect(result.current.focusMode).toBe(false);
  });

  it('ignores an image response after moving to another card', async () => {
    updateStudyCardMock.mockResolvedValue(baseCardTwo);
    const generation = createDeferred<typeof generatedCard>();
    regenerateStudyCardImageMock.mockReturnValue(generation.promise);
    const { result } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    const pending = result.current.regenerateCurrentCardImage(request);
    act(() => {
      result.current.revealCurrentCard();
      result.current.handleBuryForSession();
    });
    expect(result.current.currentCard?.id).toBe(baseCardTwo.id);
    await act(async () => {
      generation.resolve(generatedCard);
      expect(await pending).toBeUndefined();
      await result.current.saveCurrentCard({
        prompt: baseCardTwo.prompt,
        answer: baseCardTwo.answer,
      });
    });
    expect(updateStudyCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: baseCardTwo.id })
    );
  });

  it('clears a failed image mutation before saving', async () => {
    updateStudyCardMock.mockResolvedValue(baseCardOne);
    regenerateStudyCardImageMock.mockRejectedValue(new Error('Image generation failed'));
    const { result } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    await act(async () => {
      await expect(result.current.regenerateCurrentCardImage(request)).rejects.toThrow(
        'Image generation failed'
      );
      await result.current.saveCurrentCard({
        prompt: baseCardOne.prompt,
        answer: baseCardOne.answer,
      });
    });
    expect(resetStudyCardImageMock).toHaveBeenCalledOnce();
    expect(updateStudyCardMock).toHaveBeenCalledOnce();
  });
});
