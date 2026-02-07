/* eslint-disable import/no-named-as-default-member, no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import dotenv from 'dotenv';

import { prisma } from '../db/client.js';
import type { LessonScriptUnit } from '../services/lessonScriptGenerator.js';

dotenv.config();

const execFileAsync = promisify(execFile);

const SAMPLE_RATE = 44100;
const WINDOW_MS = 50;
const MIN_RMS_THRESHOLD = 0.005;
const RMS_RELATIVE_THRESHOLD = 0.2;
const EARLY_CUT_RATIO = 0.5;
const LATE_CUT_RATIO = 0.8;
const BOUNDARY_JUMP_THRESHOLD = 0.1;

type TimingEntry = { unitIndex: number; startTime: number; endTime: number };

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

function resolveOutDir(outDir: string | undefined, courseId?: string): string {
  if (outDir) return path.resolve(outDir);
  const suffix = courseId || 'manual';
  return path.join(os.tmpdir(), 'convolab-audio-analysis', suffix);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to download audio (${response.status}): ${body}`);
  }
  const data = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(data));
}

async function convertMp3ToPcm(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-f',
    's16le',
    '-ac',
    '1',
    '-ar',
    String(SAMPLE_RATE),
    outputPath,
  ]);
}

async function parseJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function normalizeJsonValue<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function rms(samples: Int16Array, start: number, length: number): number {
  if (length <= 0) return 0;
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  const safeStart = Math.max(0, Math.min(start, samples.length - 1));
  const total = Math.max(0, end - safeStart);
  if (total === 0) return 0;
  for (let i = safeStart; i < safeStart + total; i += 1) {
    const value = samples[i] / 32768;
    sum += value * value;
  }
  return Math.sqrt(sum / total);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function formatLabelTime(ms: number): string {
  return (ms / 1000).toFixed(3);
}

async function loadCourseData(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      audioUrl: true,
      scriptJson: true,
      timingData: true,
    },
  });

  if (!course) {
    throw new Error(`Course not found: ${courseId}`);
  }

  if (!course.audioUrl || !course.scriptJson || !course.timingData) {
    throw new Error(`Course missing audioUrl/scriptJson/timingData: ${courseId}`);
  }

  return {
    id: course.id,
    title: course.title || '',
    audioUrl: course.audioUrl,
    scriptJson: normalizeJsonValue<LessonScriptUnit[]>(course.scriptJson),
    timingData: normalizeJsonValue<TimingEntry[]>(course.timingData),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const courseId = parseArgValue(args, 'course-id');
  const audioUrlArg = parseArgValue(args, 'audio-url');
  const audioPathArg = parseArgValue(args, 'audio-path');
  const scriptJsonPath = parseArgValue(args, 'script-json');
  const timingJsonPath = parseArgValue(args, 'timing-json');
  const outDir = resolveOutDir(parseArgValue(args, 'out-dir'), courseId);

  await ensureDir(outDir);

  let audioUrl = audioUrlArg;
  let scriptJson: LessonScriptUnit[] | undefined;
  let timingData: TimingEntry[] | undefined;

  if (courseId) {
    const course = await loadCourseData(courseId);
    audioUrl = audioUrl || course.audioUrl;
    scriptJson = scriptJson || course.scriptJson;
    timingData = timingData || course.timingData;
    await fs.writeFile(
      path.join(outDir, 'script.json'),
      JSON.stringify(course.scriptJson, null, 2)
    );
    await fs.writeFile(
      path.join(outDir, 'timing.json'),
      JSON.stringify(course.timingData, null, 2)
    );
  }

  if (!audioUrl && !audioPathArg) {
    if (!audioUrlArg) {
      throw new Error('Missing --audio-url (or provide --course-id with audioUrl in DB).');
    }
  }

  if (!scriptJson) {
    if (!scriptJsonPath) {
      throw new Error('Missing --script-json (or provide --course-id with scriptJson in DB).');
    }
    scriptJson = await parseJsonFile<LessonScriptUnit[]>(scriptJsonPath);
  }

  if (!timingData) {
    if (!timingJsonPath) {
      throw new Error('Missing --timing-json (or provide --course-id with timingData in DB).');
    }
    timingData = await parseJsonFile<TimingEntry[]>(timingJsonPath);
  }

  const audioPath = path.join(outDir, 'audio.mp3');
  const pcmPath = path.join(outDir, 'audio.pcm');

  if (audioPathArg) {
    const resolvedPath = path.resolve(audioPathArg);
    if (resolvedPath !== audioPath) {
      await fs.copyFile(resolvedPath, audioPath);
    }
  } else if (audioUrl) {
    console.log(`Downloading audio: ${audioUrl}`);
    await downloadToFile(audioUrl, audioPath);
  }

  console.log('Converting MP3 to PCM...');
  await convertMp3ToPcm(audioPath, pcmPath);

  console.log('Loading PCM data...');
  const pcmBuffer = await fs.readFile(pcmPath);
  const samples = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    Math.floor(pcmBuffer.byteLength / 2)
  );

  const timingEntries = timingData
    .filter((entry) => typeof entry.unitIndex === 'number')
    .map((entry) => ({
      unitIndex: entry.unitIndex,
      startTime: Number(entry.startTime),
      endTime: Number(entry.endTime),
    }))
    .sort((a, b) => a.unitIndex - b.unitIndex);

  const timingByIndex = new Map<number, TimingEntry>();
  const nextTimingByIndex = new Map<number, TimingEntry>();
  timingEntries.forEach((entry, index) => {
    timingByIndex.set(entry.unitIndex, entry);
    if (index < timingEntries.length - 1) {
      nextTimingByIndex.set(entry.unitIndex, timingEntries[index + 1]);
    }
  });

  const segmentRmsByIndex = new Map<number, number>();
  const l2SegmentRms: number[] = [];

  for (const entry of timingEntries) {
    const startSample = Math.round((entry.startTime / 1000) * SAMPLE_RATE);
    const endSample = Math.round((entry.endTime / 1000) * SAMPLE_RATE);
    const segmentLength = Math.max(0, endSample - startSample);
    const segmentRms = rms(samples, startSample, segmentLength);
    segmentRmsByIndex.set(entry.unitIndex, segmentRms);

    const unit = scriptJson[entry.unitIndex] as LessonScriptUnit | undefined;
    if (unit && unit.type === 'L2' && segmentLength > 0) {
      l2SegmentRms.push(segmentRms);
    }
  }

  const medianSegmentRms = median(l2SegmentRms);
  const energyThreshold = Math.max(MIN_RMS_THRESHOLD, medianSegmentRms * RMS_RELATIVE_THRESHOLD);
  const windowSamples = Math.round((WINDOW_MS / 1000) * SAMPLE_RATE);

  const results: Array<Record<string, unknown>> = [];
  const summary = new Map<
    string,
    {
      total: number;
      cutEarly: number;
      cutLate: number;
      rmsEndSum: number;
      rmsNextSum: number;
    }
  >();

  for (let i = 0; i < scriptJson.length; i += 1) {
    const unit = scriptJson[i];
    if (!unit || unit.type !== 'L2') continue;

    const timing = timingByIndex.get(i);
    const nextTiming = nextTimingByIndex.get(i);

    if (!timing || !nextTiming) continue;

    const startSample = Math.round((timing.startTime / 1000) * SAMPLE_RATE);
    const endSample = Math.round((timing.endTime / 1000) * SAMPLE_RATE);
    const nextStartSample = Math.round((nextTiming.startTime / 1000) * SAMPLE_RATE);

    const endWindowStart = Math.max(startSample, endSample - windowSamples);
    const endWindowLength = Math.max(0, endSample - endWindowStart);
    const nextWindowLength = Math.min(windowSamples, samples.length - nextStartSample);

    const rmsEnd = rms(samples, endWindowStart, endWindowLength);
    const rmsNextStart = rms(samples, nextStartSample, nextWindowLength);

    const lastSample = endSample > 0 && endSample <= samples.length ? samples[endSample - 1] : 0;
    const firstNextSample =
      nextStartSample >= 0 && nextStartSample < samples.length ? samples[nextStartSample] : 0;
    const boundaryJump = Math.abs(lastSample - firstNextSample) / 32768;

    const cutEarly = rmsEnd > energyThreshold && rmsNextStart < energyThreshold * EARLY_CUT_RATIO;
    const cutLate =
      rmsEnd > energyThreshold &&
      rmsNextStart > energyThreshold * LATE_CUT_RATIO &&
      boundaryJump > BOUNDARY_JUMP_THRESHOLD;

    results.push({
      unitIndex: i,
      voiceId: unit.voiceId,
      startTimeMs: timing.startTime,
      endTimeMs: timing.endTime,
      nextStartTimeMs: nextTiming.startTime,
      rmsEnd,
      rmsNextStart,
      boundaryJump,
      cutEarly,
      cutLate,
      textPreview: unit.text.slice(0, 48),
    });

    const summaryEntry = summary.get(unit.voiceId) || {
      total: 0,
      cutEarly: 0,
      cutLate: 0,
      rmsEndSum: 0,
      rmsNextSum: 0,
    };
    summaryEntry.total += 1;
    summaryEntry.cutEarly += cutEarly ? 1 : 0;
    summaryEntry.cutLate += cutLate ? 1 : 0;
    summaryEntry.rmsEndSum += rmsEnd;
    summaryEntry.rmsNextSum += rmsNextStart;
    summary.set(unit.voiceId, summaryEntry);
  }

  const summaryReport = Array.from(summary.entries()).map(([voiceId, entry]) => ({
    voiceId,
    total: entry.total,
    cutEarly: entry.cutEarly,
    cutLate: entry.cutLate,
    avgRmsEnd: entry.total ? entry.rmsEndSum / entry.total : 0,
    avgRmsNextStart: entry.total ? entry.rmsNextSum / entry.total : 0,
  }));

  const report = {
    meta: {
      sampleRate: SAMPLE_RATE,
      windowMs: WINDOW_MS,
      medianSegmentRms,
      energyThreshold,
    },
    summary: summaryReport,
    results,
  };

  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const labels: string[] = [];
  for (const result of results) {
    const cutEarly = Boolean(result.cutEarly);
    const cutLate = Boolean(result.cutLate);
    if (!cutEarly && !cutLate) continue;

    const endTimeMs = result.endTimeMs as number;
    const labelTime = formatLabelTime(endTimeMs);
    const voiceId = result.voiceId as string;
    const unitIndex = result.unitIndex as number;
    const labelTags = [cutEarly ? 'cut_early' : null, cutLate ? 'cut_late' : null]
      .filter(Boolean)
      .join('+');
    labels.push(`${labelTime} ${labelTime} "${labelTags} unit_${unitIndex} voice=${voiceId}"`);
  }

  await fs.writeFile(path.join(outDir, 'labels.txt'), labels.join('\n'));

  console.log(`Report written to ${path.join(outDir, 'report.json')}`);
  console.log(`Labels written to ${path.join(outDir, 'labels.txt')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
