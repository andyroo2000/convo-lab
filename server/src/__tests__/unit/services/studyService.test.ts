import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';

import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  createStudyCard,
  getStudyBrowserList,
  getStudyBrowserNoteDetail,
  importJapaneseStudyColpkg,
  performStudyCardAction,
  prepareStudyCardAnswerAudio,
  recordStudyReview,
  startStudySession,
  undoStudyReview,
  updateStudyCard,
} from '../../../services/studyService.js';
import { synthesizeSpeech } from '../../../services/ttsClient.js';
import { mockPrisma } from '../../setup.js';

vi.mock('../../../services/ttsClient.js', () => ({
  synthesizeSpeech: vi.fn(async () => Buffer.from('fake-audio')),
}));

vi.mock('../../../services/furiganaService.js', () => ({
  addFuriganaBrackets: vi.fn(async (text: string) => `${text}[furigana]`),
}));

const FIELD_SEPARATOR = String.fromCharCode(31);
const generatedStudyMediaPath = path.join(process.cwd(), 'server/public/study-media');
const require = createRequire(import.meta.url);
const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlJsWasmPath,
    });
  }

  return sqlJsPromise;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function buildFixtureColpkg(
  options: { includeOrphanedReviewLog?: boolean } = {}
): Promise<Buffer> {
  const fields = {
    vocab: [
      'Expression',
      'ExpressionReading',
      'Meaning',
      'SentenceJP',
      'SentenceJPKana',
      'SentenceEN',
      'Photo',
      'Notes',
      'AudioWord',
      'AudioSentence',
    ],
    kanji: ['Expression', 'ExpressionReading', 'Meaning', 'Photo', 'AudioWord', 'Notes'],
    listening: ['Expression', 'ExpressionReading', 'Meaning', 'Photo', 'AudioWord', 'Notes'],
    cloze: ['Text', 'Back Extra', 'AnswerExpression', 'Meaning', 'ClozeHint', 'AudioSentence'],
  };

  const legacyModelsJson = JSON.stringify({
    1761751983840: {
      id: 1761751983840,
      name: 'Japanese - Vocab',
      flds: fields.vocab.map((fieldName, index) => ({ ord: index, name: fieldName })),
      tmpls: [
        { ord: 0, name: 'Image -> Word' },
        { ord: 1, name: 'Word -> Meaning' },
      ],
    },
    1761913829839: {
      id: 1761913829839,
      name: 'Japanese - Kanji Reading',
      flds: fields.kanji.map((fieldName, index) => ({ ord: index, name: fieldName })),
      tmpls: [{ ord: 0, name: 'Kanji' }],
    },
    1763006780317: {
      id: 1763006780317,
      name: 'Japanese - Listening',
      flds: fields.listening.map((fieldName, index) => ({ ord: index, name: fieldName })),
      tmpls: [{ ord: 0, name: 'listening card' }],
    },
    1768158123425: {
      id: 1768158123425,
      name: 'Cloze',
      flds: fields.cloze.map((fieldName, index) => ({ ord: index, name: fieldName })),
      tmpls: [{ ord: 0, name: 'Cloze' }],
    },
  });

  const legacyDecksJson = JSON.stringify({
    1761751732462: {
      id: 1761751732462,
      name: '日本語',
    },
  });

  const sql = `
    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);

    INSERT INTO col VALUES (
      1,
      1761552000,
      1775915623849,
      1768168406996,
      18,
      0,
      0,
      0,
      '',
      ${sqlLiteral(legacyModelsJson)},
      ${sqlLiteral(legacyDecksJson)},
      '',
      ''
    );

    INSERT INTO notes VALUES (
      1,
      'guid-vocab',
      1761751983840,
      0,
      0,
      '',
      ${sqlLiteral(
        [
          '会社',
          '会社[かいしゃ]',
          'company',
          '会社で働いています。',
          '会社[かいしゃ]で働[はたら]いています。',
          'I work at a company.',
          '<img src="company.png">',
          'Common workplace noun.',
          '[sound:company-word.mp3]',
          '[sound:company-sentence.mp3]',
        ].join(FIELD_SEPARATOR)
      )},
      0,
      0,
      0,
      ''
    );
    INSERT INTO notes VALUES (
      2,
      'guid-kanji',
      1761913829839,
      0,
      0,
      '',
      ${sqlLiteral(
        [
          '花瓶',
          '花瓶[かびん]',
          'vase',
          '<img src="vase.png">',
          '[sound:vase-word.mp3]',
          'Container for flowers.',
        ].join(FIELD_SEPARATOR)
      )},
      0,
      0,
      0,
      ''
    );
    INSERT INTO notes VALUES (
      3,
      'guid-listening',
      1763006780317,
      0,
      0,
      '',
      ${sqlLiteral(
        [
          '入り口',
          '入口[いりぐち]',
          'entrance',
          '<img src="entrance.png">',
          '[sound:entrance-word.mp3]',
          'Common travel word.',
        ].join(FIELD_SEPARATOR)
      )},
      0,
      0,
      0,
      ''
    );
    INSERT INTO notes VALUES (
      4,
      'guid-cloze',
      1768158123425,
      0,
      0,
      '',
      ${sqlLiteral(
        [
          'お風呂に虫{{c1::がいる::are (existence verb)}}！ {{c2::助けて}}！',
          'Travel sentence',
          'お風呂に虫がいる！ 助けて！',
          'There are bugs in the bath!',
          'backup hint',
          '[sound:bangkok-sentence.mp3]',
        ].join(FIELD_SEPARATOR)
      )},
      0,
      0,
      0,
      ''
    );

    INSERT INTO cards VALUES (11, 1, 1761751732462, 0, 0, 0, 2, 2, 97, 15, 2500, 7, 1, 0, 0, 0, 0, '{"s":12.5,"d":4.3,"lrt":1769832848}');
    INSERT INTO cards VALUES (12, 1, 1761751732462, 1, 0, 0, 2, 2, 90, 10, 2300, 6, 1, 0, 0, 0, 0, '{}');
    INSERT INTO cards VALUES (21, 2, 1761751732462, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, '{}');
    INSERT INTO cards VALUES (31, 3, 1761751732462, 0, 0, 0, 1, 1, 1775910000, 0, 2500, 2, 0, 0, 0, 0, 0, '{}');
    INSERT INTO cards VALUES (41, 4, 1761751732462, 0, 0, 0, 2, 2, 95, 20, 2600, 8, 2, 0, 0, 0, 0, '{"s":20.1,"d":3.1,"lrt":1770000000}');
    INSERT INTO cards VALUES (42, 4, 1761751732462, 1, 0, 0, 2, 2, 96, 18, 2550, 7, 1, 0, 0, 0, 0, '{"s":18.1,"d":3.4,"lrt":1770001000}');

    INSERT INTO revlog VALUES (1775915610000, 11, 0, 3, 15, 10, 2500, 2400, 1);
    INSERT INTO revlog VALUES (1775915611000, 12, 0, 2, 10, 6, 2300, 1800, 1);
    INSERT INTO revlog VALUES (1775915612000, 41, 0, 4, 20, 12, 2600, 1600, 1);
    ${
      options.includeOrphanedReviewLog
        ? 'INSERT INTO revlog VALUES (1775915613000, 9999, 0, 1, 1, 0, 2000, 500, 0);'
        : ''
    }
  `;

  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run(sql);

  const zip = new JSZip();
  zip.file('collection.anki2', Buffer.from(db.export()));
  zip.file(
    'media',
    JSON.stringify({
      0: 'company.png',
      1: 'company-word.mp3',
      2: 'company-sentence.mp3',
      3: 'vase.png',
      4: 'vase-word.mp3',
      5: 'entrance.png',
      6: 'entrance-word.mp3',
      7: 'bangkok-sentence.mp3',
    })
  );

  const mediaFiles = [
    'company.png',
    'company-word.mp3',
    'company-sentence.mp3',
    'vase.png',
    'vase-word.mp3',
    'entrance.png',
    'entrance-word.mp3',
    'bangkok-sentence.mp3',
  ];

  mediaFiles.forEach((mediaFilename, index) => {
    zip.file(String(index), Buffer.from(`fixture:${mediaFilename}`));
  });

  db.close();

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('studyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GCS_BUCKET_NAME = '';
    mockPrisma.studyImportJob.create.mockResolvedValue({ id: 'import-job-1' });
    mockPrisma.studyImportJob.update.mockResolvedValue({ id: 'import-job-1' });
    mockPrisma.studyReviewLog.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyCard.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyNote.createMany.mockResolvedValue({ count: 4 });
    mockPrisma.studyMedia.createMany.mockResolvedValue({ count: 8 });
    mockPrisma.studyCard.createMany.mockResolvedValue({ count: 6 });
    mockPrisma.studyReviewLog.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  afterEach(async () => {
    await fs.rm(generatedStudyMediaPath, { recursive: true, force: true });
  });

  it('imports the 日本語 deck into canonical study cards with scheduler and history preserved', async () => {
    const colpkgBuffer = await buildFixtureColpkg();

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.cardCount).toBe(6);
    expect(result.preview.noteCount).toBe(4);
    expect(result.preview.reviewLogCount).toBe(3);

    const createdCards = mockPrisma.studyCard.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(createdCards).toHaveLength(6);
    expect(createdCards.map((card) => card.cardType)).toEqual([
      'production',
      'recognition',
      'recognition',
      'recognition',
      'cloze',
      'cloze',
    ]);

    const productionCard = createdCards.find((card) => card.sourceCardId === BigInt(11));
    expect(productionCard?.answerAudioSource).toBe('imported');
    expect(productionCard?.sourceFsrsJson).toMatchObject({ s: 12.5, d: 4.3 });

    const firstClozeCard = createdCards.find((card) => card.sourceCardId === BigInt(41));
    expect(firstClozeCard?.promptJson).toMatchObject({
      clozeText: 'お風呂に虫{{c1::がいる::are (existence verb)}}！ {{c2::助けて}}！',
      clozeDisplayText: 'お風呂に虫[...]！ 助けて！',
      clozeAnswerText: 'がいる',
      clozeResolvedHint: 'are (existence verb)',
    });
    expect(firstClozeCard?.answerJson).toMatchObject({
      restoredText: 'お風呂に虫がいる！ 助けて！',
      restoredTextReading: 'お風呂に虫がいる！ 助けて！[furigana]',
      meaning: 'There are bugs in the bath!',
    });

    const secondClozeCard = createdCards.find((card) => card.sourceCardId === BigInt(42));
    expect(secondClozeCard?.promptJson).toMatchObject({
      clozeDisplayText: 'お風呂に虫がいる！ [...]！',
      clozeAnswerText: '助けて',
      clozeResolvedHint: 'backup hint',
    });

    const createdLogs = mockPrisma.studyReviewLog.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(createdLogs).toHaveLength(3);
    expect(createdLogs[0].source).toBe('anki_import');
  });

  it('skips orphaned imported revlogs instead of crashing the import', async () => {
    const colpkgBuffer = await buildFixtureColpkg({ includeOrphanedReviewLog: true });

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');

    const createdLogs = mockPrisma.studyReviewLog.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(createdLogs).toHaveLength(3);
    expect(createdLogs.every((log) => log.sourceCardId !== BigInt(9999))).toBe(true);
  });

  it('returns a friendly 400 when the uploaded collection archive is malformed', async () => {
    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: Buffer.from('not-a-valid-colpkg'),
        filename: 'broken.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('sanitizes study media storage paths before persisting imported media', async () => {
    mockPrisma.studyImportJob.create.mockResolvedValue({ id: '../import:job-1' });
    const colpkgBuffer = await buildFixtureColpkg();

    await importJapaneseStudyColpkg({
      userId: '../user:1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    const createdMedia = mockPrisma.studyMedia.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(createdMedia[0].storagePath).toContain('study-media/user_1/import_job-1/');
  });

  it('continues FSRS scheduling on review and appends an immutable log entry', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'imported',
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'imported',
        promptJson: {},
        answerJson: {},
        schedulerStateJson: {
          due: new Date('2026-05-01T00:00:00.000Z').toISOString(),
          stability: 16,
          difficulty: 4.1,
          elapsed_days: 4,
          scheduled_days: 19,
          learning_steps: 0,
          reps: 7,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyReviewLog.create.mockResolvedValue({ id: 'review-log-1' });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));

    const reviewResult = await recordStudyReview({
      userId: 'user-1',
      cardId: 'card-1',
      grade: 'good',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalled();
    expect(mockPrisma.studyReviewLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'convolab',
          stateBeforeJson: expect.anything(),
          stateAfterJson: expect.anything(),
          rawPayloadJson: expect.objectContaining({
            beforeQueueState: 'review',
          }),
        }),
      })
    );
    expect(reviewResult.reviewLogId).toBe('review-log-1');
    expect(reviewResult.card.id).toBe('card-1');
  });

  it('creates in-app cards and seeds answer-side audio generation', async () => {
    mockPrisma.studyNote.create.mockResolvedValue({ id: 'note-created' });
    mockPrisma.studyCard.create.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      noteId: 'note-created',
      cardType: 'recognition',
      queueState: 'new',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-created',
      noteId: 'note-created',
      cardType: 'recognition',
      queueState: 'new',
      answerAudioSource: 'generated',
      promptJson: { cueText: 'company' },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudio: {
          id: 'media-generated',
          filename: 'card-created.mp3',
          url: '/study-media/user-1/generated/card-created.mp3',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      schedulerStateJson: {
        due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        stability: 0.1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      },
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });

    const created = await createStudyCard({
      userId: 'user-1',
      cardType: 'recognition',
      prompt: { cueText: 'company' },
      answer: { expression: '会社', meaning: 'company' },
    });

    expect(mockPrisma.studyCard.create).toHaveBeenCalled();
    expect(created.answerAudioSource).toBe('generated');
  });

  it('starts a study session without blocking on answer-audio generation', async () => {
    mockPrisma.studyCard.findMany.mockResolvedValue([
      {
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceDue: 1,
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      },
    ]);
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      dueAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', 20);

    expect(session.cards).toHaveLength(1);
    expect(vi.mocked(synthesizeSpeech)).not.toHaveBeenCalled();
  });

  it('normalizes legacy cloze cards on session read without requiring re-import', async () => {
    mockPrisma.studyCard.findMany.mockResolvedValue([
      {
        id: 'card-cloze-1',
        userId: 'user-1',
        noteId: 'note-cloze-1',
        cardType: 'cloze',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceDue: 1,
        sourceTemplateOrd: 0,
        answerAudioSource: 'imported',
        promptJson: {
          clozeText: 'お風呂に虫{{c1::がいる::are (existence verb)}}！',
        },
        answerJson: {
          restoredText: 'お風呂に虫がいる！',
          meaning: 'There are bugs in the bath!',
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {
          rawFieldsJson: {
            Text: 'お風呂に虫{{c1::がいる::are (existence verb)}}！',
            ClozeHint: 'backup hint',
            AnswerExpression: 'お風呂に虫がいる！',
          },
        },
      },
    ]);
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      dueAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', 20);

    expect(session.cards[0]?.prompt).toMatchObject({
      clozeDisplayText: 'お風呂に虫[...]！',
      clozeAnswerText: 'がいる',
      clozeResolvedHint: 'are (existence verb)',
    });
    expect(session.cards[0]?.answer).toMatchObject({
      restoredText: 'お風呂に虫がいる！',
      restoredTextReading: 'お風呂に虫がいる！[furigana]',
    });
  });

  it('prepares answer audio for a single requested study card', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社' },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudio: {
            id: 'media-generated',
            filename: 'card-1.mp3',
            url: '/study-media/user-1/generated/card-1.mp3',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const card = await prepareStudyCardAnswerAudio('user-1', 'card-1');

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studyCard.update).toHaveBeenCalled();
    expect(card.answerAudioSource).toBe('generated');
  });

  it('undoes a review and restores the previous scheduler state', async () => {
    mockPrisma.studyReviewLog.findFirst
      .mockResolvedValueOnce({
        id: 'review-log-1',
        userId: 'user-1',
        cardId: 'card-1',
        source: 'convolab',
        reviewedAt: new Date('2026-04-12T00:00:00.000Z'),
        stateBeforeJson: {
          due: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 2,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        rawPayloadJson: {
          beforeQueueState: 'review',
          beforeDueAt: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          beforeLastReviewedAt: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        card: {
          id: 'card-1',
          userId: 'user-1',
          noteId: 'note-1',
          note: {},
        },
      })
      .mockResolvedValueOnce(null);
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyReviewLog.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      dueAt: new Date('2026-04-10T00:00:00.000Z'),
      answerAudioSource: 'imported',
      promptJson: { cueText: '会社' },
      answerJson: { expression: '会社', meaning: 'company' },
      schedulerStateJson: {
        due: new Date('2026-04-10T00:00:00.000Z').toISOString(),
        stability: 10,
        difficulty: 4,
        elapsed_days: 2,
        scheduled_days: 10,
        learning_steps: 0,
        reps: 6,
        lapses: 1,
        state: 2,
        last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
      },
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const undoResult = await undoStudyReview({
      userId: 'user-1',
      reviewLogId: 'review-log-1',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'review',
        }),
      })
    );
    expect(mockPrisma.studyReviewLog.delete).toHaveBeenCalledWith({
      where: { id: 'review-log-1' },
    });
    expect(undoResult.reviewLogId).toBe('review-log-1');
    expect(undoResult.card.id).toBe('card-1');
  });

  it('suspends and unsuspends a study card with the correct queue restoration', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'suspended',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'suspended',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const suspendResult = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'suspend',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'suspended',
        }),
      })
    );
    expect(suspendResult.card.state.queueState).toBe('suspended');

    const unsuspendResult = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'unsuspend',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'review',
        }),
      })
    );
    expect(unsuspendResult.card.state.queueState).toBe('review');
  });

  it('forgets a card without deleting review history', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'new',
        dueAt: null,
        lastReviewedAt: null,
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 0.1,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'forget',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'new',
          dueAt: null,
          lastReviewedAt: null,
        }),
      })
    );
    expect(mockPrisma.studyReviewLog.delete).not.toHaveBeenCalled();
    expect(result.card.state.queueState).toBe('new');
  });

  it('sets a custom due date and returns the updated card', async () => {
    const customDueAt = '2026-04-20T09:00:00.000Z';

    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date(customDueAt),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: customDueAt,
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 8,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'set_due',
      mode: 'custom_date',
      dueAt: customDueAt,
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'review',
          dueAt: new Date(customDueAt),
          schedulerStateJson: expect.objectContaining({
            due: customDueAt,
          }),
        }),
      })
    );
    expect(result.card.state.dueAt).toBe(customDueAt);
  });

  it('returns paginated browser rows with search and filters', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ id: 'note-1' }])
      .mockResolvedValueOnce([{ value: 'Cloze' }, { value: 'Japanese - Vocab' }])
      .mockResolvedValueOnce([{ value: 'cloze' }, { value: 'recognition' }])
      .mockResolvedValueOnce([{ value: 'new' }, { value: 'review' }]);
    mockPrisma.studyNote.findMany.mockResolvedValue([
      {
        id: 'note-1',
        sourceNotetypeName: 'Japanese - Vocab',
        rawFieldsJson: { Expression: '会社', Meaning: 'company' },
        canonicalJson: {},
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        cards: [
          {
            id: 'card-1',
            cardType: 'recognition',
            queueState: 'review',
            promptJson: { cueText: '会社' },
            answerJson: { meaning: 'company' },
            updatedAt: new Date('2026-04-12T00:00:00.000Z'),
          },
        ],
      },
      {
        id: 'note-2',
        sourceNotetypeName: 'Cloze',
        rawFieldsJson: { Text: 'お風呂に虫{{c1::がいる}}！' },
        canonicalJson: {},
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        cards: [
          {
            id: 'card-2',
            cardType: 'cloze',
            queueState: 'new',
            promptJson: { clozeDisplayText: 'お風呂に虫[...]！' },
            answerJson: { restoredText: 'お風呂に虫がいる！' },
            updatedAt: new Date('2026-04-11T00:00:00.000Z'),
          },
        ],
      },
    ]);
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      { cardId: 'card-1', _count: { _all: 4 } },
      { cardId: 'card-2', _count: { _all: 1 } },
    ]);

    const result = await getStudyBrowserList({
      userId: 'user-1',
      q: '会社',
      noteType: 'Japanese - Vocab',
      cardType: 'recognition',
      queueState: 'review',
      page: 1,
      pageSize: 100,
    });

    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({
      noteId: 'note-1',
      displayText: '会社',
      noteTypeName: 'Japanese - Vocab',
      cardCount: 1,
      reviewCount: 4,
      queueSummary: { review: 1 },
    });
    expect(result.filterOptions.noteTypes).toContain('Cloze');
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(5);
  });

  it('returns note detail with inspector fields, cards, and review stats', async () => {
    mockPrisma.studyNote.findFirst.mockResolvedValue({
      id: 'note-1',
      sourceKind: 'anki_import',
      sourceNotetypeName: 'Japanese - Vocab',
      rawFieldsJson: {
        Expression: '会社',
        Meaning: 'company',
        Photo: '<img src="company.png">',
        AudioWord: '[sound:company-word.mp3]',
      },
      canonicalJson: {
        createdInApp: false,
      },
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      cards: [
        {
          id: 'card-1',
          userId: 'user-1',
          noteId: 'note-1',
          cardType: 'recognition',
          queueState: 'review',
          dueAt: new Date('2026-04-12T00:00:00.000Z'),
          sourceTemplateOrd: 0,
          sourceTemplateName: 'Word -> Meaning',
          answerAudioSource: 'imported',
          promptJson: {
            cueText: '会社',
            cueAudio: { filename: 'company-word.mp3', mediaKind: 'audio', source: 'imported' },
            cueImage: { filename: 'company.png', mediaKind: 'image', source: 'imported_image' },
          },
          answerJson: { expression: '会社', meaning: 'company' },
          schedulerStateJson: {
            due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            stability: 10,
            difficulty: 4,
            elapsed_days: 4,
            scheduled_days: 10,
            learning_steps: 0,
            reps: 6,
            lapses: 1,
            state: 2,
            last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
          },
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-12T00:00:00.000Z'),
          note: {
            id: 'note-1',
            sourceNotetypeName: 'Japanese - Vocab',
            rawFieldsJson: {
              Expression: '会社',
            },
          },
          promptAudioMedia: {
            id: 'media-audio',
            userId: 'user-1',
            sourceKind: 'anki_import',
            sourceFilename: 'company-word.mp3',
            mediaKind: 'audio',
            publicUrl: '/study-media/user-1/import/company-word.mp3',
          },
          answerAudioMedia: null,
          imageMedia: {
            id: 'media-image',
            userId: 'user-1',
            sourceKind: 'anki_import',
            sourceFilename: 'company.png',
            mediaKind: 'image',
            publicUrl: '/study-media/user-1/import/company.png',
          },
        },
      ],
    });
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      {
        cardId: 'card-1',
        _count: { _all: 4 },
        _max: { reviewedAt: new Date('2026-04-10T00:00:00.000Z') },
      },
    ]);

    const result = await getStudyBrowserNoteDetail('user-1', 'note-1');

    expect(result?.noteId).toBe('note-1');
    expect(result?.selectedCardId).toBe('card-1');
    expect(result?.cardStats[0]).toMatchObject({
      cardId: 'card-1',
      reviewCount: 4,
    });
    expect(result?.rawFields.find((field) => field.name === 'Photo')?.image?.filename).toBe(
      'company.png'
    );
    expect(result?.rawFields.find((field) => field.name === 'AudioWord')?.audio?.filename).toBe(
      'company-word.mp3'
    );
  });

  it('updates a study card without changing scheduling and regenerates answer audio when spoken answer text changes', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceTemplateOrd: 0,
        answerAudioSource: 'imported',
        answerAudioMediaId: 'media-old',
        promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
        answerJson: {
          expression: '会社',
          expressionReading: '会社[かいしゃ]',
          meaning: 'company',
          answerAudio: {
            filename: 'old.mp3',
            url: '/study-media/user-1/import/old.mp3',
            mediaKind: 'audio',
            source: 'imported',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
        answerJson: {
          expression: '事業',
          expressionReading: '事業[じぎょう]',
          meaning: 'business',
          answerAudio: {
            filename: 'card-1.mp3',
            url: '/study-media/user-1/generated/card-1.mp3',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '事業', meaning: 'business' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const updated = await updateStudyCard({
      userId: 'user-1',
      cardId: 'card-1',
      prompt: { cueText: '会社', cueReading: 'かいしゃ' },
      answer: { expression: '事業', expressionReading: '事業[じぎょう]', meaning: 'business' },
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'card-1' },
        data: expect.objectContaining({
          answerAudioSource: 'missing',
          answerAudioMediaId: null,
        }),
      })
    );
    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalled();
    expect(updated.answer.meaning).toBe('business');
    expect(updated.answer.expression).toBe('事業');
    expect(updated.state.queueState).toBe('review');
  });
});
