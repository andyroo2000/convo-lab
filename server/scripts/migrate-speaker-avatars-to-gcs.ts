import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadSpeakerAvatar } from '../src/services/avatarService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEAKER_AVATARS = [
  'ja-female-casual.jpg',
  'ja-female-polite.jpg',
  'ja-female-formal.jpg',
  'ja-male-casual.jpg',
  'ja-male-polite.jpg',
  'ja-male-formal.jpg',
  'zh-female-casual.jpg',
  'zh-female-polite.jpg',
  'zh-female-formal.jpg',
  'zh-male-casual.jpg',
  'zh-male-polite.jpg',
  'zh-male-formal.jpg',
];

interface MigrationResult {
  filename: string;
  success: boolean;
  croppedUrl?: string;
  originalUrl?: string;
  error?: string;
}

async function migrateSpeakerAvatarsToGCS(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const avatarsDir = path.join(__dirname, '../public/avatars');

  console.log('Starting speaker avatar migration to GCS...\n');

  for (const filename of SPEAKER_AVATARS) {
    const avatarPath = path.join(avatarsDir, filename);

    try {
      console.log(`Processing ${filename}...`);

      // Check if file exists
      try {
        await fs.access(avatarPath);
      } catch {
        console.log(`  ⚠️  File not found: ${avatarPath}`);
        results.push({
          filename,
          success: false,
          error: 'File not found',
        });
        continue;
      }

      // Read the file
      const imageBuffer = await fs.readFile(avatarPath);

      // Upload to GCS with full image as both cropped and original
      // (since we're migrating already-cropped images)
      const cropArea = {
        x: 0,
        y: 0,
        width: 256,
        height: 256,
      };

      const { croppedUrl, originalUrl } = await uploadSpeakerAvatar(
        filename,
        imageBuffer,
        cropArea
      );

      console.log(`  ✅ Uploaded successfully`);
      console.log(`     Cropped URL: ${croppedUrl}`);
      console.log(`     Original URL: ${originalUrl}\n`);

      results.push({
        filename,
        success: true,
        croppedUrl,
        originalUrl,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Failed: ${errorMessage}\n`);

      results.push({
        filename,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}

// Run the migration
(async () => {
  try {
    const results = await migrateSpeakerAvatarsToGCS();

    console.log('\n==== Migration Summary ====\n');

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`Total avatars: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}\n`);

    if (failed.length > 0) {
      console.log('Failed avatars:');
      failed.forEach((r) => {
        console.log(`  - ${r.filename}: ${r.error}`);
      });
      console.log();
    }

    if (successful.length === results.length) {
      console.log('🎉 All avatars migrated successfully!');
      process.exit(0);
    } else {
      console.log('⚠️  Migration completed with some failures.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();
