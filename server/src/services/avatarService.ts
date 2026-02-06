/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import { fileURLToPath } from 'url';

import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import sharp from 'sharp';

import { prisma } from '../db/client.js';

import { uploadToGCS } from './storageClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crops and resizes an image buffer to 256x256px
 */
export async function cropAndResizeImage(imageBuffer: Buffer, cropArea: CropArea): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Ensure crop area is within image bounds
  const left = Math.max(0, Math.min(Math.round(cropArea.x), metadata.width! - 1));
  const top = Math.max(0, Math.min(Math.round(cropArea.y), metadata.height! - 1));
  const width = Math.min(Math.round(cropArea.width), metadata.width! - left);
  const height = Math.min(Math.round(cropArea.height), metadata.height! - top);

  return sharp(imageBuffer)
    .extract({
      left,
      top,
      width,
      height,
    })
    .resize(256, 256, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({
      quality: 85,
      progressive: true,
    })
    .toBuffer();
}

/**
 * Upload and crop a user's profile avatar
 * Saves to GCS and updates the user's avatarUrl in the database
 */
export async function uploadUserAvatar(
  userId: string,
  imageBuffer: Buffer,
  cropArea: CropArea
): Promise<string> {
  // Crop and resize the image
  const croppedBuffer = await cropAndResizeImage(imageBuffer, cropArea);

  // Upload to GCS in the 'avatars' folder
  const filename = `user-${userId}-${Date.now()}.jpg`;
  const publicUrl = await uploadToGCS({
    buffer: croppedBuffer,
    filename,
    contentType: 'image/jpeg',
    folder: 'avatars',
  });

  // Update user's avatarUrl in database
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: publicUrl },
  });

  return publicUrl;
}

/**
 * Parse speaker avatar filename to extract metadata
 * Example: "ja-female-casual.jpg" => { language: 'ja', gender: 'female', tone: 'casual' }
 */
function parseAvatarFilename(filename: string): { language: string; gender: string; tone: string } {
  const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const [language, gender, tone] = nameWithoutExt.split('-');
  return { language, gender, tone };
}

/**
 * Upload and crop a speaker avatar (dialogue character)
 * Saves both cropped and original to GCS and creates/updates database record
 */
export async function uploadSpeakerAvatar(
  filename: string,
  imageBuffer: Buffer,
  cropArea: CropArea
): Promise<{ croppedUrl: string; originalUrl: string }> {
  // Crop and resize the image
  const croppedBuffer = await cropAndResizeImage(imageBuffer, cropArea);

  // Upload cropped version to GCS
  const croppedUrl = await uploadToGCS({
    buffer: croppedBuffer,
    filename,
    contentType: 'image/jpeg',
    folder: 'avatars/speakers',
  });

  // Upload original to GCS
  const originalFilename = `original-${filename}`;
  const originalUrl = await uploadToGCS({
    buffer: imageBuffer,
    filename: originalFilename,
    contentType: 'image/jpeg',
    folder: 'avatars/speakers',
  });

  // Parse filename to extract metadata
  const { language, gender, tone } = parseAvatarFilename(filename);

  // Create or update database record
  await prisma.speakerAvatar.upsert({
    where: { filename },
    create: {
      filename,
      croppedUrl,
      originalUrl,
      language,
      gender,
      tone,
    },
    update: {
      croppedUrl,
      originalUrl,
    },
  });

  return { croppedUrl, originalUrl };
}

/**
 * Re-crop an existing speaker avatar from GCS
 */
export async function recropSpeakerAvatar(
  filename: string,
  cropArea: CropArea
): Promise<{ croppedUrl: string; originalUrl: string }> {
  // Get the original image URL from database
  const avatar = await prisma.speakerAvatar.findUnique({
    where: { filename },
  });

  if (!avatar) {
    throw new Error(`Speaker avatar not found in database: ${filename}`);
  }

  // Fetch the original image from GCS
  const response = await fetch(avatar.originalUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch original image from GCS: ${filename}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());

  // Re-upload with new crop
  return uploadSpeakerAvatar(filename, imageBuffer, cropArea);
}

/**
 * Get the original speaker avatar URL from database
 */
export async function getSpeakerAvatarOriginalUrl(filename: string): Promise<string> {
  const avatar = await prisma.speakerAvatar.findUnique({
    where: { filename },
    select: { originalUrl: true },
  });

  if (!avatar) {
    throw new Error(`Speaker avatar not found in database: ${filename}`);
  }

  return avatar.originalUrl;
}

/**
 * Get all speaker avatars from database
 */
export async function getAllSpeakerAvatars() {
  return prisma.speakerAvatar.findMany({
    orderBy: [{ language: 'asc' }, { gender: 'asc' }, { tone: 'asc' }],
  });
}

/**
 * Get a speaker avatar by filename
 */
export async function getSpeakerAvatar(filename: string) {
  return prisma.speakerAvatar.findUnique({
    where: { filename },
  });
}

/**
 * Get gender from TTS_VOICES configuration (single source of truth)
 * @param voiceId - The voice ID to look up
 * @returns The gender of the voice or 'female' as fallback
 */
function getVoiceGenderFromConfig(voiceId: string): string {
  for (const config of Object.values(TTS_VOICES)) {
    const voice = config.voices.find((v: any) => v.id === voiceId);
    if (voice) {
      return voice.gender;
    }
  }
  // Default to female if not found
  return 'female';
}

/**
 * Extract language and gender from TTS voiceId (Google Cloud TTS or Amazon Polly)
 * Examples:
 * - Google: ja-JP-Wavenet-A -> { language: 'ja', gender: 'female' }
 * - Polly: Takumi -> { language: 'ja', gender: 'male' }
 */
function parseVoiceId(voiceId: string): { language: string; gender: string } {
  let language: string;

  // Check if this is a Polly voice (no hyphens) or Google voice (has hyphens)
  if (voiceId.includes('-')) {
    // Google Cloud TTS voice: Extract language code (first 2-3 chars before hyphen)
    const parts = voiceId.split('-');
    language = parts[0].toLowerCase();
  } else {
    // Amazon Polly voice: Look up language from TTS_VOICES configuration
    let found = false;
    for (const [langCode, config] of Object.entries(TTS_VOICES)) {
      const voice = config.voices.find((v: any) => v.id === voiceId);
      if (voice) {
        language = langCode;
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback to 'en' if voice not found
      language = 'en';
    }
  }

  // Look up gender from TTS_VOICES config (single source of truth)
  const gender = getVoiceGenderFromConfig(voiceId);

  return { language, gender };
}

/**
 * Get gender from voiceId for external use
 */
export function parseVoiceIdForGender(voiceId: string): string {
  return parseVoiceId(voiceId).gender;
}

/**
 * Find a speaker avatar URL by matching language, gender, and tone
 */
export async function findSpeakerAvatarUrl(
  language: string,
  gender: string,
  tone: string
): Promise<string | null> {
  const avatar = await prisma.speakerAvatar.findFirst({
    where: {
      language: language.toLowerCase(),
      gender: gender.toLowerCase(),
      tone: tone.toLowerCase(),
    },
  });

  return avatar?.croppedUrl || null;
}

/**
 * Get avatar URL for a speaker based on their voiceId and tone
 */
export async function getAvatarUrlFromVoice(voiceId: string, tone: string): Promise<string | null> {
  const { language, gender } = parseVoiceId(voiceId);
  return findSpeakerAvatarUrl(language, gender, tone);
}
