/* eslint-disable import/no-named-as-default-member */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorHandler } from '../../../../middleware/errorHandler.js';
import {
  buildLearningOsAdminCoursePrompt,
  buildLearningOsAdminCourseScriptConfig,
  createLearningOsAdminScriptLabCourse,
  createLearningOsAdminInviteCode,
  deleteLearningOsAdminSentenceScriptTests,
  deleteLearningOsAdminCourseLineRendering,
  deleteLearningOsAdminScriptLabCourses,
  deleteLearningOsAdminInviteCode,
  deleteLearningOsAdminUser,
  generateLearningOsAdminCourseAudio,
  generateLearningOsAdminCourseDialogue,
  generateLearningOsAdminCourseScript,
  generateLearningOsAdminSentenceScript,
  listLearningOsAdminCourseLineRenderings,
  listLearningOsAdminSentenceScriptTests,
  listLearningOsAdminInviteCodes,
  listLearningOsAdminScriptLabCourses,
  listLearningOsAdminSpeakerAvatars,
  listLearningOsAdminUsers,
  recropLearningOsAdminSpeakerAvatar,
  showLearningOsAdminPronunciationDictionary,
  showLearningOsAdminSpeakerAvatarOriginal,
  showLearningOsAdminStats,
  showLearningOsAdminSentenceScriptTest,
  showLearningOsAdminUser,
  showLearningOsAdminCoursePipeline,
  showLearningOsAdminScriptLabCourse,
  streamLearningOsAdminCourseLineRendering,
  streamLearningOsAdminScriptLabAudio,
  synthesizeLearningOsAdminCourseLine,
  synthesizeLearningOsAdminScriptLabLine,
  testLearningOsAdminPronunciation,
  uploadLearningOsAdminSpeakerAvatar,
  uploadLearningOsAdminUserAvatar,
  updateLearningOsAdminCoursePipeline,
  updateLearningOsAdminPronunciationDictionary,
} from '../../../../routes/learningOs/admin.js';

const mocks = vi.hoisted(() => ({
  fetchLearningOsProxy: vi.fn(),
  resolveLearningOsServiceProxyContext: vi.fn(),
  resolveLearningOsUserProxyContext: vi.fn(),
  userDeleteMany: vi.fn(),
  userUpdateMany: vi.fn(),
  speakerAvatarDeleteMany: vi.fn(),
  speakerAvatarUpsert: vi.fn(),
  transaction: vi.fn(),
  inviteDeleteMany: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpsert: vi.fn(),
  updateJapanesePronunciationDictionary: vi.fn(),
}));

vi.mock('../../../../services/learningOsProxy.js', () => ({
  fetchLearningOsProxy: mocks.fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext: mocks.resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext: mocks.resolveLearningOsUserProxyContext,
}));
vi.mock('../../../../db/client.js', () => ({
  prisma: {
    user: { deleteMany: mocks.userDeleteMany, updateMany: mocks.userUpdateMany },
    speakerAvatar: { upsert: mocks.speakerAvatarUpsert },
    $transaction: mocks.transaction,
    inviteCode: {
      deleteMany: mocks.inviteDeleteMany,
      findUnique: mocks.inviteFindUnique,
      upsert: mocks.inviteUpsert,
    },
  },
}));
vi.mock('../../../../services/japanesePronunciationOverrides.js', () => ({
  updateJapanesePronunciationDictionary: mocks.updateJapanesePronunciationDictionary,
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INVITE_ID = '22222222-2222-4222-8222-222222222222';
const COURSE_ID = '44444444-4444-4444-8444-444444444444';
const RENDERING_ID = '55555555-5555-4555-8555-555555555555';
const SENTENCE_TEST_ID = '66666666-6666-4666-8666-666666666666';
const FISH_VOICE_ID = 'fishaudio:0123456789abcdef0123456789abcdef';
const user = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin User',
  displayName: 'Admin',
  avatarColor: 'teal',
  avatarUrl: null,
  role: 'admin',
  createdAt: '2026-07-20T10:00:00.123Z',
  updatedAt: '2026-07-21T10:00:00.456Z',
  _count: { episodes: 3, courses: 2 },
};
const userInfo = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin User',
  displayName: 'Admin',
  role: 'admin',
  avatarColor: 'teal',
  avatarUrl: null,
  preferredStudyLanguage: 'ja',
  preferredNativeLanguage: 'en',
  onboardingCompleted: true,
};
const invite = {
  id: INVITE_ID,
  code: 'INVITE12',
  usedBy: USER_ID,
  usedAt: '2026-07-21T11:00:00.123Z',
  createdAt: '2026-07-20T11:00:00.123Z',
  user: { id: USER_ID, email: 'admin@example.com', name: 'Admin User' },
};
const speakerAvatar = {
  id: '33333333-3333-4333-8333-333333333333',
  filename: 'ja-female-casual.jpg',
  croppedUrl: 'https://storage.example/cropped.jpg',
  originalUrl: 'https://storage.example/original.jpg',
  language: 'ja',
  gender: 'female',
  tone: 'casual',
  createdAt: '2026-07-20T11:00:00.123Z',
  updatedAt: '2026-07-21T11:00:00.456Z',
};
const pronunciationDictionary = {
  keepKanji: ['橋'],
  forceKana: { 北海道: 'ほっかいどう' },
  verbKana: { 話す: 'はなす' },
  updatedAt: '2026-07-22T09:00:00.123Z',
};
const coursePrompt = {
  prompt: 'Build a short dialogue.',
  metadata: {
    targetExchangeCount: 8,
    vocabularySeeds: '橋, 川',
    grammarSeeds: '〜ながら',
  },
};
const courseScriptConfig = {
  config: {
    targetLanguage: 'ja',
    nativeLanguage: 'en',
  },
};
const courseDialogue = {
  exchanges: [{ speakerName: 'A', textL2: 'こんにちは', translationL1: 'Hello' }],
};
const courseScript = {
  scriptUnits: [{ type: 'dialogue', text: 'こんにちは' }],
  estimatedDurationSeconds: 12,
  vocabularyItemCount: 1,
};
const courseAudio = {
  message: 'Audio generation started',
  jobId: COURSE_ID,
  courseId: COURSE_ID,
};
const coursePipeline = {
  id: COURSE_ID,
  status: 'draft',
  stage: 'exchanges',
  exchanges: courseDialogue.exchanges,
  scriptUnits: null,
  audioUrl: null,
  approxDurationSeconds: null,
};
const courseLineRendering = {
  id: RENDERING_ID,
  courseId: COURSE_ID,
  unitIndex: 3,
  text: 'こんにちは',
  speed: 0.85,
  voiceId: FISH_VOICE_ID,
  audioUrl: `/api/convolab/admin/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`,
  createdAt: '2026-07-22T12:00:00.123Z',
};
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
  exchanges: courseDialogue.exchanges,
  scriptUnits: courseScript.scriptUnits,
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
    mocks.resolveLearningOsServiceProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: 'proxy-user', email: 'admin@example.com', role: 'admin' },
    });
    mocks.resolveLearningOsUserProxyContext.mockResolvedValue({
      config: { apiUrl: 'http://learning-os.test', apiToken: 'proxy-token' },
      user: { id: USER_ID, email: 'admin@example.com', role: 'admin' },
    });
    mocks.userDeleteMany.mockResolvedValue({ count: 1 });
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.speakerAvatarDeleteMany.mockResolvedValue({ count: 0 });
    mocks.speakerAvatarUpsert.mockResolvedValue(speakerAvatar);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        speakerAvatar: {
          deleteMany: mocks.speakerAvatarDeleteMany,
          upsert: mocks.speakerAvatarUpsert,
        },
      })
    );
    mocks.inviteDeleteMany.mockResolvedValue({ count: 1 });
    mocks.inviteFindUnique.mockResolvedValue(null);
    mocks.inviteUpsert.mockImplementation(async ({ create }) => create);
    mocks.updateJapanesePronunciationDictionary.mockResolvedValue(pronunciationDictionary);

    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/courses', (req, _res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      next();
    });
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
    app.post('/courses/:id/build-prompt', buildLearningOsAdminCoursePrompt);
    app.post('/courses/:id/build-script-config', buildLearningOsAdminCourseScriptConfig);
    app.post('/courses/:id/generate-dialogue', generateLearningOsAdminCourseDialogue);
    app.post('/courses/:id/generate-script', generateLearningOsAdminCourseScript);
    app.post('/courses/:id/generate-audio', generateLearningOsAdminCourseAudio);
    app.post('/courses/:id/synthesize-line', synthesizeLearningOsAdminCourseLine);
    app.get('/courses/:id/line-renderings', listLearningOsAdminCourseLineRenderings);
    app.get(
      '/courses/:id/line-renderings/:renderingId/audio',
      streamLearningOsAdminCourseLineRendering
    );
    app.delete(
      '/courses/:id/line-renderings/:renderingId',
      deleteLearningOsAdminCourseLineRendering
    );
    app.get('/courses/:id/pipeline-data', showLearningOsAdminCoursePipeline);
    app.put('/courses/:id/pipeline-data', updateLearningOsAdminCoursePipeline);
    app.get('/stats', showLearningOsAdminStats);
    app.get('/users', listLearningOsAdminUsers);
    app.get('/users/:id/info', showLearningOsAdminUser);
    app.get('/invite-codes', listLearningOsAdminInviteCodes);
    app.get('/avatars/speaker/:filename/original', showLearningOsAdminSpeakerAvatarOriginal);
    app.post('/avatars/speaker/:filename/upload', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
        file: {
          buffer: Buffer.from('avatar-bytes'),
          originalname: 'avatar.png',
          mimetype: 'image/png',
        },
      });
      void uploadLearningOsAdminSpeakerAvatar(req, res, next);
    });
    app.post('/avatars/speaker/:filename/recrop', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void recropLearningOsAdminSpeakerAvatar(req, res, next);
    });
    app.post('/avatars/user/:userId/upload', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
        file: {
          buffer: Buffer.from('avatar-bytes'),
          originalname: 'avatar.png',
          mimetype: 'image/png',
        },
      });
      void uploadLearningOsAdminUserAvatar(req, res, next);
    });
    app.get('/avatars/speakers', listLearningOsAdminSpeakerAvatars);
    app.get('/pronunciation-dictionaries', showLearningOsAdminPronunciationDictionary);
    app.delete('/users/:id', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void deleteLearningOsAdminUser(req, res, next);
    });
    app.post('/invite-codes', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void createLearningOsAdminInviteCode(req, res, next);
    });
    app.delete('/invite-codes/:id', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void deleteLearningOsAdminInviteCode(req, res, next);
    });
    app.put('/pronunciation-dictionaries', (req, res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      void updateLearningOsAdminPronunciationDictionary(req, res, next);
    });
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

  it('proxies every admin course workbench operation with its canonical contract', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(coursePrompt))
      .mockResolvedValueOnce(upstreamJson(courseScriptConfig))
      .mockResolvedValueOnce(upstreamJson(courseDialogue))
      .mockResolvedValueOnce(upstreamJson(courseScript))
      .mockResolvedValueOnce(upstreamJson(courseAudio))
      .mockResolvedValueOnce(upstreamJson(coursePipeline))
      .mockResolvedValueOnce(upstreamJson({ success: true }));

    await request(app)
      .post(`/courses/${COURSE_ID}/build-prompt`)
      .send({ ignored: true })
      .expect(200);
    await request(app).post(`/courses/${COURSE_ID}/build-script-config`).expect(200);
    await request(app)
      .post(`/courses/${COURSE_ID}/generate-dialogue`)
      .send({ customPrompt: 'Use this prompt', ignored: 'drop me' })
      .expect(200, courseDialogue);
    await request(app).post(`/courses/${COURSE_ID}/generate-script`).expect(200, courseScript);
    await request(app).post(`/courses/${COURSE_ID}/generate-audio`).expect(200, courseAudio);
    await request(app).get(`/courses/${COURSE_ID}/pipeline-data`).expect(200, coursePipeline);
    await request(app)
      .put(`/courses/${COURSE_ID}/pipeline-data`)
      .send({ stage: 'script', data: courseScript.scriptUnits, ignored: 'drop me' })
      .expect(200, { success: true });

    const expectedRequests = [
      ['build-prompt', 'POST', {}, 10_000],
      ['build-script-config', 'POST', {}, 10_000],
      ['generate-dialogue', 'POST', { customPrompt: 'Use this prompt' }, 120_000],
      ['generate-script', 'POST', {}, 120_000],
      ['generate-audio', 'POST', {}, 10_000],
      ['pipeline-data', 'GET', undefined, 10_000],
      ['pipeline-data', 'PUT', { stage: 'script', data: courseScript.scriptUnits }, 10_000],
    ] as const;

    expectedRequests.forEach(([operation, method, body, timeoutMs], index) => {
      expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          upstreamUrl: new URL(
            `http://learning-os.test/api/convolab/admin/courses/${COURSE_ID}/${operation}`
          ),
          method,
          ...(body === undefined ? {} : { body }),
          timeoutMs,
        })
      );
    });
    expect(mocks.fetchLearningOsProxy.mock.calls[5][0].body).toBeUndefined();
    expect(mocks.resolveLearningOsUserProxyContext).toHaveBeenCalledWith(
      USER_ID,
      'Learning OS Admin API',
      expect.objectContaining({ userId: USER_ID, role: 'admin', accountSource: 'learning-os' })
    );
  });

  it('synthesizes a course line through Learning OS and rewrites its private audio URL', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({
        renderingId: RENDERING_ID.toUpperCase(),
        audioUrl: courseLineRendering.audioUrl,
      })
    );

    const response = await request(app)
      .post(`/courses/${COURSE_ID}/synthesize-line`)
      .send({
        text: '  こんにちは  ',
        voiceId: FISH_VOICE_ID.toUpperCase(),
        speed: 0.85,
        unitIndex: 3,
        ignored: 'drop me',
      })
      .expect(200);

    expect(response.body).toEqual({
      renderingId: RENDERING_ID,
      audioUrl: `/api/admin/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`,
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/courses/${COURSE_ID}/synthesize-line`
        ),
        method: 'POST',
        body: {
          text: 'こんにちは',
          voiceId: FISH_VOICE_ID,
          speed: 0.85,
          unitIndex: 3,
        },
        timeoutMs: 120_000,
      })
    );
  });

  it('lists strict rendering shapes while preserving imported external audio URLs', async () => {
    const imported = {
      ...courseLineRendering,
      id: INVITE_ID.toUpperCase(),
      unitIndex: 4,
      audioUrl: 'https://storage.googleapis.com/convolab/imported-line.mp3',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ renderings: [courseLineRendering, imported] })
    );

    const response = await request(app).get(`/courses/${COURSE_ID}/line-renderings`).expect(200);

    expect(response.body).toEqual({
      renderings: [
        {
          ...courseLineRendering,
          audioUrl: `/api/admin/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`,
        },
        { ...imported, id: INVITE_ID },
      ],
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('deletes a rendering through Learning OS and preserves the hidden 404 contract', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ success: true }))
      .mockResolvedValueOnce(upstreamJson({ message: 'Rendering not found' }, 404));

    await request(app)
      .delete(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}`)
      .expect(200, { success: true });
    const missing = await request(app)
      .delete(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}`)
      .expect(404);

    expect(missing.body.error.message).toBe('Rendering not found');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}`
        ),
        method: 'DELETE',
      })
    );
  });

  it('streams authenticated line audio with safe headers and byte ranges', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      new globalThis.Response('mp3-bytes', {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': '9',
          'Content-Range': 'bytes 0-8/9',
          'Content-Type': 'audio/mpeg',
          'X-Upstream-Secret': 'do-not-forward',
        },
      })
    );

    const response = await request(app)
      .get(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`)
      .set('Range', 'bytes=0-8')
      .expect(206);

    expect(response.body.toString()).toBe('mp3-bytes');
    expect(response.headers['content-type']).toBe('audio/mpeg');
    expect(response.headers['content-range']).toBe('bytes 0-8/9');
    expect(response.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(response.headers['x-upstream-secret']).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`
        ),
        method: 'GET',
        additionalHeaders: { Accept: 'audio/mpeg', Range: 'bytes=0-8' },
      })
    );
  });

  it.each([
    [{ text: '', voiceId: FISH_VOICE_ID, unitIndex: 0 }, 'Missing required fields'],
    [{ text: 'Line', voiceId: 'fishaudio:bad', unitIndex: 0 }, 'Only Fish Audio voices'],
    [{ text: 'Line', voiceId: FISH_VOICE_ID, unitIndex: -1 }, 'unitIndex must be'],
    [{ text: 'Line', voiceId: FISH_VOICE_ID, unitIndex: 0, speed: 3 }, 'speed must be'],
  ])('rejects invalid line synthesis locally: %s', async (body, message) => {
    const response = await request(app)
      .post(`/courses/${COURSE_ID}/synthesize-line`)
      .send(body)
      .expect(400);

    expect(response.body.error.message).toContain(message);
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('rejects malformed rendering IDs, media ranges, and upstream shapes', async () => {
    const badId = await request(app)
      .delete(`/courses/${COURSE_ID}/line-renderings/not-a-uuid`)
      .expect(404);
    const badRange = await request(app)
      .get(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`)
      .set('Range', 'bytes=0-1,3-4')
      .expect(400);
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({
        renderings: [
          {
            ...courseLineRendering,
            audioUrl: `/api/convolab/admin/courses/${COURSE_ID}/line-renderings/${INVITE_ID}/audio`,
          },
        ],
      })
    );
    const malformed = await request(app).get(`/courses/${COURSE_ID}/line-renderings`).expect(502);

    expect(badId.body.error.message).toBe('Rendering not found');
    expect(badRange.body.error.message).toBe('Invalid line audio byte range.');
    expect(malformed.body.error.message).toBe(
      'Learning OS Admin API returned an invalid response.'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledOnce();
  });

  it('rejects non-audio rendering streams and masks upstream failures', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        new globalThis.Response('html', { status: 200, headers: { 'Content-Type': 'text/html' } })
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'sensitive storage detail' }, 500));

    const invalidMedia = await request(app)
      .get(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`)
      .expect(502);
    const unavailable = await request(app)
      .get(`/courses/${COURSE_ID}/line-renderings/${RENDERING_ID}/audio`)
      .expect(502);

    expect(invalidMedia.body.error.message).toBe(
      'Learning OS Admin API returned invalid media headers.'
    );
    expect(unavailable.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(JSON.stringify(unavailable.body)).not.toContain('sensitive storage detail');
  });

  it.each([
    ['build-prompt', { ...coursePrompt, prompt: '' }],
    ['build-prompt', { ...coursePrompt, unexpected: true }],
    ['build-script-config', { config: [] }],
    ['generate-dialogue', { exchanges: [null] }],
    ['generate-script', { ...courseScript, vocabularyItemCount: -1 }],
    ['generate-script', { ...courseScript, unexpected: true }],
    ['generate-audio', { ...courseAudio, jobId: INVITE_ID }],
  ])('rejects malformed successful admin course %s responses', async (operation, payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app)
      .post(`/courses/${COURSE_ID}/${operation}`)
      .send(operation === 'generate-dialogue' ? { customPrompt: 'Prompt' } : {})
      .expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
  });

  it('rejects malformed pipeline responses and updates', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ ...coursePipeline, id: INVITE_ID }))
      .mockResolvedValueOnce(upstreamJson({ success: false }));

    await request(app).get(`/courses/${COURSE_ID}/pipeline-data`).expect(502);
    await request(app)
      .put(`/courses/${COURSE_ID}/pipeline-data`)
      .send({ stage: 'exchanges', data: [] })
      .expect(502);
  });

  it('validates admin course identifiers and request bodies before proxying', async () => {
    const badId = await request(app).post('/courses/not-a-uuid/build-prompt').expect(404);
    const badPrompt = await request(app)
      .post(`/courses/${COURSE_ID}/generate-dialogue`)
      .send({ customPrompt: 7 })
      .expect(400);
    const badStage = await request(app)
      .put(`/courses/${COURSE_ID}/pipeline-data`)
      .send({ stage: 'unknown', data: [] })
      .expect(400);
    const badData = await request(app)
      .put(`/courses/${COURSE_ID}/pipeline-data`)
      .send({ stage: 'script', data: {} })
      .expect(400);

    expect(badId.body.error.message).toBe('Course not found');
    expect(badPrompt.body.error.message).toBe('customPrompt must be a string');
    expect(badStage.body.error.message).toBe('Invalid stage. Must be "exchanges" or "script"');
    expect(badData.body.error.message).toBe('Pipeline data must be a list.');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('treats a null custom prompt as omitted', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(courseDialogue));

    await request(app)
      .post(`/courses/${COURSE_ID}/generate-dialogue`)
      .send({ customPrompt: null })
      .expect(200, courseDialogue);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
  });

  it('preserves safe course conflicts while hiding unexpected upstream details', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Course changed while script was being generated' }, 409)
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'database host leaked here' }, 500));

    const conflict = await request(app).post(`/courses/${COURSE_ID}/generate-script`).expect(409);
    const failure = await request(app).post(`/courses/${COURSE_ID}/generate-audio`).expect(502);

    expect(conflict.body.error.message).toBe('Course changed while script was being generated');
    expect(failure.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(JSON.stringify(failure.body)).not.toContain('database host leaked here');
  });

  it('proxies stats through the service identity and disables caching', async () => {
    const stats = {
      users: 4,
      episodes: 8,
      courses: 2,
      inviteCodes: { total: 5, used: 3, available: 2 },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(stats));

    const response = await request(app).get('/stats').expect(200);

    expect(response.body).toEqual(stats);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.resolveLearningOsServiceProxyContext).toHaveBeenCalledWith(
      'Learning OS Admin API'
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/stats'),
        apiToken: 'proxy-token',
        method: 'GET',
        timeoutMs: 10_000,
      })
    );
  });

  it('forwards only supported user-list query parameters and preserves the contract', async () => {
    const payload = {
      users: [user],
      pagination: { page: 2, limit: 25, total: 26, pages: 2 },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app)
      .get('/users?page=2&limit=25&search=Admin%20User&ignored=value')
      .expect(200);

    expect(response.body).toEqual(payload);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/users?page=2&limit=25&search=Admin+User'
        ),
      })
    );
  });

  it('encodes user IDs and preserves a valid user-info response', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(userInfo));

    const response = await request(app).get(`/users/${USER_ID}/info`).expect(200);

    expect(response.body).toEqual(userInfo);
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/admin/users/${USER_ID}/info`),
      })
    );
  });

  it('preserves the invite array and validated pagination headers', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson([invite], 200, {
        'X-Pagination-Page': '2',
        'X-Pagination-Limit': '50',
        'X-Pagination-Total': '51',
        'X-Pagination-Pages': '2',
      })
    );

    const response = await request(app).get('/invite-codes?page=2&limit=50&ignored=x').expect(200);

    expect(response.body).toEqual([invite]);
    expect(response.headers['x-pagination-page']).toBe('2');
    expect(response.headers['x-pagination-limit']).toBe('50');
    expect(response.headers['x-pagination-total']).toBe('51');
    expect(response.headers['x-pagination-pages']).toBe('2');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=2&limit=50'
        ),
      })
    );
  });

  it('collects every invite page when the legacy caller does not request pagination', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...invite,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const secondInvite = { ...invite, id: '33333333-3333-4333-8333-333333333333' };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson(firstPage, 200, {
          'X-Pagination-Page': '1',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '2',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([secondInvite], 200, {
          'X-Pagination-Page': '2',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '2',
        })
      );

    const response = await request(app).get('/invite-codes').expect(200);

    expect(response.body).toEqual([...firstPage, secondInvite]);
    expect(response.headers['x-pagination-page']).toBeUndefined();
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=1&limit=100'
        ),
      })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/invite-codes?page=2&limit=100'
        ),
      })
    );
  });

  it('proxies the speaker avatar list with strict shape validation and private caching', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson([speakerAvatar]));

    const response = await request(app).get('/avatars/speakers').expect(200);

    expect(response.body).toEqual([speakerAvatar]);
    expect(response.headers['cache-control']).toBe('private, max-age=3600');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/avatars/speakers'),
        method: 'GET',
      })
    );
  });

  it.each([
    [{ ...speakerAvatar, id: 'bad-id' }],
    [{ ...speakerAvatar, filename: 'ja-female-unknown.jpg' }],
    [{ ...speakerAvatar, originalUrl: '' }],
    [{ ...speakerAvatar, gender: 'unknown' }],
    [{ ...speakerAvatar, updatedAt: 'not-a-date' }],
  ])('rejects malformed speaker avatar lists from Learning OS', async (payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app).get('/avatars/speakers').expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
  });

  it('proxies a speaker original URL after validating and encoding the filename', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ originalUrl: speakerAvatar.originalUrl })
    );

    const response = await request(app)
      .get('/avatars/speaker/JA-FEMALE-CASUAL.JPG/original')
      .expect(200);

    expect(response.body).toEqual({ originalUrl: speakerAvatar.originalUrl });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/avatars/speaker/JA-FEMALE-CASUAL.JPG/original'
        ),
      })
    );
  });

  it('rejects malformed speaker filenames before contacting Learning OS', async () => {
    const response = await request(app)
      .get('/avatars/speaker/not-an-avatar.jpg/original')
      .expect(400);

    expect(response.body.error.message).toBe('Invalid avatar filename format');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('uploads a speaker avatar as multipart, validates the response, and mirrors its URLs', async () => {
    const payload = {
      message: 'Speaker avatar uploaded successfully',
      filename: 'ja-female-casual.png',
      croppedUrl: 'https://storage.example/cropped-new.jpg',
      originalUrl: 'https://storage.example/original-new.png',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    const response = await request(app)
      .post('/avatars/speaker/JA-FEMALE-CASUAL.PNG/upload')
      .send({ cropArea: { x: 1, y: 2, width: 100, height: 120 } })
      .expect(200);

    expect(response.body).toEqual(payload);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const proxyRequest = mocks.fetchLearningOsProxy.mock.calls[0][0];
    expect(proxyRequest).toMatchObject({
      upstreamUrl: new URL(
        'http://learning-os.test/api/convolab/admin/avatars/speaker/JA-FEMALE-CASUAL.PNG/upload'
      ),
      method: 'POST',
    });
    expect(proxyRequest.body).toBeUndefined();
    expect(proxyRequest.rawBody).toBeInstanceOf(FormData);
    expect(proxyRequest.rawBody.get('cropArea')).toBe(
      JSON.stringify({ x: 1, y: 2, width: 100, height: 120 })
    );
    expect(await (proxyRequest.rawBody.get('image') as Blob).text()).toBe('avatar-bytes');
    expect(mocks.speakerAvatarDeleteMany).toHaveBeenCalledWith({
      where: {
        language: 'ja',
        gender: 'female',
        tone: 'casual',
        filename: { not: payload.filename },
      },
    });
    expect(mocks.speakerAvatarUpsert).toHaveBeenCalledWith({
      where: { filename: payload.filename },
      create: {
        filename: payload.filename,
        croppedUrl: payload.croppedUrl,
        originalUrl: payload.originalUrl,
        language: 'ja',
        gender: 'female',
        tone: 'casual',
      },
      update: {
        croppedUrl: payload.croppedUrl,
        originalUrl: payload.originalUrl,
        language: 'ja',
        gender: 'female',
        tone: 'casual',
      },
    });
  });

  it('re-crops a speaker avatar with JSON and preserves the controlled legacy conflict', async () => {
    const payload = {
      message: 'Speaker avatar re-cropped successfully',
      filename: 'ja-female-casual.jpg',
      croppedUrl: 'https://storage.example/cropped-new.jpg',
      originalUrl: 'https://storage.example/original.jpg',
    };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(payload))
      .mockResolvedValueOnce(
        upstreamJson(
          { message: 'Speaker avatar must be uploaded before it can be re-cropped' },
          409
        )
      );

    await request(app)
      .post('/avatars/speaker/ja-female-casual.jpg/recrop')
      .send({ cropArea: { x: 1, y: 2, width: 100, height: 120 } })
      .expect(200, payload);
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        method: 'POST',
        body: { cropArea: { x: 1, y: 2, width: 100, height: 120 } },
      })
    );

    const conflict = await request(app)
      .post('/avatars/speaker/ja-female-casual.jpg/recrop')
      .send({ cropArea: { x: 1, y: 2, width: 100, height: 120 } })
      .expect(409);
    expect(conflict.body.error.message).toBe(
      'Speaker avatar must be uploaded before it can be re-cropped'
    );
    expect(mocks.speakerAvatarUpsert).toHaveBeenCalledTimes(1);
  });

  it('uploads a user avatar and mirrors the URL only when a legacy row exists', async () => {
    const payload = {
      message: 'User avatar uploaded successfully',
      avatarUrl: 'https://storage.example/user-avatar.jpg',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));
    mocks.userUpdateMany.mockResolvedValue({ count: 0 });

    await request(app)
      .post(`/avatars/user/${INVITE_ID}/upload`)
      .send({ cropArea: JSON.stringify({ x: 0, y: 0, width: 80, height: 80 }) })
      .expect(200, payload);

    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: INVITE_ID },
      data: { avatarUrl: payload.avatarUrl },
    });
  });

  it.each([
    { message: 'Speaker avatar uploaded successfully', filename: 'JA-FEMALE-CASUAL.PNG' },
    {
      message: 'Speaker avatar uploaded successfully',
      filename: 'ja-female-casual.png',
      croppedUrl: 'javascript:alert(1)',
      originalUrl: 'https://storage.example/original.png',
    },
  ])('rejects malformed avatar mutation responses without mirroring them', async (payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    await request(app)
      .post('/avatars/speaker/JA-FEMALE-CASUAL.PNG/upload')
      .send({ cropArea: { x: 1, y: 2, width: 100, height: 120 } })
      .expect(502);

    expect(mocks.speakerAvatarUpsert).not.toHaveBeenCalled();
  });

  it('rejects invalid crop areas locally before contacting Learning OS', async () => {
    const response = await request(app)
      .post('/avatars/speaker/ja-female-casual.jpg/recrop')
      .send({ cropArea: { x: 0, y: 0, width: 0, height: 100 } })
      .expect(400);

    expect(response.body.error.message).toBe('Invalid crop area');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
  });

  it('returns a consistency error when the local avatar mirror fails after canonical success', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({
        message: 'User avatar uploaded successfully',
        avatarUrl: 'https://storage.example/user-avatar.jpg',
      })
    );
    mocks.userUpdateMany.mockRejectedValue(new Error('database unavailable'));

    const response = await request(app)
      .post(`/avatars/user/${INVITE_ID}/upload`)
      .send({ cropArea: { x: 0, y: 0, width: 80, height: 80 } })
      .expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
  });

  it('proxies the canonical pronunciation dictionary without local fallback', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(pronunciationDictionary));

    const response = await request(app).get('/pronunciation-dictionaries').expect(200);

    expect(response.body).toEqual(pronunciationDictionary);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.updateJapanesePronunciationDictionary).not.toHaveBeenCalled();
  });

  it.each([
    { ...pronunciationDictionary, keepKanji: [7] },
    { ...pronunciationDictionary, forceKana: [] },
    { ...pronunciationDictionary, forceKana: { 北海道: '' } },
    { ...pronunciationDictionary, verbKana: { '': 'はなす' } },
    { ...pronunciationDictionary, verbKana: { 話す: 7 } },
    { ...pronunciationDictionary, updatedAt: 'not-a-date' },
  ])('rejects malformed pronunciation dictionaries from Learning OS', async (payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(payload));

    await request(app).get('/pronunciation-dictionaries').expect(502);
  });

  it('updates Learning OS first, then mirrors locally and returns the canonical payload', async () => {
    const requestBody = {
      keepKanji: [' 橋 '],
      forceKana: { 北海道: ' ほっかいどう ' },
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(pronunciationDictionary));

    const response = await request(app)
      .put('/pronunciation-dictionaries')
      .send(requestBody)
      .expect(200);

    expect(response.body).toEqual(pronunciationDictionary);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.resolveLearningOsUserProxyContext).toHaveBeenCalledWith(
      USER_ID,
      'Learning OS Admin API',
      expect.objectContaining({ userId: USER_ID, role: 'admin', accountSource: 'learning-os' })
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(
          'http://learning-os.test/api/convolab/admin/pronunciation-dictionaries'
        ),
        method: 'PUT',
        body: requestBody,
      })
    );
    expect(mocks.updateJapanesePronunciationDictionary).toHaveBeenCalledWith(
      pronunciationDictionary
    );
    expect(mocks.fetchLearningOsProxy.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateJapanesePronunciationDictionary.mock.invocationCallOrder[0]
    );
  });

  it('preserves allowlisted Learning OS validation errors without touching the local mirror', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'forceKana values must be strings' }, 400)
    );

    const response = await request(app)
      .put('/pronunciation-dictionaries')
      .send({ keepKanji: ['橋'], forceKana: { 北海道: 7 } })
      .expect(400);

    expect(response.body.error.message).toBe('forceKana values must be strings');
    expect(mocks.updateJapanesePronunciationDictionary).not.toHaveBeenCalled();
  });

  it('rejects unrecognized mutation errors from Learning OS', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Unexpected internal detail' }, 400)
    );

    const response = await request(app)
      .put('/pronunciation-dictionaries')
      .send({ keepKanji: [], forceKana: {} })
      .expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(mocks.updateJapanesePronunciationDictionary).not.toHaveBeenCalled();
  });

  it('returns a retryable gateway error when the local pronunciation mirror fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(pronunciationDictionary));
    mocks.updateJapanesePronunciationDictionary.mockRejectedValue(new Error('read-only file'));

    try {
      const response = await request(app)
        .put('/pronunciation-dictionaries')
        .send({ keepKanji: [], forceKana: {} })
        .expect(502);

      expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
      expect(consoleError).toHaveBeenCalledWith(
        'Unable to mirror Learning OS pronunciation dictionary locally:',
        expect.any(Error)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([
    [
      '/stats',
      { users: 1, episodes: 0, courses: 0, inviteCodes: { total: 1, used: 1, available: 1 } },
    ],
    [
      '/users',
      {
        users: [{ ...user, _count: { episodes: -1, courses: 0 } }],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    ],
    [
      '/users',
      {
        users: [],
        pagination: { page: 2, limit: 50, total: 1, pages: 1 },
      },
    ],
    [`/users/${USER_ID}/info`, { ...userInfo, onboardingCompleted: 'yes' }],
    ['/invite-codes', [{ ...invite, usedBy: null }]],
  ])('rejects malformed upstream shape for %s', async (path, payload) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson(payload, 200, {
        'X-Pagination-Page': '1',
        'X-Pagination-Limit': '100',
        'X-Pagination-Total': '1',
        'X-Pagination-Pages': '1',
      })
    );

    const response = await request(app).get(path).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
  });

  it('rejects invite responses with missing, malformed, or inconsistent pagination headers', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson([invite]))
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': 'one',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '1',
          'X-Pagination-Pages': '1',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': '1',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '101',
          'X-Pagination-Pages': '1',
        })
      )
      .mockResolvedValueOnce(
        upstreamJson([invite], 200, {
          'X-Pagination-Page': '2',
          'X-Pagination-Limit': '100',
          'X-Pagination-Total': '1',
          'X-Pagination-Pages': '1',
        })
      );

    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
    await request(app).get('/invite-codes').expect(502);
  });

  it.each([
    [401, 502],
    [403, 502],
    [500, 502],
    [404, 404],
    [422, 422],
  ])(
    'maps upstream HTTP %s to client HTTP %s without leaking details',
    async (upstream, client) => {
      mocks.fetchLearningOsProxy.mockResolvedValue(
        upstreamJson({ message: 'private upstream details' }, upstream)
      );

      const response = await request(app).get('/stats').expect(client);

      expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
      expect(JSON.stringify(response.body)).not.toContain('private upstream details');
    }
  );

  it('returns controlled errors for invalid JSON and transport failures', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        new globalThis.Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockRejectedValueOnce(new AppError('Learning OS Admin API is unavailable.', 502));

    const invalidJson = await request(app).get('/stats').expect(502);
    expect(invalidJson.body.error.message).toBe(
      'Learning OS Admin API returned an invalid JSON response.'
    );

    const unavailable = await request(app).get('/stats').expect(502);
    expect(unavailable.body.error.message).toBe('Learning OS Admin API is unavailable.');
  });

  it('deletes the canonical user, then idempotently cleans the local projection', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'User deleted successfully' })
    );

    const response = await request(app).delete(`/users/${USER_ID}`).expect(200);

    expect(response.body).toEqual({ message: 'User deleted successfully' });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.resolveLearningOsUserProxyContext).toHaveBeenCalledWith(
      USER_ID,
      'Learning OS Admin API',
      {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      }
    );
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL(`http://learning-os.test/api/convolab/admin/users/${USER_ID}`),
        user: { id: USER_ID, email: 'admin@example.com', role: 'admin' },
        method: 'DELETE',
      })
    );
    expect(mocks.userDeleteMany).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it('finishes local user cleanup when the canonical retry returns 404', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'User not found' }, 404));

    await request(app).delete(`/users/${USER_ID}`).expect(200);

    expect(mocks.userDeleteMany).toHaveBeenCalledOnce();
  });

  it('preserves user-not-found when neither canonical nor local state exists', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'User not found' }, 404));
    mocks.userDeleteMany.mockResolvedValue({ count: 0 });

    const response = await request(app).delete(`/users/${USER_ID}`).expect(404);

    expect(response.body.error.message).toBe('User not found');
  });

  it('does not clean a local user for an unexpected upstream 404', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Different resource not found' }, 404)
    );

    const response = await request(app).delete(`/users/${USER_ID}`).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
  });

  it('rejects malformed mutation IDs before contacting Learning OS', async () => {
    const userResponse = await request(app).delete('/users/not-a-uuid').expect(404);
    const inviteResponse = await request(app).delete('/invite-codes/not-a-uuid').expect(404);

    expect(userResponse.body.error.message).toBe('User not found');
    expect(inviteResponse.body.error.message).toBe('Invite code not found');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'Cannot delete your own account'],
    [403, 'Cannot delete admin users'],
  ])('preserves allowlisted user deletion error %s', async (status, message) => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message }, status));

    const response = await request(app).delete(`/users/${USER_ID}`).expect(status);

    expect(response.body.error.message).toBe(message);
    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
  });

  it('creates an invite canonically and mirrors its exact identity locally', async () => {
    const created = {
      id: INVITE_ID,
      code: 'CUSTOM12',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(created));

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(200);

    expect(response.body).toMatchObject({ id: INVITE_ID, code: 'CUSTOM12' });
    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        upstreamUrl: new URL('http://learning-os.test/api/convolab/admin/invite-codes'),
        method: 'POST',
        body: { customCode: 'CUSTOM12' },
      })
    );
    expect(mocks.inviteUpsert).toHaveBeenCalledWith({
      where: { id: INVITE_ID },
      create: {
        id: INVITE_ID,
        code: 'CUSTOM12',
        usedBy: null,
        usedAt: null,
        createdAt: new Date(created.createdAt),
      },
      update: {
        code: 'CUSTOM12',
        usedBy: null,
        usedAt: null,
        createdAt: new Date(created.createdAt),
      },
    });
  });

  it('creates a generated invite when customCode is omitted', async () => {
    const created = {
      id: INVITE_ID,
      code: 'A1B2C3D4',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(created));

    await request(app).post('/invite-codes').send({}).expect(200);

    expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
    expect(mocks.inviteUpsert).toHaveBeenCalledOnce();
  });

  it.each([null, '', false, 0])(
    'preserves generated invite behavior for falsy customCode %j',
    async (customCode) => {
      const created = {
        id: INVITE_ID,
        code: 'A1B2C3D4',
        usedBy: null,
        usedAt: null,
        createdAt: '2026-07-22T08:00:00.123Z',
      };
      mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson(created));

      await request(app).post('/invite-codes').send({ customCode }).expect(200);

      expect(mocks.fetchLearningOsProxy).toHaveBeenCalledWith(
        expect.objectContaining({ body: {} })
      );
    }
  );

  it('rejects a custom code already present in the local compatibility projection', async () => {
    mocks.inviteFindUnique.mockResolvedValue({ id: 'legacy-invite', code: 'CUSTOM12' });

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(400);

    expect(response.body.error.message).toBe('This code already exists');
    expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    expect(mocks.inviteUpsert).not.toHaveBeenCalled();
  });

  it('rolls back a canonical invite after a raced local code collision', async () => {
    const created = {
      id: INVITE_ID,
      code: 'CUSTOM12',
      usedBy: null,
      usedAt: null,
      createdAt: '2026-07-22T08:00:00.123Z',
    };
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson(created))
      .mockResolvedValueOnce(upstreamJson({ message: 'Invite code deleted successfully' }));
    mocks.inviteUpsert.mockRejectedValue({
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });

    const response = await request(app)
      .post('/invite-codes')
      .send({ customCode: 'CUSTOM12' })
      .expect(400);

    expect(response.body.error.message).toBe('This code already exists');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/invite-codes/${INVITE_ID}`
        ),
        method: 'DELETE',
      })
    );
  });

  it('rolls back a created invite when the remaining upstream payload is malformed', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(
        upstreamJson({
          id: INVITE_ID,
          code: '',
          usedBy: null,
          usedAt: null,
          createdAt: 'not-a-timestamp',
        })
      )
      .mockResolvedValueOnce(upstreamJson({ message: 'Invite code deleted successfully' }));

    const response = await request(app).post('/invite-codes').send({}).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API returned an invalid response.');
    expect(mocks.fetchLearningOsProxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        upstreamUrl: new URL(
          `http://learning-os.test/api/convolab/admin/invite-codes/${INVITE_ID}`
        ),
        method: 'DELETE',
      })
    );
    expect(mocks.inviteUpsert).not.toHaveBeenCalled();
  });

  it('logs the canonical invite ID when malformed-create rollback fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mocks.fetchLearningOsProxy
        .mockResolvedValueOnce(upstreamJson({ id: INVITE_ID, code: '' }))
        .mockResolvedValueOnce(upstreamJson({ message: 'rollback failed' }, 500));

      await request(app).post('/invite-codes').send({}).expect(502);

      expect(consoleError).toHaveBeenCalledWith(
        `Unable to roll back Learning OS admin invite ${INVITE_ID}:`,
        expect.any(AppError)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each(['short', 'BAD-CODE', ['CUSTOM12']])(
    'rejects malformed custom code %j without calling upstream',
    async (customCode) => {
      const response = await request(app).post('/invite-codes').send({ customCode }).expect(400);

      expect(response.body.error.message).toBe('Custom code must be 6-20 alphanumeric characters');
      expect(mocks.fetchLearningOsProxy).not.toHaveBeenCalled();
    }
  );

  it('deletes an invite canonically and supports local-cleanup retry', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Invite code deleted successfully' })
    );

    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(200);

    expect(mocks.inviteDeleteMany).toHaveBeenCalledWith({ where: { id: INVITE_ID } });

    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Invite code not found' }, 404)
    );
    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(200);
  });

  it('does not clean a local invite for an unexpected upstream 404', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Different resource not found' }, 404)
    );

    const response = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(502);

    expect(response.body.error.message).toBe('Learning OS Admin API request failed.');
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it('does not clean local projections after malformed successful delete responses', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(upstreamJson({ message: 'unexpected success' }));

    await request(app).delete(`/users/${USER_ID}`).expect(502);
    await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(502);

    expect(mocks.userDeleteMany).not.toHaveBeenCalled();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it('preserves used-invite and rate-limit responses without local cleanup', async () => {
    mocks.fetchLearningOsProxy
      .mockResolvedValueOnce(upstreamJson({ message: 'Cannot delete used invite codes' }, 400))
      .mockResolvedValueOnce(
        upstreamJson({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '17' })
      );

    const used = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(400);
    expect(used.body.error.message).toBe('Cannot delete used invite codes');

    const limited = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(429);
    expect(limited.body.error.message).toBe('Too many admin mutation attempts.');
    expect(limited.headers['retry-after']).toBe('17');
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });

  it('does not forward an out-of-range admin mutation cooldown', async () => {
    mocks.fetchLearningOsProxy.mockResolvedValue(
      upstreamJson({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': '9999' })
    );

    const response = await request(app).delete(`/invite-codes/${INVITE_ID}`).expect(429);

    expect(response.body.error.message).toBe('Too many admin mutation attempts.');
    expect(response.headers['retry-after']).toBeUndefined();
    expect(mocks.inviteDeleteMany).not.toHaveBeenCalled();
  });
});
