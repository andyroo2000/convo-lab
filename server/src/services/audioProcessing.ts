/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Configuration (env-overridable with sensible defaults) ───

/** Target loudness in LUFS for per-segment normalization */
const LOUDNORM_TARGET_IL = Number(process.env.AUDIO_LOUDNORM_TARGET_IL || -16);
/** Loudness range target */
const LOUDNORM_TARGET_LRA = Number(process.env.AUDIO_LOUDNORM_TARGET_LRA || 11);
/** True peak ceiling (dB) */
const LOUDNORM_TARGET_TP = Number(process.env.AUDIO_LOUDNORM_TARGET_TP || -1.5);

/** Compressor threshold in dB */
const COMP_THRESHOLD_DB = Number(process.env.AUDIO_COMP_THRESHOLD_DB || -20);
/** Compressor ratio */
const COMP_RATIO = Number(process.env.AUDIO_COMP_RATIO || 2);
/** Compressor attack in ms */
const COMP_ATTACK_MS = Number(process.env.AUDIO_COMP_ATTACK_MS || 20);
/** Compressor release in ms */
const COMP_RELEASE_MS = Number(process.env.AUDIO_COMP_RELEASE_MS || 250);
/** Compressor makeup gain in dB */
const COMP_MAKEUP_DB = Number(process.env.AUDIO_COMP_MAKEUP_DB || 2);

/** High-pass filter cutoff frequency in Hz */
const HIGHPASS_FREQ_HZ = Number(process.env.AUDIO_HIGHPASS_FREQ_HZ || 80);

/** Presence boost center frequency in Hz */
const PRESENCE_FREQ_HZ = Number(process.env.AUDIO_PRESENCE_FREQ_HZ || 3000);
/** Presence boost gain in dB */
const PRESENCE_GAIN_DB = Number(process.env.AUDIO_PRESENCE_GAIN_DB || 2);
/** Presence boost Q factor */
const PRESENCE_Q = Number(process.env.AUDIO_PRESENCE_Q || 1.0);

/** Master switch to enable/disable audio sweetening */
const AUDIO_SWEETENING_ENABLED = process.env.AUDIO_SWEETENING_ENABLED !== '0';
/** Enable per-segment loudness normalization */
const AUDIO_LOUDNORM_ENABLED = process.env.AUDIO_LOUDNORM_ENABLED !== '0';

function buildLoudnormFilter(): string {
  return `loudnorm=I=${LOUDNORM_TARGET_IL}:LRA=${LOUDNORM_TARGET_LRA}:TP=${LOUDNORM_TARGET_TP}:print_format=none`;
}

function buildSweeteningFilter(): string {
  return [
    `highpass=f=${HIGHPASS_FREQ_HZ}`,
    `acompressor=threshold=${COMP_THRESHOLD_DB}dB:ratio=${COMP_RATIO}:attack=${COMP_ATTACK_MS}:release=${COMP_RELEASE_MS}:makeup=${COMP_MAKEUP_DB}dB`,
    `equalizer=f=${PRESENCE_FREQ_HZ}:t=q:w=${PRESENCE_Q}:g=${PRESENCE_GAIN_DB}`,
    buildLoudnormFilter(),
  ].join(',');
}

function makeTempDir(prefix: string): string {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  return path.join(os.tmpdir(), `${prefix}-${uniqueId}`);
}

/**
 * Normalize a single audio segment to a consistent loudness level (EBU R128).
 * Applied per-segment before concatenation so all voices match.
 */
export async function normalizeSegmentLoudness(inputBuffer: Buffer): Promise<Buffer> {
  if (!AUDIO_LOUDNORM_ENABLED || !inputBuffer || inputBuffer.length === 0) {
    return inputBuffer;
  }

  const tempDir = makeTempDir('audio-norm');
  await fs.mkdir(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'input.mp3');
  const outputPath = path.join(tempDir, 'output.mp3');

  try {
    await fs.writeFile(inputPath, inputBuffer);

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-af', buildLoudnormFilter(),
      '-ar', '44100',
      '-ac', '2',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outputPath,
    ]);

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Apply the full sweetening chain to an audio file.
 * Includes highpass, compression, presence EQ, and loudness normalization.
 */
export async function applySweeteningChain(
  inputPath: string,
  outputPath: string
): Promise<void> {
  if (!AUDIO_SWEETENING_ENABLED) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-af', buildSweeteningFilter(),
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outputPath,
  ]);
}

/**
 * Buffer-based convenience wrapper for applySweeteningChain.
 * Used by the episode pipeline which works with buffers.
 */
export async function applySweeteningChainToBuffer(inputBuffer: Buffer): Promise<Buffer> {
  if (!AUDIO_SWEETENING_ENABLED) {
    return inputBuffer;
  }

  const tempDir = makeTempDir('audio-sweeten');
  await fs.mkdir(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'input.mp3');
  const outputPath = path.join(tempDir, 'output.mp3');

  try {
    await fs.writeFile(inputPath, inputBuffer);
    await applySweeteningChain(inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
