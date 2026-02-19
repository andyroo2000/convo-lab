/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  getLanguageCodeFromVoiceId,
  getProviderFromVoiceId,
} from '@languageflow/shared/src/voiceSelection.js';
import { config as loadEnv } from 'dotenv';

import {
  resolveFishAudioVoiceId,
  synthesizeFishAudioSpeech,
} from '../services/ttsProviders/FishAudioTTSProvider.js';
import { GoogleTTSProvider } from '../services/ttsProviders/GoogleTTSProvider.js';

loadEnv();

const execFileAsync = promisify(execFile);
const DEFAULT_VOICE_ID = 'ja-JP-Neural2-C';

type Provider = 'fishaudio' | 'google' | 'polly' | 'azure';

type CounterPhraseCatalogEntry = {
  id: string;
  counterId: string;
  objectId: string;
  quantity: number;
  text: string;
  kanaText: string;
  relativePath: string;
};

type GenerationResult = {
  id: string;
  status: 'generated' | 'failed' | 'skipped';
  relativePath: string;
  text: string;
  kanaText: string;
  durationSeconds?: number;
  reason?: string;
};

type Manifest = {
  version: number;
  generatedAt: string;
  voiceId: string;
  voiceDescription: string;
  provider: Provider;
  outputDir: string;
  totals: {
    totalEntries: number;
    generated: number;
    failed: number;
    skipped: number;
  };
  entries: CounterPhraseCatalogEntry[];
  results: GenerationResult[];
};

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  if (stream instanceof Blob) return Buffer.from(await stream.arrayBuffer());

  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (!done && result.value) chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  }

  const chunks: Buffer[] = [];
  const nodeStream = stream as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
    );
    nodeStream.on('end', resolve);
    nodeStream.on('error', reject);
  });
  return Buffer.concat(chunks);
}

async function synthesizePollySpeech(text: string, voiceId: string): Promise<Buffer> {
  const polly = new Polly({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  const response = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voiceId as VoiceId,
      Engine: 'neural',
      TextType: 'text',
      OutputFormat: 'mp3',
    })
  );

  return streamToBuffer(response.AudioStream);
}

async function getMp3DurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);

  const parsed = Number.parseFloat(stdout.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveVoiceDescription(voiceId: string): string {
  const voices = TTS_VOICES.ja.voices as ReadonlyArray<{ id: string; description: string }>;
  return voices.find((voice) => voice.id === voiceId)?.description || voiceId;
}

async function synthesizeByProvider(
  provider: Provider,
  voiceId: string,
  languageCode: string,
  text: string
): Promise<Buffer> {
  if (provider === 'fishaudio') {
    return synthesizeFishAudioSpeech({
      referenceId: resolveFishAudioVoiceId(voiceId),
      text,
      speed: 1.0,
    });
  }

  if (provider === 'google') {
    const google = new GoogleTTSProvider();
    return google.synthesizeSpeech({
      text,
      voiceId,
      languageCode,
      speed: 1.0,
    });
  }

  if (provider === 'polly') {
    return synthesizePollySpeech(text, voiceId);
  }

  throw new Error('Azure provider is not wired in this repository.');
}

async function ensureDirFor(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function loadCounterPhraseCatalog(): Promise<CounterPhraseCatalogEntry[]> {
  const moduleUrl = new URL(
    '../../../client/src/features/tools/japaneseCounters/logic/counterPractice.ts',
    import.meta.url
  );
  const mod = (await import(moduleUrl.href)) as {
    buildCounterPhraseCatalog?: () => CounterPhraseCatalogEntry[];
  };

  if (typeof mod.buildCounterPhraseCatalog !== 'function') {
    throw new Error('buildCounterPhraseCatalog export was not found in counterPractice.ts');
  }

  return mod.buildCounterPhraseCatalog();
}

function buildQcHtml(
  entries: CounterPhraseCatalogEntry[],
  voiceId: string,
  voiceDescription: string
): string {
  const escapedEntries = JSON.stringify(entries);
  const title = `${voiceDescription} (${voiceId})`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Japanese Counter Phrase QC</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f8f8f8; color: #1f2d3d; }
    h1 { margin: 0 0 6px; }
    .meta { margin-bottom: 16px; color: #3d4f63; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    button { border: 1px solid #27517e; background: #2ea9cd; color: white; padding: 6px 10px; cursor: pointer; border-radius: 3px; font-weight: 700; }
    .secondary { background: #f0f2f5; color: #1f2d3d; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border: 1px solid #d7dde5; padding: 6px; vertical-align: middle; }
    th { background: #eff4fb; text-align: left; }
    input[type="text"] { width: 100%; box-sizing: border-box; }
    .pill { padding: 2px 6px; border-radius: 999px; font-size: 12px; background: #e4ebf2; color: #1e3c5e; }
    .row-defective { background: #fff4f4; }
    audio { width: 240px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Japanese Counter Phrase QC</h1>
  <div class="meta">${title}</div>
  <div class="controls">
    <button id="exportDefects">Export Defects JSON</button>
    <button id="exportCsv">Export QC CSV</button>
    <button id="clear" class="secondary">Clear Saved QC State</button>
    <label class="secondary" style="display:flex;align-items:center;padding:6px 10px;border:1px solid #b8c3d1;border-radius:3px;">
      <input id="showDefectiveOnly" type="checkbox" style="margin-right:6px;" />
      Show defective only
    </label>
  </div>
  <table id="qcTable">
    <thead>
      <tr>
        <th style="width: 240px;">ID</th>
        <th style="width: 80px;">Counter</th>
        <th style="width: 120px;">Object</th>
        <th style="width: 70px;">Qty</th>
        <th>Text</th>
        <th>Kana</th>
        <th style="width: 270px;">Audio</th>
        <th style="width: 120px;">Status</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <script>
    const voiceId = ${JSON.stringify(voiceId)};
    const storageKey = 'convolab-counter-qc-' + voiceId;
    const entries = ${escapedEntries};

    const loadState = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        return JSON.parse(raw);
      } catch (_) {
        return {};
      }
    };

    const saveState = (state) => {
      localStorage.setItem(storageKey, JSON.stringify(state));
    };

    const state = loadState();
    const tbody = document.querySelector('#qcTable tbody');
    const showDefectiveOnly = document.getElementById('showDefectiveOnly');

    const render = () => {
      const filterDefective = !!showDefectiveOnly.checked;
      tbody.innerHTML = '';

      entries.forEach((entry) => {
        const rowState = state[entry.id] || { status: 'pending', notes: '' };
        if (filterDefective && rowState.status !== 'defective') {
          return;
        }

        const tr = document.createElement('tr');
        if (rowState.status === 'defective') tr.classList.add('row-defective');

        const idTd = document.createElement('td');
        idTd.innerHTML = '<span class="pill">' + entry.id + '</span><div class="mono">' + entry.relativePath + '</div>';
        tr.appendChild(idTd);

        const counterTd = document.createElement('td');
        counterTd.textContent = entry.counterId;
        tr.appendChild(counterTd);

        const objectTd = document.createElement('td');
        objectTd.textContent = entry.objectId;
        tr.appendChild(objectTd);

        const qtyTd = document.createElement('td');
        qtyTd.textContent = String(entry.quantity);
        tr.appendChild(qtyTd);

        const textTd = document.createElement('td');
        textTd.textContent = entry.text;
        tr.appendChild(textTd);

        const kanaTd = document.createElement('td');
        kanaTd.textContent = entry.kanaText;
        tr.appendChild(kanaTd);

        const audioTd = document.createElement('td');
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = '../' + entry.relativePath;
        audioTd.appendChild(audio);
        tr.appendChild(audioTd);

        const statusTd = document.createElement('td');
        const select = document.createElement('select');
        ['pending', 'pass', 'defective'].forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (rowState.status === opt) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', () => {
          state[entry.id] = { ...(state[entry.id] || {}), status: select.value };
          saveState(state);
          render();
        });
        statusTd.appendChild(select);
        tr.appendChild(statusTd);

        const notesTd = document.createElement('td');
        const notes = document.createElement('input');
        notes.type = 'text';
        notes.value = rowState.notes || '';
        notes.placeholder = 'notes';
        notes.addEventListener('change', () => {
          state[entry.id] = { ...(state[entry.id] || {}), notes: notes.value || '' };
          saveState(state);
        });
        notesTd.appendChild(notes);
        tr.appendChild(notesTd);

        tbody.appendChild(tr);
      });
    };

    const toDefectsPayload = () => {
      const defectiveIds = entries
        .filter((entry) => (state[entry.id]?.status || 'pending') === 'defective')
        .map((entry) => entry.id);
      return {
        voiceId,
        defectiveIds,
        exportedAt: new Date().toISOString(),
      };
    };

    const download = (filename, text, type) => {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    document.getElementById('exportDefects').addEventListener('click', () => {
      const payload = toDefectsPayload();
      download('defects.json', JSON.stringify(payload, null, 2), 'application/json');
    });

    document.getElementById('exportCsv').addEventListener('click', () => {
      const header = 'id,counterId,objectId,quantity,text,kanaText,relativePath,status,notes';
      const lines = entries.map((entry) => {
        const rowState = state[entry.id] || { status: 'pending', notes: '' };
        const safe = (v) => '"' + String(v || '').replaceAll('"', '""') + '"';
        return [
          entry.id,
          entry.counterId,
          entry.objectId,
          entry.quantity,
          entry.text,
          entry.kanaText,
          entry.relativePath,
          rowState.status,
          rowState.notes || '',
        ].map(safe).join(',');
      });
      download('qc.csv', [header, ...lines].join('\\n'), 'text/csv');
    });

    document.getElementById('clear').addEventListener('click', () => {
      if (confirm('Clear saved QC state for this voice?')) {
        localStorage.removeItem(storageKey);
        Object.keys(state).forEach((k) => delete state[k]);
        render();
      }
    });

    showDefectiveOnly.addEventListener('change', render);
    render();
  </script>
</body>
</html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const voiceId = parseArgValue(args, 'voice-id') || DEFAULT_VOICE_ID;
  const defectsJsonPath = parseArgValue(args, 'defects-json');
  const outDirArg = parseArgValue(args, 'out-dir');

  const provider = getProviderFromVoiceId(voiceId) as Provider;
  const languageCode = getLanguageCodeFromVoiceId(voiceId);
  const voiceDescription = resolveVoiceDescription(voiceId);
  const voiceSlug = sanitizeFilePart(voiceDescription) || sanitizeFilePart(voiceId) || 'voice';
  const outDir = outDirArg || `/Users/andrewlandry/Desktop/counter-phrases-qc/${voiceSlug}`;

  if (provider === 'azure') {
    throw new Error('Azure provider is not wired in this repository yet.');
  }

  let defectiveSet: Set<string> | null = null;
  if (defectsJsonPath) {
    const raw = await fs.readFile(defectsJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { defectiveIds?: string[] };
    defectiveSet = new Set(parsed.defectiveIds || []);
    if (defectiveSet.size === 0) {
      throw new Error(`No defectiveIds found in ${defectsJsonPath}`);
    }
  }

  const entries = await loadCounterPhraseCatalog();
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'qc', 'defective'), { recursive: true });

  const results: GenerationResult[] = [];
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (defectiveSet && !defectiveSet.has(entry.id)) {
      results.push({
        id: entry.id,
        status: 'skipped',
        relativePath: entry.relativePath,
        text: entry.text,
        kanaText: entry.kanaText,
      });
      skipped += 1;
      continue;
    }

    const absolutePath = path.join(outDir, entry.relativePath);
    await ensureDirFor(absolutePath);

    try {
      if (defectiveSet) {
        const exists = await fs
          .stat(absolutePath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          const archivedName = `${entry.id}--${Date.now()}.mp3`;
          await fs.copyFile(absolutePath, path.join(outDir, 'qc', 'defective', archivedName));
        }
      }

      const synthesisText = entry.kanaText.trim();
      const audio = await synthesizeByProvider(provider, voiceId, languageCode, synthesisText);
      await fs.writeFile(absolutePath, audio);
      const durationSeconds = await getMp3DurationSeconds(absolutePath);

      results.push({
        id: entry.id,
        status: 'generated',
        relativePath: entry.relativePath,
        text: entry.text,
        kanaText: entry.kanaText,
        durationSeconds,
      });
      generated += 1;

      console.log(`[Counter Phrases] OK ${entry.id} -> ${entry.relativePath}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        id: entry.id,
        status: 'failed',
        relativePath: entry.relativePath,
        text: entry.text,
        kanaText: entry.kanaText,
        reason,
      });
      failed += 1;
      console.log(`[Counter Phrases] FAIL ${entry.id} -> ${reason}`);
    }
  }

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    voiceId,
    voiceDescription,
    provider,
    outputDir: outDir,
    totals: {
      totalEntries: entries.length,
      generated,
      failed,
      skipped,
    },
    entries,
    results,
  };

  const qcIndex = buildQcHtml(entries, voiceId, voiceDescription);

  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(outDir, 'qc', 'index.html'), qcIndex);
  await fs.writeFile(
    path.join(outDir, 'qc', 'README.md'),
    [
      '# Japanese Counter Phrase QC',
      '',
      `Voice: ${voiceDescription} (${voiceId})`,
      '',
      '1. Open `index.html` in your browser.',
      '2. Play clips and mark `pass` or `defective`.',
      '3. Click **Export Defects JSON**.',
      '4. Re-generate only defective clips with:',
      '',
      '```bash',
      'cd /path/to/convo-lab/server',
      `npm run smoke:jp-counter-phrases-qc -- --voice-id "${voiceId}" --out-dir "${outDir}" --defects-json "/path/to/defects.json"`,
      '```',
      '',
      '5. Copy the generated `phrase/` folder into:',
      '',
      '```text',
      'client/public/tools-audio/japanese-counters/google-kento-professional/phrase/',
      '```',
      '',
      'Old defective versions are copied into `qc/defective/` before overwrite.',
    ].join('\n')
  );

  console.log('\nJapanese counter phrase generation complete.');
  console.log(`Output: ${outDir}`);
  console.log(`QC page: ${path.join(outDir, 'qc', 'index.html')}`);
  console.log(
    `Totals -> generated: ${generated}, failed: ${failed}, skipped: ${skipped}, total: ${entries.length}`
  );
}

main().catch((error) => {
  console.error('Japanese counter phrase generation failed:', error);
  process.exitCode = 1;
});
