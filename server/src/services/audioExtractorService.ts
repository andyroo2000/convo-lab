import { prisma } from '../db/client.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'languageflow-audio';

interface TimingDataUnit {
  unitIndex: number;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
}

interface PhraseComponent {
  type: 'word' | 'particle' | 'grammar';
  textL2: string;
  translationL1?: string;
  grammarNote?: string;
}

/**
 * Extracts audio for a vocabulary word from course audio using timing data
 */
export async function extractVocabularyAudio(
  coreItemId: string
): Promise<string | null> {
  try {
    // Get the core item with course data
    const coreItem = await prisma.courseCoreItem.findUnique({
      where: { id: coreItemId },
      include: {
        course: {
          select: {
            id: true,
            audioUrl: true,
            scriptJson: true,
            timingData: true,
          },
        },
      },
    });

    if (!coreItem || !coreItem.course) {
      console.warn(`Core item ${coreItemId} not found or has no course`);
      return null;
    }

    const { course } = coreItem;

    if (!course.audioUrl || !course.scriptJson || !course.timingData) {
      console.warn(`Course ${course.id} missing audio, script, or timing data`);
      return null;
    }

    // Use sourceUnitIndex if available (new approach)
    if (coreItem.sourceUnitIndex !== null && coreItem.sourceUnitIndex !== undefined) {
      const scriptUnits = course.scriptJson as any[];
      const timingData = course.timingData as TimingDataUnit[];

      console.log(`\n=== Audio Extraction (Direct Index) ===`);
      console.log(`Vocabulary: "${coreItem.textL2}"`);
      console.log(`Source unit index: ${coreItem.sourceUnitIndex}`);

      const targetUnit = scriptUnits[coreItem.sourceUnitIndex];
      if (!targetUnit) {
        console.warn(`Unit index ${coreItem.sourceUnitIndex} not found in script`);
        return null;
      }

      console.log(`Unit text: "${targetUnit.textL2}"`);

      // Get timing for this unit
      const timing = timingData.find((t) => t.unitIndex === coreItem.sourceUnitIndex);
      if (!timing) {
        console.warn(`No timing data for unit index ${coreItem.sourceUnitIndex}`);
        return null;
      }

      console.log(`Timing: ${timing.startTime}ms - ${timing.endTime}ms`);

      // Extract the audio segment
      const audioUrl = await extractAudioSegment(
        course.audioUrl,
        timing.startTime,
        timing.endTime,
        `vocab_${coreItemId}`
      );

      return audioUrl;
    }

    // Fallback: Old vocabulary items without sourceUnitIndex
    console.warn(`Core item "${coreItem.textL2}" has no sourceUnitIndex - this is old data`);
    console.warn(`Consider regenerating the course to get audio for this vocabulary`);
    return null;
  } catch (error) {
    console.error('Error extracting vocabulary audio:', error);
    return null;
  }
}

/**
 * Extracts an audio segment using ffmpeg and uploads to GCS
 */
async function extractAudioSegment(
  sourceAudioUrl: string,
  startTimeMs: number,
  endTimeMs: number,
  outputName: string
): Promise<string> {
  const tempDir = os.tmpdir();
  const tempInputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
  const tempOutputPath = path.join(tempDir, `${outputName}_${Date.now()}.mp3`);

  try {
    // Download the source audio
    console.log(`Downloading source audio from ${sourceAudioUrl}`);
    const response = await fetch(sourceAudioUrl);
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(tempInputPath, Buffer.from(arrayBuffer));

    // Calculate times in seconds for ffmpeg
    const startTimeSec = startTimeMs / 1000;
    const durationSec = (endTimeMs - startTimeMs) / 1000;

    // Extract segment using ffmpeg
    const ffmpegCommand = `ffmpeg -i "${tempInputPath}" -ss ${startTimeSec} -t ${durationSec} -c copy "${tempOutputPath}"`;
    console.log(`Running ffmpeg: ${ffmpegCommand}`);

    await execAsync(ffmpegCommand);

    // Upload to GCS
    const gcsPath = `vocabulary/${outputName}.mp3`;
    await storage.bucket(bucketName).upload(tempOutputPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'audio/mpeg',
      },
    });

    // Make the file public
    await storage.bucket(bucketName).file(gcsPath).makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
    console.log(`Uploaded vocabulary audio to ${publicUrl}`);

    return publicUrl;
  } finally {
    // Clean up temp files
    try {
      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
