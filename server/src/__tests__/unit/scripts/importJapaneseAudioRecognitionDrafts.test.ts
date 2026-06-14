import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  ConvoLabDraftApiClient,
  importManifestDrafts,
  planManifestImport,
  readManifest,
  type QueueDraftResult,
} from '../../../scripts/import-japanese-audio-recognition-drafts.js';

async function writeTempManifest(lines: unknown[]): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ja-audio-drafts-'));
  const manifestPath = path.join(dir, 'manifest.jsonl');
  await writeFile(
    manifestPath,
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'utf8'
  );
  return manifestPath;
}

async function readManifestRows(manifestPath: string): Promise<Array<Record<string, unknown>>> {
  const contents = await readFile(manifestPath, 'utf8');
  return contents
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('Japanese audio recognition draft importer', () => {
  it('parses flexible sentence fields and plans exact duplicate skips', async () => {
    const manifestPath = await writeTempManifest([
      { sourceImage: 'one.png', sentence: '  今日は暑いです。  ' },
      { sourceImage: 'two.png', japanese: '今日は暑いです。' },
      { sourceImage: 'three.png', text: '明日行きます。', queuedDraftId: 'draft-existing' },
    ]);

    const entries = await readManifest(manifestPath);
    const planned = planManifestImport(entries);

    expect(entries.map((entry) => entry.sentence)).toEqual([
      '今日は暑いです。',
      '今日は暑いです。',
      '明日行きます。',
    ]);
    expect(planned.map((entry) => entry.reason)).toEqual([
      'ready_to_queue',
      'duplicate_sentence',
      'already_queued',
    ]);
  });

  it('records queued draft IDs, duplicate statuses, and API errors for reruns', async () => {
    const manifestPath = await writeTempManifest([
      { sourceImage: 'one.png', sentence: '今日は暑いです。' },
      { sourceImage: 'two.png', sentence: '今日は暑いです。' },
      {
        sourceImage: 'three.png',
        sentence: '明日行きます。',
        expressionReading: '明日[あした]行[い]きます。',
      },
    ]);
    const queueAudioRecognitionDraft = vi
      .fn<(sentence: string, expressionReading?: string | null) => Promise<QueueDraftResult>>()
      .mockResolvedValueOnce({
        draft: { id: 'draft-1', status: 'generating' } as QueueDraftResult['draft'],
        httpStatus: 201,
      })
      .mockRejectedValueOnce(new ApiRequestError('rate limited', 429));

    const summary = await importManifestDrafts({
      manifestPath,
      apply: true,
      client: { queueAudioRecognitionDraft },
      delayMs: 0,
      now: () => new Date('2026-06-14T12:00:00.000Z'),
    });

    expect(summary).toMatchObject({
      totalRows: 3,
      toQueue: 2,
      queued: 1,
      duplicates: 1,
      failed: 1,
      dryRun: false,
    });
    expect(queueAudioRecognitionDraft).toHaveBeenCalledTimes(2);
    expect(queueAudioRecognitionDraft).toHaveBeenNthCalledWith(1, '今日は暑いです。', null);
    expect(queueAudioRecognitionDraft).toHaveBeenNthCalledWith(
      2,
      '明日行きます。',
      '明日[あした]行[い]きます。'
    );

    const rows = await readManifestRows(manifestPath);
    expect(rows[0]).toMatchObject({
      status: 'queued',
      queuedDraftId: 'draft-1',
      queuedAt: '2026-06-14T12:00:00.000Z',
      lastApiStatus: 201,
      error: null,
    });
    expect(rows[1]).toMatchObject({
      status: 'duplicate',
      error: null,
      lastApiStatus: null,
    });
    expect(rows[2]).toMatchObject({
      status: 'error',
      error: 'rate limited',
      lastApiStatus: 429,
    });

    const rerunSummary = await importManifestDrafts({
      manifestPath,
      apply: false,
    });
    expect(rerunSummary).toMatchObject({
      totalRows: 3,
      toQueue: 1,
      alreadyQueued: 1,
      duplicates: 1,
      dryRun: true,
    });
  });

  it('bootstraps CSRF and queues an audio-recognition draft with browser-cookie auth', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: {
            'set-cookie': 'XSRF-TOKEN=csrf%20token; Path=/; SameSite=Lax',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'draft-1', status: 'generating' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      );
    const client = new ConvoLabDraftApiClient({
      baseUrl: 'https://convo-lab.com',
      cookieHeader: 'token=session-token',
      fetchFn: fetchMock,
    });

    const result = await client.queueAudioRecognitionDraft(
      '今日は暑いです。',
      '今日[きょう]は暑[あつ]いです。'
    );

    expect(result.httpStatus).toBe(201);
    expect(result.draft.id).toBe('draft-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://convo-lab.com/api/auth/csrf');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Cookie: 'token=session-token',
      Origin: 'https://convo-lab.com',
    });

    const postInit = fetchMock.mock.calls[1]?.[1];
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://convo-lab.com/api/study/card-drafts'
    );
    expect(postInit?.headers).toMatchObject({
      Cookie: 'token=session-token; XSRF-TOKEN=csrf%20token',
      Origin: 'https://convo-lab.com',
      'X-CSRF-Token': 'csrf token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(postInit?.body))).toEqual({
      creationKind: 'audio-recognition',
      cardType: 'recognition',
      prompt: {},
      answer: {
        expression: '今日は暑いです。',
        expressionReading: '今日[きょう]は暑[あつ]いです。',
      },
      imagePlacement: 'none',
      imagePrompt: null,
    });
  });
});
