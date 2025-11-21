import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadToGCS } from './storageClient.js';
import { prisma } from '../db/client.js';

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
export async function cropAndResizeImage(
  imageBuffer: Buffer,
  cropArea: CropArea
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Ensure crop area is within image bounds
  const left = Math.max(0, Math.min(Math.round(cropArea.x), metadata.width! - 1));
  const top = Math.max(0, Math.min(Math.round(cropArea.y), metadata.height! - 1));
  const width = Math.min(Math.round(cropArea.width), metadata.width! - left);
  const height = Math.min(Math.round(cropArea.height), metadata.height! - top);

  return await sharp(imageBuffer)
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
  return await uploadSpeakerAvatar(filename, imageBuffer, cropArea);
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
  return await prisma.speakerAvatar.findMany({
    orderBy: [
      { language: 'asc' },
      { gender: 'asc' },
      { tone: 'asc' },
    ],
  });
}

/**
 * Get a speaker avatar by filename
 */
export async function getSpeakerAvatar(filename: string) {
  return await prisma.speakerAvatar.findUnique({
    where: { filename },
  });
}
