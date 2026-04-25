import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { Prisma } from '@prisma/client';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { vi } from 'vitest';

import { mockPrisma } from '../../setup.js';

const storageMocks = vi.hoisted(() => ({
  createResumableUploadSessionMock: vi.fn(),
  deleteFromGCSPathMock: vi.fn(),
  downloadFromGCSPathMock: vi.fn(),
  getGcsBucketCorsConfigurationMock: vi.fn(),
  getGcsObjectMetadataMock: vi.fn(),
  getSignedReadUrlMock: vi.fn(),
  readGCSObjectPrefixMock: vi.fn(),
  uploadBufferToGCSPathMock: vi.fn(),
}));

export const {
  createResumableUploadSessionMock,
  deleteFromGCSPathMock,
  downloadFromGCSPathMock,
  getGcsBucketCorsConfigurationMock,
  getGcsObjectMetadataMock,
  getSignedReadUrlMock,
  readGCSObjectPrefixMock,
  uploadBufferToGCSPathMock,
} = storageMocks;

const queueMocks = vi.hoisted(() => ({
  enqueueStudyImportJobMock: vi.fn(),
}));

export const { enqueueStudyImportJobMock } = queueMocks;

const redisMocks = vi.hoisted(() => ({
  createRedisConnectionMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
}));

export const { createRedisConnectionMock, redisDelMock, redisGetMock, redisSetMock } = redisMocks;

vi.mock('../../../services/ttsClient.js', () => ({
  synthesizeSpeech: vi.fn(async () => Buffer.from('fake-audio')),
}));

vi.mock('../../../services/furiganaService.js', () => ({
  addFuriganaBrackets: vi.fn(async (text: string) => `${text}[furigana]`),
}));

vi.mock('../../../services/storageClient.js', () => ({
  createResumableUploadSession: createResumableUploadSessionMock,
  deleteFromGCSPath: deleteFromGCSPathMock,
  downloadFromGCSPath: downloadFromGCSPathMock,
  getGcsBucketCorsConfiguration: getGcsBucketCorsConfigurationMock,
  getGcsObjectMetadata: getGcsObjectMetadataMock,
  getSignedReadUrl: getSignedReadUrlMock,
  readGCSObjectPrefix: readGCSObjectPrefixMock,
  uploadBufferToGCSPath: uploadBufferToGCSPathMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
}));

vi.mock('../../../jobs/studyImportQueue.js', () => ({
  enqueueStudyImportJob: enqueueStudyImportJobMock,
  studyImportQueue: {},
  studyImportWorker: {},
}));

const FIELD_SEPARATOR = String.fromCharCode(31);
export const generatedStudyMediaPath = path.join(process.cwd(), 'storage/study-media');
const require = createRequire(import.meta.url);
const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const zstdWasm = require('@bokuweb/zstd-wasm') as {
  init: () => Promise<void>;
  compress: (buffer: Uint8Array, level?: number) => Uint8Array;
};
let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;
let zstdWasmInitPromise: Promise<void> | null = null;

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

async function compressZstdBuffer(buffer: Buffer): Promise<Buffer> {
  if (!zstdWasmInitPromise) {
    zstdWasmInitPromise = zstdWasm.init().catch((error) => {
      zstdWasmInitPromise = null;
      throw error;
    });
  }

  await zstdWasmInitPromise;
  return Buffer.from(zstdWasm.compress(buffer, 3));
}

function encodeProtoVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;

  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (remaining > 0);

  return Buffer.from(bytes);
}

function encodeProtoField(fieldNumber: number, wireType: number): Buffer {
  return encodeProtoVarint(fieldNumber * 8 + wireType);
}

function encodeProtoLengthDelimited(fieldNumber: number, value: Buffer): Buffer {
  return Buffer.concat([encodeProtoField(fieldNumber, 2), encodeProtoVarint(value.length), value]);
}

function encodeProtoString(fieldNumber: number, value: string): Buffer {
  return encodeProtoLengthDelimited(fieldNumber, Buffer.from(value, 'utf8'));
}

function encodeProtoUint32(fieldNumber: number, value: number): Buffer {
  return Buffer.concat([encodeProtoField(fieldNumber, 0), encodeProtoVarint(value)]);
}

function encodeProtoBytes(fieldNumber: number, value: Buffer): Buffer {
  return encodeProtoLengthDelimited(fieldNumber, value);
}

function encodeMediaEntriesManifest(
  mediaFiles: Array<{
    data: Buffer;
    filename: string;
    sha1?: Buffer;
  }>
): Buffer {
  return Buffer.concat(
    mediaFiles.map(({ data, filename, sha1 }) => {
      const entry = Buffer.concat([
        encodeProtoString(1, filename),
        encodeProtoUint32(2, data.length),
        encodeProtoBytes(3, sha1 ?? createHash('sha1').update(data).digest()),
      ]);
      return encodeProtoLengthDelimited(1, entry);
    })
  );
}

export async function buildFixtureColpkg(
  options: {
    deckName?: string;
    includeOrphanedReviewLog?: boolean;
    companyPhotoFilename?: string;
    companyPhotoMediaEntryId?: string;
    companyPhotoZipEntryName?: string;
    clozeText?: string;
    compressCollectionDatabase?: boolean;
    compressMediaFiles?: boolean;
    compressMediaManifest?: boolean;
    corruptCompanyPhotoSha1?: boolean;
    largeCompanyPhotoBytes?: number;
    useLatestMediaManifest?: boolean;
    vocabNotes?: string;
  } = {}
): Promise<Buffer> {
  const deckName = options.deckName ?? '日本語';
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
      name: deckName,
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
          options.vocabNotes ?? 'Common workplace noun.',
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
          options.clozeText ?? 'お風呂に虫{{c1::がいる::are (existence verb)}}！ {{c2::助けて}}！',
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
  const collectionDatabase = Buffer.from(db.export());
  zip.file(
    options.compressCollectionDatabase ? 'collection.anki21b' : 'collection.anki2',
    options.compressCollectionDatabase
      ? await compressZstdBuffer(collectionDatabase)
      : collectionDatabase
  );

  const mediaFilenames = [
    companyPhotoFilename,
    'company-word.mp3',
    'company-sentence.mp3',
    'vase.png',
    'vase-word.mp3',
    'entrance.png',
    'entrance-word.mp3',
    'bangkok-sentence.mp3',
  ];
  const mediaFiles = mediaFilenames.map((filename) => ({
    filename,
    data:
      filename === companyPhotoFilename && options.largeCompanyPhotoBytes
        ? Buffer.alloc(options.largeCompanyPhotoBytes, 'a')
        : Buffer.from(`fixture:${filename}`),
    sha1:
      filename === companyPhotoFilename && options.corruptCompanyPhotoSha1
        ? Buffer.alloc(20, 0)
        : undefined,
  }));

  const mediaManifest = options.useLatestMediaManifest
    ? encodeMediaEntriesManifest(mediaFiles)
    : Buffer.from(
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
  zip.file(
    'media',
    options.compressMediaManifest ? await compressZstdBuffer(mediaManifest) : mediaManifest
  );

  for (const [index, mediaFile] of mediaFiles.entries()) {
    const entryName = index === 0 ? companyPhotoZipEntryName : String(index);
    zip.file(
      entryName,
      options.compressMediaFiles ? await compressZstdBuffer(mediaFile.data) : mediaFile.data
    );
  }

  db.close();

  return zip.generateAsync({ type: 'nodebuffer' });
}

export function resetStudyServiceMocks() {
  vi.clearAllMocks();
  const defaultImportJob = {
    id: 'import-job-1',
    userId: 'user-1',
    status: 'processing',
    sourceType: 'anki_colpkg',
    sourceFilename: 'japanese.colpkg',
    sourceObjectPath: 'study/imports/user-1/import-job-1/japanese.colpkg',
    sourceContentType: 'application/zip',
    sourceSizeBytes: BigInt(1024),
    deckName: '日本語',
    previewJson: {
      deckName: '日本語',
      cardCount: 0,
      noteCount: 0,
      reviewLogCount: 0,
      mediaReferenceCount: 0,
      skippedMediaCount: 0,
      warnings: [],
      noteTypeBreakdown: [],
    },
    summaryJson: null,
    errorMessage: null,
    startedAt: null,
    uploadedAt: null,
    uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-04-23T00:00:00.000Z'),
    updatedAt: new Date('2026-04-23T00:00:00.000Z'),
  };
  createRedisConnectionMock.mockReturnValue({
    set: redisSetMock,
    get: redisGetMock,
    del: redisDelMock,
  });
  redisSetMock.mockResolvedValue('OK');
  redisGetMock.mockResolvedValue(null);
  redisDelMock.mockResolvedValue(1);
  process.env.GCS_BUCKET_NAME = '';
  deleteFromGCSPathMock.mockResolvedValue(undefined);
  downloadFromGCSPathMock.mockImplementation(async ({ destinationPath }) => destinationPath);
  getGcsObjectMetadataMock.mockResolvedValue({
    contentType: 'application/zip',
    sizeBytes: 1024,
  });
  getGcsBucketCorsConfigurationMock.mockResolvedValue([
    {
      origin: ['http://localhost:5173'],
      method: ['PUT', 'OPTIONS'],
      responseHeader: ['Content-Type'],
      maxAgeSeconds: 3600,
    },
  ]);
  readGCSObjectPrefixMock.mockResolvedValue(Buffer.from('PK'));
  uploadBufferToGCSPathMock.mockResolvedValue('https://storage.googleapis.com/test/study-media');
  createResumableUploadSessionMock.mockResolvedValue({
    url: 'https://uploads.example/import-job-1',
    filePath: 'study/imports/user-1/import-job-1/japanese.colpkg',
  });
  enqueueStudyImportJobMock.mockResolvedValue({ id: 'import-job-1' });
  getSignedReadUrlMock.mockResolvedValue({
    url: 'https://signed.example.com/study-media',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  mockPrisma.studyImportJob.create.mockResolvedValue(defaultImportJob);
  mockPrisma.studyImportJob.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);
  mockPrisma.studyImportJob.findUnique?.mockResolvedValue(defaultImportJob);
  mockPrisma.studyImportJob.findMany?.mockResolvedValue([]);
  mockPrisma.studyImportJob.update.mockResolvedValue(defaultImportJob);
  mockPrisma.studyReviewLog.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyCard.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyNote.createMany.mockResolvedValue({ count: 4 });
  mockPrisma.studyMedia.createMany.mockResolvedValue({ count: 8 });
  mockPrisma.studyCard.createMany.mockResolvedValue({ count: 6 });
  mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.studyCard.groupBy.mockResolvedValue([]);
  mockPrisma.$queryRaw.mockResolvedValue([
    {
      due_count: 0,
      new_count: 0,
      learning_count: 0,
      review_count: 0,
      suspended_count: 0,
      total_cards: 0,
      next_due_at: null,
    },
  ]);
  mockPrisma.studyReviewLog.createMany.mockResolvedValue({ count: 3 });
  mockPrisma.$transaction.mockImplementation(async (callbackOrOperations) =>
    Array.isArray(callbackOrOperations)
      ? Promise.all(callbackOrOperations)
      : callbackOrOperations(mockPrisma)
  );
}

export async function cleanupStudyServiceTestMedia() {
  await fs.rm(generatedStudyMediaPath, { recursive: true, force: true });
}

export { mockPrisma, Prisma };
