/* eslint-disable import/no-named-as-default-member */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, errorHandler } from '../../../../middleware/errorHandler.js';
import {
  buildLearningOsAdminCoursePrompt,
  buildLearningOsAdminCourseScriptConfig,
  createLearningOsAdminInviteCode,
  deleteLearningOsAdminInviteCode,
  deleteLearningOsAdminUser,
  generateLearningOsAdminCourseAudio,
  generateLearningOsAdminCourseDialogue,
  generateLearningOsAdminCourseScript,
  listLearningOsAdminInviteCodes,
  listLearningOsAdminSpeakerAvatars,
  listLearningOsAdminUsers,
  recropLearningOsAdminSpeakerAvatar,
  showLearningOsAdminPronunciationDictionary,
  showLearningOsAdminSpeakerAvatarOriginal,
  showLearningOsAdminStats,
  showLearningOsAdminUser,
  showLearningOsAdminCoursePipeline,
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
    app.use(express.json());
    app.use('/courses', (req, _res, next) => {
      Object.assign(req, {
        userId: USER_ID,
        email: 'admin@example.com',
        role: 'admin',
        accountSource: 'learning-os',
      });
      next();
    });
    app.post('/courses/:id/build-prompt', buildLearningOsAdminCoursePrompt);
    app.post('/courses/:id/build-script-config', buildLearningOsAdminCourseScriptConfig);
    app.post('/courses/:id/generate-dialogue', generateLearningOsAdminCourseDialogue);
    app.post('/courses/:id/generate-script', generateLearningOsAdminCourseScript);
    app.post('/courses/:id/generate-audio', generateLearningOsAdminCourseAudio);
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
