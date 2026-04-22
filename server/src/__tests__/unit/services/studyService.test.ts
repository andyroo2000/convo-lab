import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { Prisma } from '@prisma/client';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  createStudyCard,
  exportStudyCardsSection,
  exportStudyData,
  exportStudyImportsSection,
  exportStudyMediaSection,
  exportStudyReviewLogsSection,
  getStudyHistory,
  getStudyOverview,
  getStudyMediaAccess,
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

const { deleteFromGCSPathMock, getSignedReadUrlMock, uploadBufferToGCSPathMock } = vi.hoisted(
  () => ({
    deleteFromGCSPathMock: vi.fn(),
    getSignedReadUrlMock: vi.fn(),
    uploadBufferToGCSPathMock: vi.fn(),
  })
);

vi.mock('../../../services/ttsClient.js', () => ({
  synthesizeSpeech: vi.fn(async () => Buffer.from('fake-audio')),
}));

vi.mock('../../../services/furiganaService.js', () => ({
  addFuriganaBrackets: vi.fn(async (text: string) => `${text}[furigana]`),
}));

vi.mock('../../../services/storageClient.js', () => ({
  deleteFromGCSPath: deleteFromGCSPathMock,
  getSignedReadUrl: getSignedReadUrlMock,
  uploadBufferToGCSPath: uploadBufferToGCSPathMock,
}));

const FIELD_SEPARATOR = String.fromCharCode(31);
const generatedStudyMediaPath = path.join(process.cwd(), 'storage/study-media');
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
  options: {
    includeOrphanedReviewLog?: boolean;
    companyPhotoFilename?: string;
    companyPhotoMediaEntryId?: string;
    companyPhotoZipEntryName?: string;
  } = {}
): Promise<Buffer> {
  const companyPhotoFilename = options.companyPhotoFilename ?? 'company.png';
  const companyPhotoMediaEntryId = options.companyPhotoMediaEntryId ?? '0';
  const companyPhotoZipEntryName = options.companyPhotoZipEntryName ?? companyPhotoMediaEntryId;
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
          `<img src="${companyPhotoFilename}">`,
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
      [companyPhotoMediaEntryId]: companyPhotoFilename,
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
    companyPhotoFilename,
    'company-word.mp3',
    'company-sentence.mp3',
    'vase.png',
    'vase-word.mp3',
    'entrance.png',
    'entrance-word.mp3',
    'bangkok-sentence.mp3',
  ];

  mediaFiles.forEach((mediaFilename, index) => {
    const entryName = index === 0 ? companyPhotoZipEntryName : String(index);
    zip.file(entryName, Buffer.from(`fixture:${mediaFilename}`));
  });

  db.close();

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('studyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GCS_BUCKET_NAME = '';
    deleteFromGCSPathMock.mockResolvedValue(undefined);
    uploadBufferToGCSPathMock.mockResolvedValue('https://storage.googleapis.com/test/study-media');
    getSignedReadUrlMock.mockResolvedValue({
      url: 'https://signed.example.com/study-media',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    mockPrisma.studyImportJob.create.mockResolvedValue({ id: 'import-job-1' });
    mockPrisma.studyImportJob.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);
    mockPrisma.studyImportJob.update.mockResolvedValue({ id: 'import-job-1' });
    mockPrisma.studyReviewLog.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyCard.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.studyNote.createMany.mockResolvedValue({ count: 4 });
    mockPrisma.studyMedia.createMany.mockResolvedValue({ count: 8 });
    mockPrisma.studyCard.createMany.mockResolvedValue({ count: 6 });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.groupBy.mockResolvedValue([]);
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
    expect(result.preview.skippedMediaCount).toBe(0);
    expect(result.preview.warnings).toEqual([]);

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
    expect(productionCard?.schedulerStateJson).toMatchObject({
      due: expect.any(String),
      state: expect.any(Number),
    });

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
    expect(typeof firstClozeCard?.searchText).toBe('string');
    expect(String(firstClozeCard?.searchText)).toContain('お風呂に虫');

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

    const createdNotes = mockPrisma.studyNote.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(typeof createdNotes[0]?.searchText).toBe('string');
    expect(String(createdNotes[0]?.searchText)).toContain('会社');
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

  it('returns 409 when another import is already processing for the user', async () => {
    mockPrisma.studyImportJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate import', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );
    mockPrisma.studyImportJob.findFirst.mockResolvedValue({
      id: 'import-job-active',
      userId: 'user-1',
      status: 'processing',
    });

    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg(),
        filename: 'japanese.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('cleans up persisted media when an import fails after upload', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyNote.createMany.mockRejectedValueOnce(new Error('transaction failed'));

    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg(),
        filename: 'japanese.colpkg',
      })
    ).rejects.toThrow('Study import failed. Please verify the .colpkg file and try again.');

    expect(deleteFromGCSPathMock).toHaveBeenCalled();
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

  it('skips imported media persistence when the media manifest filename is unsafe', async () => {
    const colpkgBuffer = await buildFixtureColpkg({
      companyPhotoFilename: '../company.png',
    });

    await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    const createdMedia = mockPrisma.studyMedia.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    const companyPhoto = createdMedia.find((media) => media.sourceFilename === '../company.png');

    expect(companyPhoto).toMatchObject({
      publicUrl: null,
      storagePath: null,
    });
    expect(mockPrisma.studyImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previewJson: expect.objectContaining({
            skippedMediaCount: 1,
            warnings: expect.arrayContaining(['../company.png: Skipped unsafe media path.']),
          }),
        }),
      })
    );
  });

  it('skips imported media persistence when the zip entry id is unsafe', async () => {
    const colpkgBuffer = await buildFixtureColpkg({
      companyPhotoMediaEntryId: '../0',
    });

    await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    const createdMedia = mockPrisma.studyMedia.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    const companyPhoto = createdMedia.find((media) => media.sourceFilename === 'company.png');

    expect(companyPhoto).toMatchObject({
      publicUrl: null,
      storagePath: null,
    });
  });

  it('skips .colpkg media entries that point at unsafe zip entry paths and reports a warning', async () => {
    const colpkgBuffer = await buildFixtureColpkg({
      companyPhotoZipEntryName: 'nested/0',
    });

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: colpkgBuffer,
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.skippedMediaCount).toBe(1);
    expect(result.preview.warnings).toContain('company.png: Skipped unsafe archive entry.');
  });

  it('sanitizes unexpected import failures before persisting or surfacing them', async () => {
    const colpkgBuffer = await buildFixtureColpkg();
    mockPrisma.studyNote.createMany.mockRejectedValueOnce(
      new Error('/private/tmp/anki/collection.anki21b.sqlite3: malformed database')
    );

    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: colpkgBuffer,
        filename: 'japanese.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Study import failed. Please verify the .colpkg file and try again.',
    });

    expect(mockPrisma.studyImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorMessage: 'Study import failed. Please verify the .colpkg file and try again.',
        }),
      })
    );
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

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalled();
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

  it('reuses cached overview data for review results without running the full overview aggregation', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: {},
        answerJson: {},
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 12,
          difficulty: 4,
          elapsed_days: 3,
          scheduled_days: 7,
          learning_steps: 0,
          reps: 5,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-09T00:00:00.000Z').toISOString(),
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
        dueAt: new Date('2026-04-20T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: {},
        answerJson: {},
        schedulerStateJson: {
          due: new Date('2026-04-20T00:00:00.000Z').toISOString(),
          stability: 15,
          difficulty: 4,
          elapsed_days: 3,
          scheduled_days: 8,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyReviewLog.create.mockResolvedValue({ id: 'review-log-2' });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
    mockPrisma.studyCard.count.mockRejectedValue(new Error('overview count should not run'));
    mockPrisma.studyCard.groupBy.mockRejectedValue(new Error('overview groupBy should not run'));
    mockPrisma.studyImportJob.findFirst.mockRejectedValue(
      new Error('latest import lookup should not run')
    );

    const result = await recordStudyReview({
      userId: 'user-1',
      cardId: 'card-1',
      grade: 'good',
      currentOverview: {
        dueCount: 3,
        newCount: 1,
        learningCount: 0,
        reviewCount: 2,
        suspendedCount: 0,
        totalCards: 3,
        latestImport: null,
        nextDueAt: '2026-04-12T00:00:00.000Z',
      },
    });

    expect(result.overview.dueCount).toBe(3);
    expect(result.overview.reviewCount).toBe(2);
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

  it('deduplicates concurrent answer-audio generation for the same card', async () => {
    let resolveAudio!: (buffer: Buffer) => void;
    vi.mocked(synthesizeSpeech).mockReturnValueOnce(
      new Promise<Buffer>((resolve) => {
        resolveAudio = resolve;
      })
    );
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-concurrent',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
    });
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-concurrent',
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
          filename: 'card-concurrent.mp3',
          url: '/api/study/media/media-generated',
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
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const firstRequest = prepareStudyCardAnswerAudio('user-1', 'card-concurrent');
    const secondRequest = prepareStudyCardAnswerAudio('user-1', 'card-concurrent');

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledTimes(1);

    resolveAudio(Buffer.from('fake-audio'));

    const [firstCard, secondCard] = await Promise.all([firstRequest, secondRequest]);

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studyMedia.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studyCard.update).toHaveBeenCalledTimes(1);
    expect(firstCard.answerAudioSource).toBe('generated');
    expect(secondCard.answerAudioSource).toBe('generated');
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

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
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

  it('uses reviewedAt and id ordering when checking for newer undo-blocking reviews', async () => {
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
        },
        card: {
          id: 'card-1',
          userId: 'user-1',
          noteId: 'note-1',
          note: {},
        },
      })
      .mockResolvedValueOnce({
        id: 'review-log-2',
      });

    await expect(
      undoStudyReview({
        userId: 'user-1',
        reviewLogId: 'review-log-1',
      })
    ).rejects.toThrow('Only the latest review for this card can be undone.');

    expect(mockPrisma.studyReviewLog.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              reviewedAt: {
                gt: new Date('2026-04-12T00:00:00.000Z'),
              },
            },
            {
              reviewedAt: new Date('2026-04-12T00:00:00.000Z'),
              id: {
                gt: 'review-log-1',
              },
            },
          ],
        }),
      })
    );
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
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const suspendResult = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'suspend',
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
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

    expect(mockPrisma.studyCard.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
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
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'forget',
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
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
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'set_due',
      mode: 'custom_date',
      dueAt: customDueAt,
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
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

  it('rebuilds missing scheduler state when suspending legacy cards', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-legacy',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceInterval: 6,
        sourceReps: 4,
        sourceLapses: 1,
        lastReviewedAt: new Date('2026-04-06T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: null,
        sourceFsrsJson: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-legacy',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'suspended',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceInterval: 6,
        sourceReps: 4,
        sourceLapses: 1,
        lastReviewedAt: new Date('2026-04-06T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 6,
          difficulty: 5,
          elapsed_days: 1,
          scheduled_days: 6,
          learning_steps: 0,
          reps: 4,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-06T00:00:00.000Z').toISOString(),
        },
        sourceFsrsJson: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.count.mockRejectedValue(new Error('overview count should not run'));
    mockPrisma.studyCard.groupBy.mockRejectedValue(new Error('overview groupBy should not run'));
    mockPrisma.studyImportJob.findFirst.mockRejectedValue(
      new Error('latest import lookup should not run')
    );

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-legacy',
      action: 'suspend',
      currentOverview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
        latestImport: null,
        nextDueAt: '2026-04-12T00:00:00.000Z',
      },
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'suspended',
          schedulerStateJson: expect.objectContaining({
            due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
            state: 2,
          }),
        }),
      })
    );
    expect(result.overview.reviewCount).toBe(0);
    expect(result.overview.suspendedCount).toBe(1);
  });

  it('returns paginated browser rows with search and filters', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ id: 'note-1', updatedAt: new Date('2026-04-12T00:00:00.000Z') }])
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
      limit: 100,
    });

    expect(result.total).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.nextCursor).toBeNull();
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

  it('returns a browser nextCursor when additional notes remain', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([
        { id: 'note-2', updatedAt: new Date('2026-04-13T00:00:00.000Z') },
        { id: 'note-1', updatedAt: new Date('2026-04-12T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([{ value: 'Japanese - Vocab' }])
      .mockResolvedValueOnce([{ value: 'recognition' }])
      .mockResolvedValueOnce([{ value: 'review' }]);
    mockPrisma.studyNote.findMany.mockResolvedValue([
      {
        id: 'note-2',
        sourceNotetypeName: 'Japanese - Vocab',
        rawFieldsJson: { Expression: '銀行' },
        canonicalJson: {},
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
        cards: [
          {
            id: 'card-2',
            cardType: 'recognition',
            queueState: 'review',
            promptJson: { cueText: '銀行' },
            answerJson: { meaning: 'bank' },
            updatedAt: new Date('2026-04-13T00:00:00.000Z'),
          },
        ],
      },
    ]);
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      { cardId: 'card-2', _count: { _all: 1 } },
    ]);

    const result = await getStudyBrowserList({
      userId: 'user-1',
      limit: 1,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.noteId).toBe('note-2');
    expect(result.nextCursor).toBeTruthy();
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

  it('filters foreign cards out of browser note detail results', async () => {
    mockPrisma.studyNote.findFirst.mockResolvedValue({
      id: 'note-1',
      sourceKind: 'anki_import',
      sourceNotetypeName: 'Japanese - Vocab',
      rawFieldsJson: {},
      canonicalJson: {},
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      cards: [
        {
          id: 'card-1',
          userId: 'user-1',
          noteId: 'note-1',
          cardType: 'recognition',
          queueState: 'review',
          dueAt: null,
          sourceTemplateOrd: 0,
          sourceTemplateName: 'Word -> Meaning',
          answerAudioSource: 'none',
          promptJson: { cueText: '会社' },
          answerJson: { expression: '会社', meaning: 'company' },
          schedulerStateJson: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-12T00:00:00.000Z'),
          note: {
            id: 'note-1',
            sourceNotetypeName: 'Japanese - Vocab',
            rawFieldsJson: {},
          },
          promptAudioMedia: null,
          answerAudioMedia: null,
          imageMedia: null,
        },
        {
          id: 'card-2',
          userId: 'user-2',
          noteId: 'note-1',
          cardType: 'recognition',
          queueState: 'review',
          dueAt: null,
          sourceTemplateOrd: 1,
          sourceTemplateName: 'Other',
          answerAudioSource: 'none',
          promptJson: { cueText: 'leak' },
          answerJson: { expression: 'leak', meaning: 'leak' },
          schedulerStateJson: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-12T00:00:00.000Z'),
          note: {
            id: 'note-1',
            sourceNotetypeName: 'Japanese - Vocab',
            rawFieldsJson: {},
          },
          promptAudioMedia: null,
          answerAudioMedia: null,
          imageMedia: null,
        },
      ],
    });
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([]);

    const result = await getStudyBrowserNoteDetail('user-1', 'note-1');

    expect(result?.cards).toHaveLength(1);
    expect(result?.cards[0]?.id).toBe('card-1');
    expect(result?.selectedCardId).toBe('card-1');
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

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'card-1', userId: 'user-1' },
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

  it('returns paginated study history with a cursor', async () => {
    mockPrisma.studyReviewLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        cardId: 'card-1',
        source: 'convolab',
        reviewedAt: new Date('2026-04-13T00:00:00.000Z'),
        rating: 3,
        durationMs: 1200,
        sourceReviewId: null,
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: { grade: 'good' },
      },
      {
        id: 'log-1',
        cardId: 'card-1',
        source: 'anki_import',
        reviewedAt: new Date('2026-04-12T00:00:00.000Z'),
        rating: 2,
        durationMs: null,
        sourceReviewId: BigInt(1775915610000),
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: { reviewId: 1775915610000 },
      },
    ]);

    const result = await getStudyHistory({
      userId: 'user-1',
      cardId: 'card-1',
      limit: 1,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('log-2');
    expect(result.nextCursor).toBeTruthy();
    expect(mockPrisma.studyReviewLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  it('aggregates the study overview with grouped queue-state counts', async () => {
    mockPrisma.studyCard.count.mockResolvedValue(3);
    mockPrisma.studyCard.groupBy.mockResolvedValue([
      { queueState: 'new', _count: { _all: 5 } },
      { queueState: 'learning', _count: { _all: 2 } },
      { queueState: 'relearning', _count: { _all: 1 } },
      { queueState: 'review', _count: { _all: 7 } },
      { queueState: 'suspended', _count: { _all: 2 } },
      { queueState: 'buried', _count: { _all: 1 } },
    ]);
    mockPrisma.studyCard.findFirst.mockReset();
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      dueAt: new Date('2026-04-14T00:00:00.000Z'),
    });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue({
      id: 'import-job-1',
      status: 'completed',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      previewJson: {
        deckName: '日本語',
        noteCount: 4,
        cardCount: 6,
        reviewLogCount: 3,
        importedNotetypeNames: ['Japanese - Vocab'],
      },
      completedAt: new Date('2026-04-15T00:00:00.000Z'),
      errorMessage: null,
    });

    const overview = await getStudyOverview('user-1');

    expect(mockPrisma.studyCard.groupBy).toHaveBeenCalledWith({
      by: ['queueState'],
      where: { userId: 'user-1' },
      _count: { _all: true },
    });
    expect(overview).toMatchObject({
      dueCount: 3,
      newCount: 5,
      learningCount: 3,
      reviewCount: 7,
      suspendedCount: 3,
      totalCards: 18,
      nextDueAt: '2026-04-14T00:00:00.000Z',
    });
  });

  it('serves study media from private local storage when available', async () => {
    const storagePath = 'study-media/user-1/import/audio.mp3';
    const absolutePath = path.join(generatedStudyMediaPath, 'user-1/import/audio.mp3');
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from('audio'));

    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'audio.mp3',
      storagePath,
      publicUrl: null,
      contentType: 'audio/mpeg',
    });

    const result = await getStudyMediaAccess('user-1', 'media-1');

    expect(result).toEqual({
      type: 'local',
      absolutePath,
      contentType: 'audio/mpeg',
      filename: 'audio.mp3',
    });
  });

  it('caches signed study media redirects for repeated GCS access', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    getSignedReadUrlMock.mockResolvedValue({
      url: 'https://signed.example.com/audio.mp3',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'audio.mp3',
      storagePath: 'study-media/user-1/import/audio.mp3',
      publicUrl: 'https://storage.googleapis.com/test-bucket/study-media/user-1/import/audio.mp3',
      contentType: 'audio/mpeg',
    });

    const first = await getStudyMediaAccess('user-1', 'media-1');
    const second = await getStudyMediaAccess('user-1', 'media-1');

    expect(first).toEqual({
      type: 'redirect',
      redirectUrl: 'https://signed.example.com/audio.mp3',
      contentType: 'audio/mpeg',
      filename: 'audio.mp3',
    });
    expect(second).toEqual(first);
    expect(getSignedReadUrlMock).toHaveBeenCalledTimes(1);
  });

  it('signs GCS study media even when publicUrl is null', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-unique',
      userId: 'user-1',
      sourceFilename: 'audio.mp3',
      storagePath: 'study-media/user-1/import/audio-unique.mp3',
      publicUrl: null,
      contentType: 'audio/mpeg',
    });

    const result = await getStudyMediaAccess('user-1', 'media-unique');

    expect(result).toEqual({
      type: 'redirect',
      redirectUrl: 'https://signed.example.com/study-media',
      contentType: 'audio/mpeg',
      filename: 'audio.mp3',
    });
    expect(getSignedReadUrlMock).toHaveBeenCalledTimes(1);
  });

  it('returns a lightweight study export manifest with section totals', async () => {
    mockPrisma.studyCard.count.mockResolvedValue(10);
    mockPrisma.studyReviewLog.count.mockResolvedValue(20);
    mockPrisma.studyMedia.count.mockResolvedValue(5);
    mockPrisma.studyImportJob.count.mockResolvedValue(2);

    const result = await exportStudyData('user-1');

    expect(result.sections).toEqual({
      cards: { total: 10 },
      reviewLogs: { total: 20 },
      media: { total: 5 },
      imports: { total: 2 },
    });
  });

  it('paginates study export sections with stable cursors', async () => {
    const cardRecord = {
      id: 'card-2',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      promptJson: { cueText: '会社' },
      answerJson: { expression: '会社', meaning: 'company' },
      schedulerStateJson: {
        due: '2026-04-21T00:00:00.000Z',
        stability: 10,
        difficulty: 5,
        elapsed_days: 2,
        scheduled_days: 3,
        reps: 1,
        lapses: 0,
        state: 2,
      },
      answerAudioSource: 'missing',
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T12:00:00.000Z'),
      note: {
        id: 'note-1',
        userId: 'user-1',
        rawFieldsJson: { Expression: '会社' },
      },
      promptAudioMedia: null,
      answerAudioMedia: null,
      imageMedia: null,
    };
    mockPrisma.studyCard.findMany.mockResolvedValue([cardRecord, { ...cardRecord, id: 'card-1' }]);

    const cardsSection = await exportStudyCardsSection({ userId: 'user-1', limit: 1 });

    expect(cardsSection.items).toHaveLength(1);
    expect(cardsSection.nextCursor).toBeTruthy();

    mockPrisma.studyReviewLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        userId: 'user-1',
        cardId: 'card-2',
        source: 'convolab',
        reviewedAt: new Date('2026-04-21T12:00:00.000Z'),
        rating: 3,
        durationMs: 5000,
        sourceReviewId: null,
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: null,
      },
      {
        id: 'log-1',
        userId: 'user-1',
        cardId: 'card-1',
        source: 'convolab',
        reviewedAt: new Date('2026-04-20T12:00:00.000Z'),
        rating: 4,
        durationMs: 4000,
        sourceReviewId: null,
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: null,
      },
    ]);
    const reviewLogsSection = await exportStudyReviewLogsSection({ userId: 'user-1', limit: 1 });
    expect(reviewLogsSection.items).toHaveLength(1);
    expect(reviewLogsSection.nextCursor).toBeTruthy();

    mockPrisma.studyMedia.findMany.mockResolvedValue([
      {
        id: 'media-2',
        userId: 'user-1',
        sourceFilename: 'audio.mp3',
        mediaKind: 'audio',
        sourceKind: 'anki_import',
        updatedAt: new Date('2026-04-21T12:00:00.000Z'),
      },
      {
        id: 'media-1',
        userId: 'user-1',
        sourceFilename: 'image.png',
        mediaKind: 'image',
        sourceKind: 'anki_import',
        updatedAt: new Date('2026-04-20T12:00:00.000Z'),
      },
    ]);
    const mediaSection = await exportStudyMediaSection({ userId: 'user-1', limit: 1 });
    expect(mediaSection.items).toHaveLength(1);
    expect(mediaSection.nextCursor).toBeTruthy();

    mockPrisma.studyImportJob.findMany.mockResolvedValue([
      {
        id: 'import-2',
        userId: 'user-1',
        status: 'completed',
        sourceFilename: 'japanese-2.colpkg',
        deckName: '日本語',
        previewJson: {
          deckName: '日本語',
          cardCount: 1,
          noteCount: 1,
          reviewLogCount: 1,
          mediaReferenceCount: 1,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
        completedAt: new Date('2026-04-21T12:00:00.000Z'),
        errorMessage: null,
        updatedAt: new Date('2026-04-21T12:00:00.000Z'),
      },
      {
        id: 'import-1',
        userId: 'user-1',
        status: 'completed',
        sourceFilename: 'japanese-1.colpkg',
        deckName: '日本語',
        previewJson: {
          deckName: '日本語',
          cardCount: 1,
          noteCount: 1,
          reviewLogCount: 1,
          mediaReferenceCount: 1,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
        completedAt: new Date('2026-04-20T12:00:00.000Z'),
        errorMessage: null,
        updatedAt: new Date('2026-04-20T12:00:00.000Z'),
      },
    ]);
    const importsSection = await exportStudyImportsSection({ userId: 'user-1', limit: 1 });
    expect(importsSection.items).toHaveLength(1);
    expect(importsSection.nextCursor).toBeTruthy();
  });
});
