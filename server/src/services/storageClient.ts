import { createReadStream } from 'fs';

import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

function requireBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }

  return bucketName;
}

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  folder?: string;
}

export async function uploadToGCS(options: UploadOptions): Promise<string> {
  const { buffer, filename, contentType, folder = 'uploads' } = options;

  try {
    const resolvedBucketName = requireBucketName();
    const bucket = storage.bucket(resolvedBucketName);
    const uniqueFilename = `${uuidv4()}-${filename}`;
    const filepath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;
    const file = bucket.file(filepath);

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make file publicly accessible
    await file.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${resolvedBucketName}/${filepath}`;
  } catch (error) {
    console.error('GCS upload error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file to Google Cloud Storage: ${errorMsg}`);
  }
}

export interface UploadFileOptions {
  filePath: string;
  filename: string;
  contentType: string;
  folder?: string;
}

/**
 * Upload a file to GCS using streaming (memory-efficient for large files)
 */
export async function uploadFileToGCS(options: UploadFileOptions): Promise<string> {
  const { filePath, filename, contentType, folder = 'uploads' } = options;

  try {
    const resolvedBucketName = requireBucketName();
    const bucket = storage.bucket(resolvedBucketName);
    const uniqueFilename = `${uuidv4()}-${filename}`;
    const filepath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;
    const file = bucket.file(filepath);

    // Stream the file to GCS instead of loading into memory
    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .pipe(
          file.createWriteStream({
            contentType,
            metadata: {
              cacheControl: 'public, max-age=31536000',
            },
          })
        )
        .on('error', reject)
        .on('finish', resolve);
    });

    // Make file publicly accessible
    await file.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${resolvedBucketName}/${filepath}`;
  } catch (error) {
    console.error('GCS streaming upload error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file to Google Cloud Storage: ${errorMsg}`);
  }
}

export async function uploadAudio(
  audioBuffer: Buffer,
  episodeId: string,
  type: 'normal' | 'slow' | 'medium' | 'pause' = 'normal'
): Promise<string> {
  return uploadToGCS({
    buffer: audioBuffer,
    filename: `${episodeId}-${type}.mp3`,
    contentType: 'audio/mpeg',
    folder: 'audio',
  });
}

export async function uploadImage(
  imageBuffer: Buffer,
  episodeId: string,
  index: number
): Promise<string> {
  return uploadToGCS({
    buffer: imageBuffer,
    filename: `${episodeId}-${index}.png`,
    contentType: 'image/png',
    folder: 'images',
  });
}

export async function deleteFromGCS(url: string): Promise<void> {
  try {
    const resolvedBucketName = requireBucketName();

    // Extract filepath from URL
    const urlPattern = new RegExp(`https://storage.googleapis.com/${resolvedBucketName}/(.+)`);
    const match = url.match(urlPattern);

    if (!match) {
      throw new Error('Invalid GCS URL');
    }

    const filepath = match[1];
    const bucket = storage.bucket(resolvedBucketName);
    await bucket.file(filepath).delete();
  } catch (error) {
    console.error('GCS delete error:', error);
    throw new Error('Failed to delete file from Google Cloud Storage');
  }
}

export interface SignedReadUrlOptions {
  filePath: string;
  expiresInSeconds: number;
}

export interface SignedReadUrlResult {
  url: string;
  expiresAt: string;
}

export async function gcsFileExists(filePath: string): Promise<boolean> {
  const resolvedBucketName = requireBucketName();
  const bucket = storage.bucket(resolvedBucketName);
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  return exists;
}

export async function getSignedReadUrl(
  options: SignedReadUrlOptions
): Promise<SignedReadUrlResult> {
  const { filePath, expiresInSeconds } = options;
  const resolvedBucketName = requireBucketName();
  const bucket = storage.bucket(resolvedBucketName);
  const file = bucket.file(filePath);
  const expiresAtMs = Date.now() + expiresInSeconds * 1000;

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: expiresAtMs,
  });

  return {
    url,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}
