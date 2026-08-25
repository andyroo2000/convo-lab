import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_SESSION_EXPIRED_EVENT } from '../../lib/authSession';
import { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_HEADER_NAME, fetchWithCsrf } from '../../lib/csrf';
import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createCardFromStudyManualCardDraft,
  createStudyCard,
  createStudyCardId,
  createStudyImportUploadSession,
  createStudyManualCardDraft,
  createStudyReviewRequest,
  createStudyVocabBundleDrafts,
  deleteStudyCard,
  deleteStudyManualCardDraft,
  generateStudyManualCardDraftPreviewAudio,
  generateStudyManualCardDraftPreviewImage,
  getCurrentStudyImport,
  getStudyBrowser,
  getStudyBrowserNoteDetail,
  getStudyCards,
  getStudyImportStatus,
  getStudyImportUploadReadiness,
  getStudyLearningPath,
  getStudyLearningItems,
  getStudyManualCardDrafts,
  getStudyNewCardQueue,
  getStudySettings,
  linkStudyLearningPathSuccessor,
  performStudyCardAction,
  prepareStudyAnswerAudio,
  promoteStudyNewCardToFront,
  regenerateStudyAnswerAudio,
  regenerateStudyCardImage,
  reorderStudyNewCardQueue,
  resolveStudyCardPitchAccent,
  retryStudyManualCardDraft,
  startStudyLesson,
  startStudySession,
  submitStudyReview,
  undoStudyReview,
  updateStudyCard,
  updateStudyManualCardDraft,
  updateStudySettings,
  uploadStudyImport,
  uploadStudyImportArchive,
} from '../useStudy';
import StudyDraftRevisionConflictError from '../../lib/studyDraftRevisionConflict';
import StudyReviewIdentityMismatchError from '../../lib/studyReviewIdentityMismatch';

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8080',
  SHOW_ONBOARDING_WELCOME: false,
}));

const STUDY_API_BASE = '/api/study';

describe('useStudy request helpers', () => {
  class MockXMLHttpRequest {
    static lastInstance: MockXMLHttpRequest | null = null;

    method = '';

    url = '';

    requestHeaders = new Map<string, string>();

    status = 200;

    upload = { onprogress: null as ((event: ProgressEvent<EventTarget>) => void) | null };

    onerror: (() => void) | null = null;

    onabort: (() => void) | null = null;

    onload: (() => void) | null = null;

    constructor() {
      MockXMLHttpRequest.lastInstance = this;
    }

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders.set(name, value);
    }

    send() {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 1,
      } as ProgressEvent<EventTarget>);
      this.onload?.();
    }
  }

  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        if (String(input) === '/sanctum/csrf-cookie') {
          document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-csrf-token`;
          return { ok: true, status: 204 } as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      })
    );
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest);
    await fetchWithCsrf('/api/study/test-csrf-setup', { method: 'POST' });
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.unstubAllGlobals();
  });

  function expectJsonMutation(callIndex: number) {
    const requestInit = vi.mocked(global.fetch).mock.calls[callIndex]?.[1] as RequestInit;
    const headers = new Headers(requestInit.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe('test-csrf-token');
  }

  function learningOsImportJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      status: 'pending',
      source_filename: 'deck.colpkg',
      source_size_bytes: null,
      deck_name: '日本語',
      preview: {
        deck_name: '日本語',
        card_count: 0,
        note_count: 0,
        review_log_count: 0,
        media_reference_count: 0,
        skipped_media_count: 0,
        warnings: [],
        note_type_breakdown: [],
      },
      uploaded_at: null,
      upload_expires_at: '2099-04-21T01:00:00.000Z',
      completed_at: null,
      error_message: null,
      ...overrides,
    };
  }

  it('routes review and lesson starts, review, and undo through Learning OS', async () => {
    const reviewRequest = createStudyReviewRequest({
      cardId: '123e4567-e89b-42d3-a456-426614174000',
      grade: 'good',
      durationMs: 1250,
    });
    vi.mocked(global.fetch).mockImplementation(
      async (input: RequestInfo | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            String(input).endsWith('/reviews') ? { reviewLogId: reviewRequest.clientReviewId } : {},
        }) as Response
    );

    await startStudySession();
    await startStudyLesson();
    await submitStudyReview(reviewRequest, undefined);
    await undoStudyReview('review-log-1');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${STUDY_API_BASE}/lessons/start`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${STUDY_API_BASE}/session/start`,
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${STUDY_API_BASE}/reviews`, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `${STUDY_API_BASE}/reviews/undo`,
      expect.any(Object)
    );
    expectJsonMutation(0);
    expectJsonMutation(1);
    expectJsonMutation(2);
    expectJsonMutation(3);
  });

  it('sends device timezone and current overview with review operations', async () => {
    const overview = {
      dueCount: 1,
      newCount: 0,
      learningCount: 0,
      reviewCount: 1,
      suspendedCount: 0,
      totalCards: 1,
    };

    const reviewRequest = createStudyReviewRequest({ cardId: 'card-1', grade: 'hard' });
    vi.mocked(global.fetch).mockImplementation(
      async (input: RequestInfo | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () =>
            String(input).endsWith('/reviews') ? { reviewLogId: reviewRequest.clientReviewId } : {},
        }) as Response
    );

    await submitStudyReview(reviewRequest, overview);
    await undoStudyReview('review-log-1', overview);

    const fetchMock = vi.mocked(global.fetch);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      cardId: 'card-1',
      grade: 'hard',
      clientReviewId: reviewRequest.clientReviewId,
      reviewedAt: reviewRequest.reviewedAt,
      currentOverview: overview,
      timeZone: expect.any(String),
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      reviewLogId: 'review-log-1',
      currentOverview: overview,
      timeZone: expect.any(String),
    });
  });

  it('creates a lowercase ULID review identity with a canonical millisecond UTC timestamp', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-12T23:30:45.678Z'));

      const request = createStudyReviewRequest({ cardId: 'card-1', grade: 'easy' });

      expect(request).toMatchObject({
        cardId: 'card-1',
        grade: 'easy',
        clientReviewId: expect.stringMatching(/^[0-9a-hjkmnp-tv-z]{26}$/),
        reviewedAt: '2026-08-12T23:30:45.678Z',
      });
      expect(request.clientReviewId).toBe(request.clientReviewId.toLowerCase());
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a review response whose log ID does not match the submitted identity', async () => {
    const request = createStudyReviewRequest({ cardId: 'card-1', grade: 'good' });
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reviewLogId: '01differentreviewlogid0000' }),
    } as Response);

    await expect(submitStudyReview(request)).rejects.toEqual(
      expect.objectContaining({
        name: 'StudyReviewIdentityMismatchError',
        submittedReviewId: request.clientReviewId,
        receivedReviewId: '01differentreviewlogid0000',
      } satisfies Partial<StudyReviewIdentityMismatchError>)
    );
  });

  it('routes card CRUD, actions, and generated media through Learning OS', async () => {
    const cardId = createStudyCardId();
    const prompt = { cueText: '会社' };
    const answer = { expression: '会社', meaning: 'company' };

    await createStudyCard({
      id: cardId,
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt,
      answer,
    });
    await updateStudyCard({ cardId, prompt, answer });
    await performStudyCardAction({ cardId, action: 'suspend' });
    await prepareStudyAnswerAudio(cardId);
    await regenerateStudyAnswerAudio({
      cardId,
      answerAudioVoiceId: 'voice-1',
      answerAudioTextOverride: 'かいしゃ',
    });
    await regenerateStudyCardImage({ cardId, imagePrompt: 'An office', imageRole: 'answer' });
    await resolveStudyCardPitchAccent(cardId);
    await deleteStudyCard(cardId);

    const paths = vi
      .mocked(global.fetch)
      .mock.calls.map(([url]) => String(url).replace(STUDY_API_BASE, ''));
    expect(paths).toEqual([
      '/cards',
      `/cards/${cardId}`,
      `/cards/${cardId}/actions`,
      `/cards/${cardId}/prepare-answer-audio`,
      `/cards/${cardId}/regenerate-answer-audio`,
      `/cards/${cardId}/regenerate-image`,
      `/cards/${cardId}/pitch-accent`,
      `/cards/${cardId}`,
    ]);
    expect(new Set(paths)).not.toContain('/api/study');
  });

  it('reads and extends canonical learning paths while normalizing their card resources', async () => {
    const predecessorId = '01arz3ndektsv4rrffq69g5fav';
    const successorId = '01arz3ndektsv4rrffq69g5faw';
    const responsePayload = {
      data: {
        group_id: '01arz3ndektsv4rrffq69g5fax',
        anchor_card_id: predecessorId,
        stages: [
          {
            number: 1,
            cards: [
              {
                id: predecessorId,
                source_note_id: null,
                front_text: '会社を辞めました。',
                back_text: 'I left the company.',
                card_type: 'recognition',
                prompt_json: { cue_text: '会社を辞めました。' },
                answer_json: { meaning: 'I left the company.' },
                variant_stage: 1,
                variant_status: 'available',
              },
            ],
          },
          {
            number: 2,
            cards: [
              {
                id: successorId,
                source_note_id: 'note-2',
                front_text: '会社',
                back_text: 'company',
                card_type: 'recognition',
                prompt_json: {},
                answer_json: { expression: '会社', meaning: 'company' },
                variant_stage: 2,
                variant_status: 'locked',
              },
            ],
          },
        ],
      },
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responsePayload,
    } as Response);

    const path = await getStudyLearningPath(predecessorId);
    const linkedPath = await linkStudyLearningPathSuccessor({
      cardId: predecessorId,
      successorCardId: successorId,
    });

    expect(path).toEqual(linkedPath);
    expect(path).toMatchObject({
      groupId: '01arz3ndektsv4rrffq69g5fax',
      anchorCardId: predecessorId,
      stages: [
        {
          number: 1,
          cards: [
            {
              id: predecessorId,
              displayText: '会社を辞めました。',
              meaning: 'I left the company.',
              variantStatus: 'available',
            },
          ],
        },
        {
          number: 2,
          cards: [
            {
              id: successorId,
              noteId: 'note-2',
              displayText: '会社',
              meaning: 'company',
              variantStatus: 'locked',
            },
          ],
        },
      ],
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `/api/cards/${predecessorId}/learning-path`,
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `/api/cards/${predecessorId}/learning-path/successor`,
      expect.objectContaining({ method: 'PUT' })
    );
    expect(
      JSON.parse(String((vi.mocked(global.fetch).mock.calls[1]?.[1] as RequestInit).body))
    ).toEqual({ successor_card_id: successorId });
    expectJsonMutation(1);
  });

  it('reuses a caller-owned card ID when card creation is retried', async () => {
    const cardId = createStudyCardId();
    const payload = {
      id: cardId,
      cardType: 'recognition' as const,
      prompt: { cueText: '学校' },
      answer: { expression: '学校', meaning: 'school' },
    };

    await createStudyCard(payload);
    await createStudyCard(payload);

    const bodies = vi
      .mocked(global.fetch)
      .mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([payload, payload]);
  });

  it('routes the durable manual-card draft lifecycle through Learning OS', async () => {
    const draftId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const cardId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const draftRequest = {
      creationKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: '猫' },
      answer: { expression: '猫', meaning: 'cat' },
      imagePlacement: 'answer' as const,
      imagePrompt: 'A cat',
    };

    await getStudyManualCardDrafts({ cursor: draftId, limit: 50 });
    await createStudyManualCardDraft(draftRequest);
    await updateStudyManualCardDraft({
      draftId,
      values: { expectedRevision: 7, prompt: draftRequest.prompt, answer: draftRequest.answer },
    });
    await retryStudyManualCardDraft(draftId);
    await generateStudyManualCardDraftPreviewAudio(draftId);
    await generateStudyManualCardDraftPreviewImage(draftId);
    await createCardFromStudyManualCardDraft(draftId, cardId);
    await deleteStudyManualCardDraft(draftId);
    await createStudyVocabBundleDrafts({
      targetWord: '猫',
      sourceSentence: null,
      context: '',
      includeLearnerContext: true,
    });

    const paths = vi
      .mocked(global.fetch)
      .mock.calls.map(([url]) => String(url).replace(STUDY_API_BASE, ''));
    expect(paths).toEqual([
      `/card-drafts?cursor=${draftId}&limit=50`,
      '/card-drafts',
      `/card-drafts/${draftId}`,
      `/card-drafts/${draftId}/retry`,
      `/card-drafts/${draftId}/preview-audio`,
      `/card-drafts/${draftId}/preview-image`,
      `/card-drafts/${draftId}/create-card`,
      `/card-drafts/${draftId}`,
      '/card-candidates/vocab-bundle/drafts',
    ]);

    const previewCalls = [4, 5].map(
      (index) => vi.mocked(global.fetch).mock.calls[index]?.[1] as RequestInit
    );
    previewCalls.forEach((init) => {
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).get('Content-Type')).toBeNull();
    });
    expect(
      JSON.parse(String((vi.mocked(global.fetch).mock.calls[2]?.[1] as RequestInit).body))
    ).toEqual(expect.objectContaining({ expectedRevision: 7 }));
  });

  it('maps the draft revision conflict payload to a typed domain error', async () => {
    const serverDraft = { id: 'draft-1', revision: 8 };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: 'draft_revision_conflict',
        message: 'Study card draft changed since it was loaded.',
        draft: serverDraft,
      }),
    } as Response);

    const request = updateStudyManualCardDraft({
      draftId: 'draft-1',
      values: { expectedRevision: 7, answer: { meaning: 'enterprise' } },
    });

    await expect(request).rejects.toBeInstanceOf(StudyDraftRevisionConflictError);
    await expect(request).rejects.toMatchObject({
      name: 'StudyDraftRevisionConflictError',
      draft: serverDraft,
    });
  });

  it('routes settings, queue, and browser reads and writes through Learning OS', async () => {
    await getStudySettings();
    await updateStudySettings({ newCardsPerDay: 15, lessonBatchSize: 7 });
    await getStudyNewCardQueue({ cursor: 'cursor-1', q: 'kana', limit: 25 });
    await getStudyCards({ cursor: 'card-cursor', q: '会社', limit: 50 });
    await getStudyLearningItems({ cursor: 'item-cursor', q: '会社', limit: 20 });
    await reorderStudyNewCardQueue(['card-2', 'card-1']);
    await getStudyBrowser({
      q: '学校',
      sortField: 'created_on',
      sortDirection: 'desc',
      limit: 25,
    });
    await getStudyBrowserNoteDetail('note/with spaces');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/settings`,
      `${STUDY_API_BASE}/settings`,
      `${STUDY_API_BASE}/new-queue?cursor=cursor-1&limit=25&q=kana`,
      `${STUDY_API_BASE}/cards?cursor=card-cursor&per_page=50&q=%E4%BC%9A%E7%A4%BE`,
      `${STUDY_API_BASE}/learning-items?cursor=item-cursor&per_page=20&q=%E4%BC%9A%E7%A4%BE`,
      `${STUDY_API_BASE}/new-queue/reorder`,
      `${STUDY_API_BASE}/browser?q=%E5%AD%A6%E6%A0%A1&sortField=created_on&sortDirection=desc&limit=25`,
      `${STUDY_API_BASE}/browser/note%2Fwith%20spaces`,
    ]);

    const readHeaders = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(readHeaders.get('Accept')).toBe('application/json');
    expect(readHeaders.get('Content-Type')).toBeNull();
    expect(readHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBeNull();
    expectJsonMutation(1);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      newCardsPerDay: 15,
      lessonBatchSize: 7,
    });
    expectJsonMutation(5);
  });

  it('promotes a new card by shifting every preceding queue card down', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'card-first' }, { id: 'card-second' }],
          total: 4,
          limit: 100,
          nextCursor: 'cursor-2',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'card-third' }, { id: 'card-selected' }],
          total: 4,
          limit: 100,
          nextCursor: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 2, limit: 50, nextCursor: null }),
      } as Response);

    await promoteStudyNewCardToFront('card-selected');

    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/new-queue?limit=100`,
      `${STUDY_API_BASE}/new-queue?cursor=cursor-2&limit=100`,
      `${STUDY_API_BASE}/new-queue/reorder`,
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cardIds: ['card-selected', 'card-first', 'card-second', 'card-third'],
        }),
      })
    );
  });

  it('does not reorder a card that is already first', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 'card-selected' }],
        total: 1,
        limit: 100,
        nextCursor: null,
      }),
    } as Response);

    await promoteStudyNewCardToFront('card-selected');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('promotes through long queue prefixes in bounded reorder batches', async () => {
    const precedingCardIds = Array.from({ length: 501 }, (_, index) => `card-${index}`);
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [...precedingCardIds, 'card-selected'].map((id) => ({ id })),
          total: 502,
          limit: 100,
          nextCursor: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 502, limit: 100, nextCursor: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 502, limit: 100, nextCursor: null }),
      } as Response);

    await promoteStudyNewCardToFront('card-selected');

    const fetchMock = vi.mocked(global.fetch);
    const firstBatch = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    const secondBatch = JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body));

    expect(firstBatch.cardIds).toEqual(['card-selected', ...precedingCardIds.slice(2)]);
    expect(firstBatch.cardIds).toHaveLength(500);
    expect(secondBatch.cardIds).toEqual(['card-selected', 'card-0', 'card-1']);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects promotion when the active new-card queue is empty', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0, limit: 100, nextCursor: null }),
    } as Response);

    await expect(promoteStudyNewCardToFront('card-selected')).rejects.toThrow(
      'No active new-card queue is available.'
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects promotion when the selected card is not in the active queue', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: 'card-first' }],
        total: 1,
        limit: 100,
        nextCursor: null,
      }),
    } as Response);

    await expect(promoteStudyNewCardToFront('card-selected')).rejects.toThrow(
      'The selected card is not in the active new-card queue.'
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('notifies the app only when Learning OS reports an expired session', async () => {
    const expiredListener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response);

    await expect(getStudySettings()).rejects.toThrow('Unauthorized (401)');
    expect(expiredListener).toHaveBeenCalledTimes(1);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: { message: 'Learning OS unavailable' } }),
    } as Response);
    await expect(getStudySettings()).rejects.toThrow('Learning OS unavailable (502)');
    expect(expiredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expiredListener);
  });

  it('routes the complete import lifecycle through Learning OS', async () => {
    const importId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const uploadUrl = `/api/study/imports/${importId}/upload`;
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            import_job: learningOsImportJob(),
            upload: {
              method: 'PUT',
              url: uploadUrl,
              headers: { 'Content-Type': 'application/octet-stream' },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          data: learningOsImportJob({
            uploaded_at: '2026-08-03T21:00:00Z',
            preview: {
              deck_name: '日本語',
              card_count: 155,
              note_count: 155,
              review_log_count: 0,
              media_reference_count: 155,
              skipped_media_count: 0,
              warnings: [],
              note_type_breakdown: [
                {
                  notetype_name: 'Japanese - Listening',
                  note_count: 155,
                  card_count: 155,
                },
              ],
            },
          }),
        }),
      } as Response);

    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    const result = await uploadStudyImport(file);

    expect(result).toMatchObject({
      id: importId,
      status: 'pending',
      sourceFilename: 'deck.colpkg',
      deckName: '日本語',
      uploadedAt: '2026-08-03T21:00:00Z',
      preview: {
        cardCount: 155,
        noteTypeBreakdown: [
          { notetypeName: 'Japanese - Listening', noteCount: 155, cardCount: 155 },
        ],
      },
    });
    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/imports`,
      `${STUDY_API_BASE}/imports/${importId}/complete`,
    ]);
    expect(MockXMLHttpRequest.lastInstance?.method).toBe('PUT');
    expect(MockXMLHttpRequest.lastInstance?.url).toBe(uploadUrl);
    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
  });

  it('routes import status, readiness, completion, and cancellation through Learning OS', async () => {
    const importId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { ready: true, message: null } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: learningOsImportJob() }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ data: learningOsImportJob({ uploaded_at: '2026-08-03T21:00:00Z' }) }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: learningOsImportJob({ status: 'failed', error_message: 'Cancelled' }),
        }),
      } as Response);

    expect(await getCurrentStudyImport()).toBeNull();
    expect(await getStudyImportUploadReadiness()).toEqual({ ready: true, message: null });
    expect(await getStudyImportStatus(importId)).toMatchObject({ id: importId, status: 'pending' });
    expect(await completeStudyImportUpload(importId)).toMatchObject({
      id: importId,
      uploadedAt: '2026-08-03T21:00:00Z',
    });
    expect(await cancelStudyImportUpload(importId)).toMatchObject({
      id: importId,
      status: 'failed',
      errorMessage: 'Cancelled',
    });

    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `${STUDY_API_BASE}/imports/current`,
      `${STUDY_API_BASE}/imports/readiness`,
      `${STUDY_API_BASE}/imports/${importId}`,
      `${STUDY_API_BASE}/imports/${importId}/complete`,
      `${STUDY_API_BASE}/imports/${importId}/cancel`,
    ]);
  });

  it('treats an empty current-import response as no active import', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response);

    await expect(getCurrentStudyImport()).resolves.toBeNull();
  });

  it('attaches the shared CSRF token header to direct import uploads', async () => {
    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    await uploadStudyImportArchive(
      {
        importJob: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          status: 'pending',
          sourceFilename: 'deck.colpkg',
          deckName: 'Deck',
          preview: {
            deckName: 'Deck',
            cardCount: 1,
            noteCount: 1,
            reviewLogCount: 0,
            mediaReferenceCount: 0,
            skippedMediaCount: 0,
            warnings: [],
            noteTypeBreakdown: [],
          },
        },
        upload: {
          method: 'PUT',
          url: '/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
          headers: { 'Content-Type': 'application/octet-stream' },
        },
      },
      file
    );

    expect(MockXMLHttpRequest.lastInstance?.requestHeaders.get(CSRF_TOKEN_HEADER_NAME)).toBe(
      'test-csrf-token'
    );
  });

  it('creates import sessions with the Learning OS proxy contract', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          import_job: learningOsImportJob(),
          upload: {
            method: 'PUT',
            url: '/api/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
            headers: { 'Content-Type': 'application/octet-stream' },
          },
        },
      }),
    } as Response);
    const file = new File(['archive'], 'deck.colpkg', {
      type: 'application/octet-stream',
    });
    await createStudyImportUploadSession(file);

    expect(global.fetch).toHaveBeenCalledWith(`${STUDY_API_BASE}/imports`, expect.any(Object));
    const requestInit = vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      filename: 'deck.colpkg',
      content_type: 'application/octet-stream',
    });
  });
});
