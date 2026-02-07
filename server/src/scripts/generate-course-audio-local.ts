/* eslint-disable import/no-named-as-default-member, no-console */
import { execSync, execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';

import { prisma } from '../db/client.js';
import { processBatches } from '../services/batchedTTSClient.js';
import type { LessonScriptUnit } from '../services/lessonScriptGenerator.js';

dotenv.config();

try {
  const ffprobePath = execSync('which ffprobe').toString().trim();
  const ffmpegPath = execSync('which ffmpeg').toString().trim();
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
  console.warn('Could not find ffmpeg/ffprobe in PATH');
}

type ScriptSource = {
  scriptJson: LessonScriptUnit[];
  targetLanguage: string;
  nativeLanguage: string;
  title?: string;
};

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function resolveOutDir(outDir: string | undefined, courseId?: string): string {
  if (outDir) return path.resolve(outDir);
  const suffix = courseId || 'manual';
  return path.join(os.tmpdir(), 'convolab-audio-local', suffix);
}

function parseUnitRange(range: string | undefined): { start: number; end: number } | null {
  if (!range) return null;
  const [startRaw, endRaw] = range.split(':');
  const start = Number.parseInt(startRaw, 10);
  const end = Number.parseInt(endRaw, 10);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  return { start, end };
}

async function parseJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function loadCourseScript(courseId: string): Promise<ScriptSource> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      scriptJson: true,
      targetLanguage: true,
      nativeLanguage: true,
    },
  });

  if (!course) {
    throw new Error(`Course not found: ${courseId}`);
  }

  if (!course.scriptJson) {
    throw new Error(`Course missing scriptJson: ${courseId}`);
  }

  const scriptJson =
    typeof course.scriptJson === 'string'
      ? (JSON.parse(course.scriptJson) as LessonScriptUnit[])
      : (course.scriptJson as LessonScriptUnit[]);

  return {
    scriptJson,
    targetLanguage: course.targetLanguage || 'ja',
    nativeLanguage: course.nativeLanguage || 'en',
    title: course.title || undefined,
  };
}

async function concatenateAudioFiles(audioFiles: string[], outputFile: string, tempDir: string) {
  if (audioFiles.length === 0) {
    throw new Error('No audio files to concatenate');
  }

  if (audioFiles.length === 1) {
    await fs.copyFile(audioFiles[0], outputFile);
    return;
  }

  const listFile = path.join(tempDir, 'concat-list.txt');
  const listContent = audioFiles.map((file) => `file '${file}'`).join('\n');
  await fs.writeFile(listFile, listContent);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('ffmpeg concatenation timed out after 60 seconds'));
    }, 60000);

    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outputFile)
      .on('end', () => {
        clearTimeout(timeout);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      })
      .run();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const courseId = parseArgValue(args, 'course-id');
  const scriptJsonPath = parseArgValue(args, 'script-json');
  const outDir = resolveOutDir(parseArgValue(args, 'out-dir'), courseId);
  const filterVoice = parseArgValue(args, 'filter-voice');
  const unitRange = parseUnitRange(parseArgValue(args, 'unit-range'));
  const targetLanguageArg = parseArgValue(args, 'target-language');
  const nativeLanguageArg = parseArgValue(args, 'native-language');

  let source: ScriptSource | null = null;

  if (courseId) {
    source = await loadCourseScript(courseId);
  }

  if (!source) {
    if (!scriptJsonPath) {
      throw new Error('Provide --course-id or --script-json.');
    }
    if (!targetLanguageArg || !nativeLanguageArg) {
      throw new Error('Provide --target-language and --native-language when using --script-json.');
    }
    const scriptJson = await parseJsonFile<LessonScriptUnit[]>(scriptJsonPath);
    source = {
      scriptJson,
      targetLanguage: targetLanguageArg,
      nativeLanguage: nativeLanguageArg,
    };
  }

  let units = [...source.scriptJson];
  if (unitRange) {
    units = units.filter((_, index) => index >= unitRange.start && index <= unitRange.end);
  }
  if (filterVoice) {
    units = units.filter((unit) => {
      if (unit.type === 'pause' || unit.type === 'marker') return true;
      return 'voiceId' in unit && unit.voiceId === filterVoice;
    });
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'script.json'), JSON.stringify(units, null, 2));

  const voiceIds = Array.from(
    new Set(
      units
        .filter((unit) => unit.type === 'L2' || unit.type === 'narration_L1')
        .map((unit) => unit.voiceId)
        .filter(Boolean)
    )
  );
  await fs.writeFile(path.join(outDir, 'voices.json'), JSON.stringify(voiceIds, null, 2));

  const execFileAsync = promisify(execFile);
  const tempDir = path.join(os.tmpdir(), `audio-local-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const generateSilenceLocal = async (seconds: number): Promise<Buffer> => {
      const silencePath = path.join(
        tempDir,
        `silence-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`
      );
      await execFileAsync('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=44100:cl=stereo',
        '-ac',
        '2',
        '-ar',
        '44100',
        '-t',
        String(seconds),
        '-c:a',
        'libmp3lame',
        '-q:a',
        '6',
        silencePath,
      ]);
      const buffer = await fs.readFile(silencePath);
      await fs.unlink(silencePath).catch(() => {});
      return buffer;
    };

    const batchResult = await processBatches(units, {
      targetLanguage: source.targetLanguage,
      nativeLanguage: source.nativeLanguage,
      tempDir,
      generateSilence: generateSilenceLocal,
      onProgress: (current, total) => {
        console.log(`[Local Audio] Batch ${current}/${total}`);
      },
    });

    const audioSegmentFiles: string[] = [];

    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i];
      if (unit.type === 'marker') continue;

      const buffer =
        unit.type === 'pause' ? batchResult.pauseSegments.get(i) : batchResult.segments.get(i);
      if (!buffer || buffer.length === 0) {
        console.warn(`[Local Audio] Missing segment for unit ${i}`);
        continue;
      }

      const segmentPath = path.join(tempDir, `segment-${i}.mp3`);
      await fs.writeFile(segmentPath, buffer);
      audioSegmentFiles.push(segmentPath);
    }

    const outputPath = path.join(outDir, 'audio.mp3');
    await concatenateAudioFiles(audioSegmentFiles, outputPath, tempDir);

    await fs.writeFile(
      path.join(outDir, 'timing.json'),
      JSON.stringify(batchResult.timingData, null, 2)
    );

    console.log(`Local audio written to ${outputPath}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
