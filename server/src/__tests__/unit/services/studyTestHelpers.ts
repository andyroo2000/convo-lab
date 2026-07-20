import { promises as fs } from 'fs';
import path from 'path';

import { vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  downloadFromGCSPathMock: vi.fn(),
  getSignedReadUrlMock: vi.fn(),
  uploadBufferToGCSPathMock: vi.fn(),
}));

export const { downloadFromGCSPathMock, getSignedReadUrlMock, uploadBufferToGCSPathMock } =
  storageMocks;

vi.mock('../../../services/storageClient.js', () => ({
  downloadFromGCSPath: downloadFromGCSPathMock,
  getSignedReadUrl: getSignedReadUrlMock,
  uploadBufferToGCSPath: uploadBufferToGCSPathMock,
}));

export const generatedStudyMediaPath = path.join(process.cwd(), 'storage/study-media');

export function resetStudyServiceMocks() {
  vi.clearAllMocks();
  process.env.GCS_BUCKET_NAME = '';
  downloadFromGCSPathMock.mockImplementation(async ({ destinationPath }) => destinationPath);
  uploadBufferToGCSPathMock.mockResolvedValue('https://storage.googleapis.com/test/study-media');
  getSignedReadUrlMock.mockResolvedValue({
    url: 'https://signed.example.com/study-media',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
}

export async function cleanupStudyServiceTestMedia() {
  await fs.rm(generatedStudyMediaPath, { recursive: true, force: true });
}
