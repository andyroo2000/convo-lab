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
 * Upload and crop a speaker avatar (dialogue character)
 * Saves to local public/avatars/ directory
 */
export async function uploadSpeakerAvatar(
  filename: string,
  imageBuffer: Buffer,
  cropArea: CropArea
): Promise<void> {
  // Crop and resize the image
  const croppedBuffer = await cropAndResizeImage(imageBuffer, cropArea);

  // Save original to backup directory
  const originalDir = path.join(__dirname, '../../public/avatars/original');
  await fs.mkdir(originalDir, { recursive: true });

  const timestamp = Date.now();
  const originalPath = path.join(originalDir, `${path.parse(filename).name}-${timestamp}${path.extname(filename)}`);
  await fs.writeFile(originalPath, imageBuffer);

  // Save cropped avatar
  const avatarPath = path.join(__dirname, '../../public/avatars', filename);
  await fs.mkdir(path.dirname(avatarPath), { recursive: true });
  await fs.writeFile(avatarPath, croppedBuffer);
}

/**
 * Re-crop an existing speaker avatar from the downloads directory
 */
export async function recropSpeakerAvatar(
  filename: string,
  cropArea: CropArea
): Promise<void> {
  // Read the original image from downloads directory
  const downloadsDir = path.join(__dirname, '../../public/avatars/downloads');
  const originalPath = path.join(downloadsDir, filename);

  try {
    const imageBuffer = await fs.readFile(originalPath);
    await uploadSpeakerAvatar(filename, imageBuffer, cropArea);
  } catch (error) {
    throw new Error(`Original image not found in downloads: ${filename}`);
  }
}

/**
 * Get the original speaker avatar from downloads directory
 */
export async function getOriginalSpeakerAvatar(filename: string): Promise<Buffer> {
  const downloadsDir = path.join(__dirname, '../../public/avatars/downloads');
  const originalPath = path.join(downloadsDir, filename);

  try {
    return await fs.readFile(originalPath);
  } catch (error) {
    throw new Error(`Original image not found in downloads: ${filename}`);
  }
}
