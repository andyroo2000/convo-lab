import { constants as fsConstants } from 'node:fs';
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 32;
const MAX_STORAGE_PATH_LENGTH = 1024;

export function parsePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const normalized = String(value);

  if (!/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  return parsed;
}

export function validateStoragePaths(manifest) {
  if (!Array.isArray(manifest)) {
    throw new Error('The media manifest must be a JSON array.');
  }

  const paths = manifest.map((value, index) => {
    if (typeof value !== 'string') {
      throw new Error(`Media manifest entry ${index} must be a string.`);
    }

    const segments = value.split('/');

    if (
      value !== value.trim() ||
      value.length === 0 ||
      value.length > MAX_STORAGE_PATH_LENGTH ||
      value.includes('\0') ||
      value.includes('\\') ||
      path.posix.isAbsolute(value) ||
      !value.startsWith('study-media/') ||
      segments.some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      throw new Error(`Media manifest entry ${index} has an unsafe storage path.`);
    }

    return value;
  });

  return [...new Set(paths)].sort();
}

export function resolveExportPath(root, storagePath) {
  const destination = path.resolve(root, ...storagePath.split('/'));
  const rootPrefix = `${root}${path.sep}`;

  if (!destination.startsWith(rootPrefix)) {
    throw new Error(`Storage path escapes the export root: ${storagePath}`);
  }

  return destination;
}

async function assertEmptyDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o755 });
  const resolved = await realpath(directory);
  const contents = await readdir(resolved);

  if (contents.length > 0) {
    throw new Error(`Export root must be empty: ${resolved}`);
  }

  await chmod(resolved, 0o755);

  return resolved;
}

async function downloadObject({ bucket, exportRoot, storagePath }) {
  const destination = resolveExportPath(exportRoot, storagePath);
  const parent = path.dirname(destination);
  const partial = `${destination}.partial`;

  await mkdir(parent, { recursive: true, mode: 0o755 });

  try {
    await lstat(destination);
    throw new Error(`Refusing to overwrite an existing export file: ${storagePath}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  try {
    await bucket.file(storagePath).download({ destination: partial, validation: 'crc32c' });
    const downloaded = await stat(partial);

    if (!downloaded.isFile() || downloaded.size < 1) {
      throw new Error(`Downloaded media is empty or not a regular file: ${storagePath}`);
    }

    await chmod(partial, 0o644);
    await rename(partial, destination);
    return downloaded.size;
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

export async function exportStudyMedia({
  bucket,
  manifestPath,
  missingManifestPath,
  outputRoot,
  concurrency = DEFAULT_CONCURRENCY,
}) {
  await access(manifestPath, fsConstants.R_OK);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const storagePaths = validateStoragePaths(manifest);

  const exportRoot = await assertEmptyDirectory(outputRoot);
  const requestedConcurrency = parsePositiveInteger(
    concurrency,
    'concurrency',
    MAX_CONCURRENCY
  );
  const workerCount = Math.min(requestedConcurrency, storagePaths.length);
  let nextIndex = 0;
  let downloadedFiles = 0;
  let totalBytes = 0;
  const missingStoragePaths = [];

  async function worker() {
    while (nextIndex < storagePaths.length) {
      const storagePath = storagePaths[nextIndex];
      nextIndex += 1;

      try {
        const downloadedBytes = await downloadObject({ bucket, exportRoot, storagePath });
        downloadedFiles += 1;
        totalBytes += downloadedBytes;
      } catch (error) {
        if (error?.code !== 404 && error?.code !== '404') {
          throw error;
        }

        missingStoragePaths.push(storagePath);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  missingStoragePaths.sort();

  if (missingManifestPath) {
    await writeFile(missingManifestPath, `${JSON.stringify(missingStoragePaths)}\n`, {
      mode: 0o600,
    });
  }

  return {
    bucket: bucket.name,
    files: downloadedFiles,
    missingFiles: missingStoragePaths.length,
    bytes: totalBytes,
    outputRoot: exportRoot,
  };
}

function parseArguments(argv) {
  const options = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith('--') || !argv[index + 1]) {
      throw new Error(`Expected --name value arguments; received ${argument}.`);
    }

    options.set(argument.slice(2), argv[index + 1]);
    index += 1;
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const manifestPath = options.get('manifest');
  const missingManifestPath = options.get('missing-manifest');
  const outputRoot = options.get('output-root');
  const bucketName = process.env.GCS_BUCKET_NAME;

  if (!manifestPath || !outputRoot) {
    throw new Error('Pass --manifest and --output-root.');
  }

  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured.');
  }

  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
  const result = await exportStudyMedia({
    bucket: storage.bucket(bucketName),
    manifestPath,
    missingManifestPath,
    outputRoot,
    concurrency: options.get('concurrency') ?? DEFAULT_CONCURRENCY,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
