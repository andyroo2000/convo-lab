import { Storage } from '@google-cloud/storage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createReadStream } from 'fs';

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GCS_BUCKET_NAME!;

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  contentType: string;
  folder?: string;
}

export async function uploadToGCS(options: UploadOptions): Promise<string> {
  const { buffer, filename, contentType, folder = 'uploads' } = options;

  try {
    const bucket = storage.bucket(bucketName);
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
    return `https://storage.googleapis.com/${bucketName}/${filepath}`;
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
    const bucket = storage.bucket(bucketName);
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
    return `https://storage.googleapis.com/${bucketName}/${filepath}`;
  } catch (error) {
    console.error('GCS streaming upload error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file to Google Cloud Storage: ${errorMsg}`);
  }
}

export async function uploadAudio(
  audioBuffer: Buffer,
  episodeId: string,
  type: 'normal' | 'slow' | 'pause' = 'normal'
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
    // Extract filepath from URL
    const urlPattern = new RegExp(`https://storage.googleapis.com/${bucketName}/(.+)`);
    const match = url.match(urlPattern);

    if (!match) {
      throw new Error('Invalid GCS URL');
    }

    const filepath = match[1];
    const bucket = storage.bucket(bucketName);
    await bucket.file(filepath).delete();
  } catch (error) {
    console.error('GCS delete error:', error);
    throw new Error('Failed to delete file from Google Cloud Storage');
  }
}
