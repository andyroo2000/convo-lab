/* eslint-disable import/no-named-as-default-member */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../../middleware/errorHandler.js';
import {
  createLearningOsAdminScriptLabCourse,
  deleteLearningOsAdminSentenceScriptTests,
  deleteLearningOsAdminScriptLabCourses,
  generateLearningOsAdminSentenceScript,
  listLearningOsAdminSentenceScriptTests,
  listLearningOsAdminScriptLabCourses,
  showLearningOsAdminSentenceScriptTest,
  showLearningOsAdminScriptLabCourse,
  streamLearningOsAdminScriptLabAudio,
  synthesizeLearningOsAdminScriptLabLine,
  testLearningOsAdminPronunciation,
} from '../../../../routes/learningOs/admin.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsUserProxyContext: vi.fn(),
}));

vi.mock('../../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsUserProxyContext: mocks.resolveLearningOsUserProxyContext,
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INVITE_ID = '22222222-2222-4222-8222-222222222222';
const COURSE_ID = '44444444-4444-4444-8444-444444444444';
const RENDERING_ID = '55555555-5555-4555-8555-555555555555';
const SENTENCE_TEST_ID = '66666666-6666-4666-8666-666666666666';
const FISH_VOICE_ID = 'fishaudio:0123456789abcdef0123456789abcdef';
const scriptLabCourseSummary = {
  id: COURSE_ID,
  title: '[TEST] Train station',
  status: 'draft',
  createdAt: '2026-07-22T10:00:00.123Z',
  hasExchanges: true,
  hasScript: true,
  hasAudio: false,
};
const scriptLabCourse = {
  ...scriptLabCourseSummary,
  description: 'Test course for Script Lab: Train station',
  jlptLevel: 'N4',
  audioUrl: null,
  sourceText: 'A dialogue at a train station.',
  exchanges: [{ speakerName: 'A', textL2: 'こんにちは', translationL1: 'Hello' }],
  scriptUnits: [{ type: 'dialogue', text: 'こんにちは' }],
};
const sentenceUnits = [
  { type: 'narration_L1', text: 'Listen closely.', voiceId: FISH_VOICE_ID },
  { type: 'L2', text: '東京', reading: 'とうきょう', voiceId: FISH_VOICE_ID, speed: 0.9 },
  { type: 'pause', seconds: 2.5 },
];
const generatedSentenceScript = {
  units: sentenceUnits,
  estimatedDurationSeconds: 4.75,
  rawResponse: '{"units":[]}',
  resolvedPrompt: 'Teach 東京.',
  translation: 'Tokyo',
  testId: SENTENCE_TEST_ID,
};
const sentenceTestSummary = {
  id: SENTENCE_TEST_ID,
  sentence: '東京',
  translation: 'Tokyo',
  estimatedDurationSecs: 4.75,
  parseError: null,
  createdAt: '2026-07-22T12:00:00.123Z',
};
const sentenceTest = {
  ...sentenceTestSummary,
  userId: USER_ID,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  jlptLevel: 'N4',
  l1VoiceId: FISH_VOICE_ID,
  l2VoiceId: FISH_VOICE_ID,
  promptTemplate: 'Teach 東京.',
  unitsJson: sentenceUnits,
  rawResponse: '{"units":[]}',
};
const sentenceTestCursor = Buffer.from(
  `2026-07-22 12:00:00.123|${SENTENCE_TEST_ID}`,
  'utf8'
).toString('base64url');
const pronunciationTest = {
  preprocessedText: 'とうきょう',
  audioUrl: `/api/convolab/admin/script-lab/audio/${RENDERING_ID}`,
  durationSeconds: 2.4,
  format: 'kana',
  originalText: '東京',
};

const upstreamJson = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): globalThis.Response =>
  new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('Learning OS admin proxy', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLearningOsUserProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: USER_ID, email: 'admin@example.com', role: 'admin' },
    });
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/script-lab', (req, _res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      next();
    });
    app.post('/script-lab/courses', createLearningOsAdminScriptLabCourse);
    app.get('/script-lab/courses', listLearningOsAdminScriptLabCourses);
    app.get('/script-lab/courses/:id', showLearningOsAdminScriptLabCourse);
    app.delete('/script-lab/courses', deleteLearningOsAdminScriptLabCourses);
    app.post('/script-lab/sentence-script', generateLearningOsAdminSentenceScript);
    app.get('/script-lab/sentence-tests', listLearningOsAdminSentenceScriptTests);
    app.get('/script-lab/sentence-tests/:id', showLearningOsAdminSentenceScriptTest);
    app.delete('/script-lab/sentence-tests', deleteLearningOsAdminSentenceScriptTests);
    app.post('/script-lab/test-pronunciation', testLearningOsAdminPronunciation);
    app.post('/script-lab/synthesize-line', synthesizeLearningOsAdminScriptLabLine);
    app.get('/script-lab/audio/:renderingId', streamLearningOsAdminScriptLabAudio);
    app.use(errorHandler);
  });

  it('uses Learning OS as the canonical Script Lab course store', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ courseId: COURSE_ID, isTestCourse: true }))
      .mockResolvedValueOnce(upstreamJson({ courses: [scriptLabCourseSummary] }))
      .mockResolvedValueOnce(upstreamJson(scriptLabCourse))
      .mockResolvedValueOnce(upstreamJson({ deleted: 1 }));

    const createBody = {
      title: '  Train station  ',
      sourceText: 'A dialogue at a train station.',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      jlptLevel: 'N4',
      maxDurationMinutes: 20,
      speaker1Gender: 'male',
      speaker2Gender: 'female',
      ignored: 'drop me',
    };
    await request(app)
      .post('/script-lab/courses')
      .send(createBody)
      .expect(200, { courseId: COURSE_ID, isTestCourse: true });
    await request(app)
      .get('/script-lab/courses')
      .expect(200, { courses: [scriptLabCourseSummary] });
    await request(app).get(`/script-lab/courses/${COURSE_ID}`).expect(200, scriptLabCourse);
    await request(app)
      .delete('/script-lab/courses')
      .send({ courseIds: [COURSE_ID.toUpperCase()] })
      .expect(200, { deleted: 1 });

    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/script-lab/courses'),
        method: 'POST',
        body: {
          title: 'Train station',
          sourceText: createBody.sourceText,
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          jlptLevel: 'N4',
          maxDurationMinutes: 20,
          speaker1Gender: 'male',
          speaker2Gender: 'female',
        },
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'GET' })
    );
    expect(mocks.fetchLearningOsProxy.mock.calls[1][0].body).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/script-lab/courses/${COURSE_ID}`
        ),
        method: 'GET',
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ method: 'DELETE', body: { courseIds: [COURSE_ID] } })
    );
  });

  it.each([
    [{ courses: [{ ...scriptLabCourseSummary, hasScript: 'yes' }] }, 'GET', '/script-lab/courses'],
    [{ ...scriptLabCourse, id: INVITE_ID }, 'GET', `/script-lab/courses/${COURSE_ID}`],
    [{ courseId: 'bad-id', isTestCourse: true }, 'POST', '/script-lab/courses'],
    [{ deleted: -1 }, 'DELETE', '/script-lab/courses'],
  ] as const)('rejects malformed Script Lab course responses', async (payload, method, path) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const pending =
      method === 'GET'
        ? request(app).get(path)
        : method === 'POST'
          ? request(app).post(path).send({ title: 'Title', sourceText: 'Source' })
          : request(app)
              .delete(path)
              .send({ courseIds: [COURSE_ID] });
    await pending.expect(502);
  });

  it('validates Script Lab course requests before contacting Learning OS', async () => {
    const missing = await request(app)
      .post('/script-lab/courses')
      .send({ title: 'Missing source' })
      .expect(400);
    const blank = await request(app)
      .post('/script-lab/courses')
      .send({ title: '   ', sourceText: '   ' })
      .expect(400);
    const badId = await request(app).get('/script-lab/courses/not-a-uuid').expect(404);
    const badDelete = await request(app)
      .delete('/script-lab/courses')
      .send({ courseIds: [COURSE_ID, COURSE_ID.toUpperCase()] })
      .expect(400);

    expect(missing.body.error.message).toBe('Title and sourceText are required');
    expect(blank.body.error.message).toBe('Title and sourceText are required');
    expect(badId.body.error.message).toBe('Test course not found');
    expect(badDelete.body.error.message).toBe('courseIds must contain distinct UUIDs');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('preserves safe Script Lab course errors and hides unknown failures', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ message: 'Test course not found' }, 404))
      .mockResolvedValueOnce(upstreamJson({ message: 'private database detail' }, 500));

    const missing = await request(app).get(`/script-lab/courses/${COURSE_ID}`).expect(404);
    const failure = await request(app).get('/script-lab/courses').expect(502);

    expect(missing.body.error.message).toBe('Test course not found');
    expect(failure.body.error.message).toBe('Learning OS Admin API request failed.');
  });

  it('uses Learning OS for sentence generation and actor-scoped test history', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(generatedSentenceScript))
      .mockResolvedValueOnce(
        upstreamJson({ tests: [sentenceTestSummary], nextCursor: sentenceTestCursor })
      )
      .mockResolvedValueOnce(upstreamJson(sentenceTest))
      .mockResolvedValueOnce(upstreamJson({ deleted: 1 }));

    const generation = await request(app)
      .post('/script-lab/sentence-script')
      .send({
        sentence: '  東京  ',
        translation: '  Tokyo  ',
        targetLanguage: ' JA ',
        nativeLanguage: ' EN ',
        jlptLevel: ' N4 ',
        l1VoiceId: FISH_VOICE_ID.toUpperCase(),
        l2VoiceId: FISH_VOICE_ID.toUpperCase(),
        promptOverride: '  Teach 東京.  ',
        ignored: 'drop me',
      })
      .expect(200, generatedSentenceScript);
    const list = await request(app)
      .get('/script-lab/sentence-tests')
      .query({ limit: '25', cursor: sentenceTestCursor })
      .expect(200, { tests: [sentenceTestSummary], nextCursor: sentenceTestCursor });
    const show = await request(app)
      .get(`/script-lab/sentence-tests/${SENTENCE_TEST_ID.toUpperCase()}`)
      .expect(200, sentenceTest);
    const deletion = await request(app)
      .delete('/script-lab/sentence-tests')
      .send({ ids: [SENTENCE_TEST_ID.toUpperCase()] })
      .expect(200, { deleted: 1 });

    for (const response of [generation, list, show, deletion]) {
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/script-lab/sentence-script'
        ),
        method: 'POST',
        timeoutMs: 120_000,
        body: {
          sentence: '東京',
          translation: 'Tokyo',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
          jlptLevel: 'N4',
          l1VoiceId: FISH_VOICE_ID,
          l2VoiceId: FISH_VOICE_ID,
          promptOverride: 'Teach 東京.',
        },
      })
    );
    const listUrl = mocks.fetchLearningOsProxy.mock.calls[1][0].upstreamUrl as URL;
    expect(listUrl.pathname).toBe('/api/convolab/admin/script-lab/sentence-tests');
    expect(listUrl.searchParams.get('limit')).toBe('25');
    expect(listUrl.searchParams.get('cursor')).toBe(sentenceTestCursor);
    expect(mocks.fetchLearningOsProxy.mock.calls[1][0].body).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/script-lab/sentence-tests/${SENTENCE_TEST_ID}`
        ),
        method: 'GET',
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ method: 'DELETE', body: { ids: [SENTENCE_TEST_ID] } })
    );
    expect(mocks.resolveLearningOsUserProxyContext).toHaveBeenCalledTimes(4);
  });

  it.each([
    [
      { ...generatedSentenceScript, estimatedDurationSeconds: -1 },
      'POST',
      '/script-lab/sentence-script',
    ],
    [
      { tests: [{ ...sentenceTestSummary, id: 'bad-id' }], nextCursor: null },
      'GET',
      '/script-lab/sentence-tests',
    ],
    [
      { ...sentenceTest, unitsJson: [{ type: 'unknown' }] },
      'GET',
      `/script-lab/sentence-tests/${SENTENCE_TEST_ID}`,
    ],
    [{ deleted: -1 }, 'DELETE', '/script-lab/sentence-tests'],
  ] as const)('rejects malformed sentence test responses', async (payload, method, path) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));
    const pending =
      method === 'POST'
        ? request(app).post(path).send({ sentence: '東京' })
        : method === 'DELETE'
          ? request(app)
              .delete(path)
              .send({ ids: [SENTENCE_TEST_ID] })
          : request(app).get(path);
    await pending.expect(502);
  });

  it('validates sentence test requests before contacting Learning OS', async () => {
    const missing = await request(app).post('/script-lab/sentence-script').send({}).expect(400);
    const longSentence = await request(app)
      .post('/script-lab/sentence-script')
      .send({ sentence: 'a'.repeat(15_001) })
      .expect(400);
    const badLimit = await request(app).get('/script-lab/sentence-tests?limit=101').expect(400);
    const badCursor = await request(app)
      .get('/script-lab/sentence-tests?cursor=not-a-cursor')
      .expect(400);
    const impossibleCursor = Buffer.from(
      `2026-02-31 12:00:00.123|${SENTENCE_TEST_ID}`,
      'utf8'
    ).toString('base64url');
    await request(app)
      .get('/script-lab/sentence-tests')
      .query({ cursor: impossibleCursor })
      .expect(400);
    const badId = await request(app).get('/script-lab/sentence-tests/not-a-uuid').expect(404);
    const duplicateIds = await request(app)
      .delete('/script-lab/sentence-tests')
      .send({ ids: [SENTENCE_TEST_ID, SENTENCE_TEST_ID.toUpperCase()] })
      .expect(400);

    expect(missing.body.error.message).toBe('sentence is required');
    expect(longSentence.body.error.message).toBe('sentence must not exceed 15000 characters');
    expect(badLimit.body.error.message).toBe('limit must be an integer between 1 and 100');
    expect(badCursor.body.error.message).toBe('cursor is invalid');
    expect(badId.body.error.message).toBe('Sentence test not found');
    expect(duplicateIds.body.error.message).toBe('ids must contain distinct UUIDs');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('accepts exact sentence, prompt, and bulk-delete boundaries', async () => {
    const sentence = '😀'.repeat(15_000);
    const promptOverride = 'p'.repeat(100_000);
    const ids = Array.from(
      { length: 100 },
      (_, index) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
    );
    const parseFailure = {
      units: null,
      estimatedDurationSeconds: null,
      rawResponse: 'not-json',
      resolvedPrompt: promptOverride,
      translation: null,
      testId: SENTENCE_TEST_ID,
      parseError: 'Syntax error',
    };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(parseFailure))
      .mockResolvedValueOnce(upstreamJson({ deleted: 100 }));

    await request(app)
      .post('/script-lab/sentence-script')
      .send({ sentence, promptOverride, translation: null, jlptLevel: null })
      .expect(200, parseFailure);
    await request(app)
      .delete('/script-lab/sentence-tests')
      .send({ ids })
      .expect(200, { deleted: 100 });

    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: { sentence, promptOverride, translation: null, jlptLevel: null },
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ body: { ids } })
    );
  });

  it('rejects values immediately beyond sentence, prompt, and bulk-delete boundaries', async () => {
    await request(app)
      .post('/script-lab/sentence-script')
      .send({ sentence: '😀'.repeat(15_001) })
      .expect(400);
    await request(app)
      .post('/script-lab/sentence-script')
      .send({ sentence: '東京', promptOverride: 'p'.repeat(100_001) })
      .expect(400);
    const tooManyIds = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
    );
    await request(app).delete('/script-lab/sentence-tests').send({ ids: tooManyIds }).expect(400);

    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('preserves safe sentence test errors and masks provider details', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ message: 'Sentence test not found' }, 404))
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Sentence script generation is temporarily unavailable' }, 503)
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'provider credential leaked' }, 500));

    const missing = await request(app)
      .get(`/script-lab/sentence-tests/${SENTENCE_TEST_ID}`)
      .expect(404);
    const unavailable = await request(app)
      .post('/script-lab/sentence-script')
      .send({ sentence: '東京' })
      .expect(503);
    const hidden = await request(app).get('/script-lab/sentence-tests').expect(502);

    expect(missing.body.error.message).toBe('Sentence test not found');
    expect(unavailable.body.error.message).toBe(
      'Sentence script generation is temporarily unavailable'
    );
    expect(hidden.body.error.message).toBe('Learning OS Admin API request failed.');
  });

  it('proxies Script Lab pronunciation and line synthesis with stable public audio URLs', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(pronunciationTest))
      .mockResolvedValueOnce(
        upstreamJson({
          audioUrl: `/api/convolab/admin/script-lab/audio/${RENDERING_ID}`,
        })
      );

    const pronunciation = await request(app)
      .post('/script-lab/test-pronunciation')
      .send({
        text: '  東京  ',
        format: ' KANA ',
        voiceId: FISH_VOICE_ID.toUpperCase(),
        speed: 0.8,
        ignored: 'drop me',
      })
      .expect(200, {
        ...pronunciationTest,
        audioUrl: `/api/admin/script-lab/audio/${RENDERING_ID}`,
      });
    const synthesis = await request(app)
      .post('/script-lab/synthesize-line')
      .send({
        text: '  日本語です。  ',
        voiceId: FISH_VOICE_ID.toUpperCase(),
        ignored: 'drop me',
      })
      .expect(200, {
        audioUrl: `/api/admin/script-lab/audio/${RENDERING_ID}`,
      });

    expect(pronunciation.headers['cache-control']).toBe('private, no-store');
    expect(synthesis.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/script-lab/test-pronunciation'
        ),
        method: 'POST',
        body: { text: '東京', format: 'kana', voiceId: FISH_VOICE_ID, speed: 0.8 },
        timeoutMs: 190_000,
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/script-lab/synthesize-line'
        ),
        method: 'POST',
        body: { text: '日本語です。', voiceId: FISH_VOICE_ID, speed: 1 },
        timeoutMs: 120_000,
      })
    );
  });

  it('streams actor-scoped Script Lab audio with safe headers and byte ranges', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('script-lab-mp3', {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': '14',
          'Content-Range': 'bytes 0-13/14',
          'Content-Type': 'audio/mpeg',
          'X-Upstream-Secret': 'do-not-forward',
        },
      })
    );

    const response = await request(app)
      .get(`/script-lab/audio/${RENDERING_ID.toUpperCase()}`)
      .set('Range', 'bytes=0-13')
      .expect(206);

    expect(response.body.toString()).toBe('script-lab-mp3');
    expect(response.headers['content-type']).toBe('audio/mpeg');
    expect(response.headers['content-range']).toBe('bytes 0-13/14');
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['x-upstream-secret']).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/script-lab/audio/${RENDERING_ID}`
        ),
        method: 'GET',
        additionalHeaders: { Accept: 'audio/mpeg', Range: 'bytes=0-13' },
        timeoutMs: 10_000,
      })
    );
  });

  it.each([
    [
      '/script-lab/test-pronunciation',
      { text: '', format: 'kana', voiceId: FISH_VOICE_ID },
      'text, format, and voiceId are required',
    ],
    [
      '/script-lab/test-pronunciation',
      { text: '東京', format: 'romaji', voiceId: FISH_VOICE_ID },
      'Invalid format',
    ],
    [
      '/script-lab/test-pronunciation',
      { text: '東京', format: 'kana', voiceId: 'fishaudio:bad' },
      'Only Fish Audio voices',
    ],
    [
      '/script-lab/test-pronunciation',
      { text: '東京', format: 'kana', voiceId: FISH_VOICE_ID, speed: 0 },
      'speed must be',
    ],
    [
      '/script-lab/synthesize-line',
      { text: '', voiceId: FISH_VOICE_ID },
      'text and voiceId are required',
    ],
    [
      '/script-lab/synthesize-line',
      { text: 'Line', voiceId: 'elevenlabs:voice' },
      'Only Fish Audio voices',
    ],
    [
      '/script-lab/synthesize-line',
      { text: 'Line', voiceId: FISH_VOICE_ID, speed: 3 },
      'speed must be',
    ],
  ])('rejects invalid Script Lab audio input locally: %s', async (path, body, message) => {
    const response = await request(app).post(path).send(body).expect(400);

    expect(response.body.error.message).toContain(message);
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('enforces Unicode text boundaries before Script Lab provider spend', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson({
          audioUrl: `/api/convolab/admin/script-lab/audio/${RENDERING_ID}`,
        })
      )
      .mockResolvedValueOnce(
        upstreamJson({
          ...pronunciationTest,
          preprocessedText: 'a',
          originalText: '😀'.repeat(15_000),
        })
      );

    await request(app)
      .post('/script-lab/synthesize-line')
      .send({ text: '😀'.repeat(15_000), voiceId: FISH_VOICE_ID, speed: 0.5 })
      .expect(200);
    await request(app)
      .post('/script-lab/test-pronunciation')
      .send({
        text: '😀'.repeat(15_000),
        format: 'kana',
        voiceId: FISH_VOICE_ID,
        speed: 2,
      })
      .expect(200);
    await request(app)
      .post('/script-lab/synthesize-line')
      .send({ text: '😀'.repeat(15_001), voiceId: FISH_VOICE_ID })
      .expect(400);
    await request(app)
      .post('/script-lab/test-pronunciation')
      .send({ text: '😀'.repeat(15_001), format: 'kana', voiceId: FISH_VOICE_ID })
      .expect(400);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      '/script-lab/test-pronunciation',
      { ...pronunciationTest, audioUrl: `https://storage.example/${RENDERING_ID}.mp3` },
      { text: '東京', format: 'kana', voiceId: FISH_VOICE_ID },
    ],
    [
      '/script-lab/test-pronunciation',
      { ...pronunciationTest, durationSeconds: Number.POSITIVE_INFINITY },
      { text: '東京', format: 'kana', voiceId: FISH_VOICE_ID },
    ],
    [
      '/script-lab/test-pronunciation',
      { ...pronunciationTest, originalText: '大阪' },
      { text: '東京', format: 'kana', voiceId: FISH_VOICE_ID },
    ],
    [
      '/script-lab/synthesize-line',
      { audioUrl: `/api/convolab/admin/script-lab/audio/${RENDERING_ID}`, extra: true },
      { text: 'Line', voiceId: FISH_VOICE_ID },
    ],
  ])('rejects malformed successful Script Lab audio responses: %s', async (path, payload, body) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app).post(path).send(body).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
  });

  it('preserves safe Script Lab provider errors and masks stream failures', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Pronunciation test is temporarily unavailable' }, 503)
      )
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Line synthesis is temporarily unavailable' }, 503)
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'private storage detail' }, 404))
      .mockResolvedValueOnce(upstreamJson({ message: 'private storage detail' }, 500));

    const pronunciation = await request(app)
      .post('/script-lab/test-pronunciation')
      .send({ text: '東京', format: 'kana', voiceId: FISH_VOICE_ID })
      .expect(503);
    const synthesis = await request(app)
      .post('/script-lab/synthesize-line')
      .send({ text: '東京', voiceId: FISH_VOICE_ID })
      .expect(503);
    const missing = await request(app).get(`/script-lab/audio/${RENDERING_ID}`).expect(404);
    const failure = await request(app).get(`/script-lab/audio/${RENDERING_ID}`).expect(502);

    expect(pronunciation.body.error.message).toBe('Pronunciation test is temporarily unavailable');
    expect(synthesis.body.error.message).toBe('Line synthesis is temporarily unavailable');
    expect(missing.body.error.message).toBe('Rendering not found');
    expect(failure.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(JSON.stringify(failure.body)).not.toContain('private storage detail');
  });

  it('rejects malformed Script Lab audio IDs, ranges, and media types', async () => {
    const badId = await request(app).get('/script-lab/audio/not-a-uuid').expect(404);
    const badRange = await request(app)
      .get(`/script-lab/audio/${RENDERING_ID}`)
      .set('Range', 'bytes=0-1,3-4')
      .expect(400);
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('html', { status: 200, headers: { 'Content-Type': 'text/html' } })
    );
    const invalidMedia = await request(app).get(`/script-lab/audio/${RENDERING_ID}`).expect(502);

    expect(badId.body.error.message).toBe('Rendering not found');
    expect(badRange.body.error.message).toBe('Invalid Script Lab audio byte range.');
    expect(invalidMedia.body.error.message).toBe(
      'Learning OS Admin API returned invalid media headers.'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledOnce();
  });
});
