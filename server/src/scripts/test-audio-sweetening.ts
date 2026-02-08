/* eslint-disable no-console */
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import dotenv from 'dotenv';

import { prisma } from '../db/client.js';

dotenv.config();

const execFileAsync = promisify(execFile);

// ─── Sweetening parameters (tweak these and re-run) ───

const LOUDNORM_TARGET_IL = -16; // Integrated loudness (LUFS)
const LOUDNORM_TARGET_LRA = 11; // Loudness range
const LOUDNORM_TARGET_TP = -1.5; // True peak ceiling (dB)

const COMP_THRESHOLD_DB = -20;
const COMP_RATIO = 2;
const COMP_ATTACK_MS = 20;
const COMP_RELEASE_MS = 250;
const COMP_MAKEUP_DB = 2;

const HIGHPASS_FREQ_HZ = 80;

const PRESENCE_FREQ_HZ = 3000;
const PRESENCE_GAIN_DB = 2;
const PRESENCE_Q = 1.0;

// ─── Helpers ───

function parseArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function downloadToFile(url: string, outputPath: string): Promise<void> {
  console.log(`Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to download audio (${response.status}): ${body}`);
  }
  const data = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(data));
  const stats = await fs.stat(outputPath);
  console.log(`Downloaded ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

async function measureLoudness(
  filePath: string
): Promise<{ input_i: string; input_tp: string; input_lra: string; input_thresh: string }> {
  // Use loudnorm in print_format=json mode (first pass) to analyze loudness
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-i',
    filePath,
    '-af',
    'loudnorm=print_format=json',
    '-f',
    'null',
    '-',
  ]);

  // The JSON block is in stderr, extract it
  const jsonMatch = stderr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse loudnorm output');
  }
  return JSON.parse(jsonMatch[0]);
}

// Each stage builds incrementally on the previous one
const STAGES = [
  {
    name: '1-original',
    label: 'Original (no processing)',
    filter: null,
  },
  {
    name: '2-normalized',
    label: 'Loudness normalization only',
    filter: `loudnorm=I=${LOUDNORM_TARGET_IL}:LRA=${LOUDNORM_TARGET_LRA}:TP=${LOUDNORM_TARGET_TP}:print_format=none`,
  },
  {
    name: '3-norm-compressed',
    label: 'Normalization + compression',
    filter: [
      `acompressor=threshold=${COMP_THRESHOLD_DB}dB:ratio=${COMP_RATIO}:attack=${COMP_ATTACK_MS}:release=${COMP_RELEASE_MS}:makeup=${COMP_MAKEUP_DB}dB`,
      `loudnorm=I=${LOUDNORM_TARGET_IL}:LRA=${LOUDNORM_TARGET_LRA}:TP=${LOUDNORM_TARGET_TP}:print_format=none`,
    ].join(','),
  },
  {
    name: '4-full-sweetened',
    label: 'Full chain (highpass + compression + presence EQ + normalization)',
    filter: [
      `highpass=f=${HIGHPASS_FREQ_HZ}`,
      `acompressor=threshold=${COMP_THRESHOLD_DB}dB:ratio=${COMP_RATIO}:attack=${COMP_ATTACK_MS}:release=${COMP_RELEASE_MS}:makeup=${COMP_MAKEUP_DB}dB`,
      `equalizer=f=${PRESENCE_FREQ_HZ}:t=q:w=${PRESENCE_Q}:g=${PRESENCE_GAIN_DB}`,
      `loudnorm=I=${LOUDNORM_TARGET_IL}:LRA=${LOUDNORM_TARGET_LRA}:TP=${LOUDNORM_TARGET_TP}:print_format=none`,
    ].join(','),
  },
];

async function applyFilter(
  inputPath: string,
  outputPath: string,
  filter: string
): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-af',
    filter,
    '-ar',
    '44100',
    '-ac',
    '2',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '128k',
    outputPath,
  ]);
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const episodeId = parseArgValue(args, 'episode');
  const urlArg = parseArgValue(args, 'url');
  const fileArg = parseArgValue(args, 'file');

  // Set up output directory
  const outDir = path.join(os.homedir(), 'Desktop', 'audio-sweetening-test');
  await fs.mkdir(outDir, { recursive: true });

  // Resolve source audio
  let sourcePath: string;
  let label: string;

  if (fileArg) {
    // Use local file directly
    sourcePath = path.resolve(fileArg);
    label = path.basename(fileArg, '.mp3');
    console.log(`Using local file: ${sourcePath}`);
  } else {
    let audioUrl: string;

    if (urlArg) {
      audioUrl = urlArg;
      label = 'custom-url';
    } else {
      // Query DB for an episode
      let episode;
      if (episodeId) {
        episode = await prisma.episode.findUnique({
          where: { id: episodeId },
          select: { id: true, title: true, audioUrl_1_0: true, audioUrl: true },
        });
        if (!episode) {
          throw new Error(`Episode not found: ${episodeId}`);
        }
      } else {
        // Auto-pick the most recently updated episode with audio
        episode = await prisma.episode.findFirst({
          where: {
            OR: [{ audioUrl_1_0: { not: null } }, { audioUrl: { not: null } }],
          },
          select: { id: true, title: true, audioUrl_1_0: true, audioUrl: true },
          orderBy: { updatedAt: 'desc' },
        });
        if (!episode) {
          throw new Error(
            'No episodes with audio found. Use --url or --file instead.'
          );
        }
      }

      audioUrl = episode.audioUrl_1_0 || episode.audioUrl || '';
      if (!audioUrl) {
        throw new Error(`Episode ${episode.id} has no audio URL`);
      }
      label = (episode.title || episode.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      console.log(`Episode: "${episode.title}" (${episode.id})`);
    }

    sourcePath = path.join(outDir, `${label}-original.mp3`);
    await downloadToFile(audioUrl, sourcePath);
  }

  // Process all stages
  const results: Array<{
    name: string;
    label: string;
    filePath: string;
    stats: { input_i: string; input_tp: string; input_lra: string };
  }> = [];

  for (const stage of STAGES) {
    const outPath = path.join(outDir, `${label}-${stage.name}.mp3`);

    console.log(`\n--- ${stage.label} ---`);

    if (stage.filter === null) {
      // Original: just copy
      if (path.resolve(sourcePath) !== path.resolve(outPath)) {
        await fs.copyFile(sourcePath, outPath);
      }
    } else {
      console.log(`  Filter: ${stage.filter}`);
      await applyFilter(sourcePath, outPath, stage.filter);
    }

    const stats = await measureLoudness(outPath);
    console.log(`  Loudness: ${stats.input_i} LUFS | Peak: ${stats.input_tp} dBTP | Range: ${stats.input_lra} LU`);

    results.push({ name: stage.name, label: stage.label, filePath: outPath, stats });
  }

  // Summary table
  console.log('\n' + '='.repeat(72));
  console.log('COMPARISON');
  console.log('='.repeat(72));
  console.log('  Stage                          Loudness     Peak        Range');
  console.log('  ' + '-'.repeat(68));
  for (const r of results) {
    const name = r.label.padEnd(33);
    const loud = (r.stats.input_i + ' LUFS').padEnd(13);
    const peak = (r.stats.input_tp + ' dBTP').padEnd(12);
    const range = r.stats.input_lra + ' LU';
    console.log(`  ${name}${loud}${peak}${range}`);
  }
  console.log('='.repeat(72));

  console.log('\nFiles (in playback order):');
  for (const r of results) {
    console.log(`  ${r.name}: ${r.filePath}`);
  }

  // Open in Finder
  execFile('open', [outDir], () => {});

  console.log('\nDone! Listen to all 4 files in order and adjust parameters at the top of this script.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
