import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyImportPage from '../StudyImportPage';

const {
  cancelStudyImportUploadMock,
  completeStudyImportUploadMock,
  createStudyImportUploadSessionMock,
  getCurrentStudyImportMock,
  getStudyImportStatusMock,
  uploadStudyImportArchiveMock,
} = vi.hoisted(() => ({
  cancelStudyImportUploadMock: vi.fn(),
  completeStudyImportUploadMock: vi.fn(),
  createStudyImportUploadSessionMock: vi.fn(),
  getCurrentStudyImportMock: vi.fn(),
  getStudyImportStatusMock: vi.fn(),
  uploadStudyImportArchiveMock: vi.fn(),
}));

vi.mock('../../hooks/useStudy', () => ({
  cancelStudyImportUpload: cancelStudyImportUploadMock,
  completeStudyImportUpload: completeStudyImportUploadMock,
  createStudyImportUploadSession: createStudyImportUploadSessionMock,
  getCurrentStudyImport: getCurrentStudyImportMock,
  getStudyImportStatus: getStudyImportStatusMock,
  uploadStudyImportArchive: uploadStudyImportArchiveMock,
}));

describe('StudyImportPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    cancelStudyImportUploadMock.mockReset();
    completeStudyImportUploadMock.mockReset();
    createStudyImportUploadSessionMock.mockReset();
    getCurrentStudyImportMock.mockReset();
    getStudyImportStatusMock.mockReset();
    uploadStudyImportArchiveMock.mockReset();
    getCurrentStudyImportMock.mockResolvedValue(null);
  });

  it('rejects non-.colpkg files before submission', async () => {
    render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText('Anki collection backup');
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['bad'], 'anki-export.apkg')],
      },
    });

    expect(screen.getByText('Please choose a .colpkg Anki collection backup.')).toBeInTheDocument();
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('rejects files over 2 GB before upload', async () => {
    render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText('Anki collection backup');
    const largeFile = new File(['x'], 'huge.colpkg');
    Object.defineProperty(largeFile, 'size', {
      value: 2 * 1024 * 1024 * 1024 + 1,
    });

    fireEvent.change(fileInput, {
      target: {
        files: [largeFile],
      },
    });

    expect(screen.getByText(/Study imports can be up to 2 GB/)).toBeInTheDocument();
    expect(createStudyImportUploadSessionMock).not.toHaveBeenCalled();
  });

  it('uploads a valid .colpkg and shows the import summary', async () => {
    createStudyImportUploadSessionMock.mockResolvedValue({
      importJob: {
        id: 'import-1',
        status: 'pending',
        sourceFilename: 'japanese.colpkg',
        deckName: '日本語',
        uploadedAt: null,
        uploadExpiresAt: '2099-04-21T01:00:00.000Z',
        sourceSizeBytes: null,
        importedAt: null,
        errorMessage: null,
        preview: {
          deckName: '日本語',
          noteCount: 0,
          cardCount: 0,
          reviewLogCount: 0,
          mediaReferenceCount: 0,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
      },
      upload: {
        method: 'PUT',
        url: 'https://uploads.example/import-1',
        headers: { 'Content-Type': 'application/zip' },
      },
    });
    uploadStudyImportArchiveMock.mockResolvedValue(undefined);
    completeStudyImportUploadMock.mockResolvedValue({
      id: 'import-1',
      status: 'pending',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      uploadedAt: new Date('2026-04-21T00:00:00.000Z').toISOString(),
      uploadExpiresAt: '2099-04-21T01:00:00.000Z',
      sourceSizeBytes: 1024,
      importedAt: null,
      errorMessage: null,
      preview: {
        deckName: '日本語',
        noteCount: 0,
        cardCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
    });
    getStudyImportStatusMock.mockResolvedValue({
      id: 'import-1',
      status: 'completed',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      uploadedAt: new Date('2026-04-21T00:00:00.000Z').toISOString(),
      uploadExpiresAt: '2099-04-21T01:00:00.000Z',
      sourceSizeBytes: 1024,
      importedAt: new Date('2026-04-21T00:10:00.000Z').toISOString(),
      errorMessage: null,
      preview: {
        deckName: '日本語',
        noteCount: 4,
        cardCount: 6,
        reviewLogCount: 3,
        mediaReferenceCount: 8,
        skippedMediaCount: 1,
        warnings: ['nested/0: Skipped unsafe archive entry.'],
        noteTypeBreakdown: [],
      },
    });

    render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText('Anki collection backup');
    await userEvent.upload(fileInput, new File(['ok'], 'japanese.colpkg'));
    await userEvent.click(screen.getByRole('button', { name: 'Import .colpkg' }));

    expect(createStudyImportUploadSessionMock).toHaveBeenCalled();
    expect(uploadStudyImportArchiveMock).toHaveBeenCalled();
    expect(uploadStudyImportArchiveMock.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        onProgress: expect.any(Function),
        signal: expect.any(AbortSignal),
      })
    );
    expect(completeStudyImportUploadMock).toHaveBeenCalledWith('import-1');
    expect(
      await screen.findByText('Imported 6 cards and 3 review logs from 日本語.')
    ).toBeInTheDocument();
    expect(screen.getByText('Skipped 1 unsafe or missing media reference.')).toBeInTheDocument();
    expect(screen.getByText('nested/0: Skipped unsafe archive entry.')).toBeInTheDocument();
  });

  it('cancels an in-flight upload', async () => {
    createStudyImportUploadSessionMock.mockResolvedValue({
      importJob: {
        id: 'import-1',
        status: 'pending',
        sourceFilename: 'japanese.colpkg',
        deckName: '日本語',
        uploadedAt: null,
        uploadExpiresAt: '2099-04-21T01:00:00.000Z',
        sourceSizeBytes: null,
        importedAt: null,
        errorMessage: null,
        preview: {
          deckName: '日本語',
          noteCount: 0,
          cardCount: 0,
          reviewLogCount: 0,
          mediaReferenceCount: 0,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
      },
      upload: {
        method: 'PUT',
        url: 'https://uploads.example/import-1',
        headers: { 'Content-Type': 'application/zip' },
      },
    });
    uploadStudyImportArchiveMock.mockImplementation(() => new Promise(() => {}));
    cancelStudyImportUploadMock.mockResolvedValue({
      id: 'import-1',
      status: 'failed',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      uploadedAt: null,
      uploadExpiresAt: '2099-04-21T01:00:00.000Z',
      sourceSizeBytes: null,
      importedAt: null,
      errorMessage: 'Study import upload was cancelled.',
      preview: {
        deckName: '日本語',
        noteCount: 0,
        cardCount: 0,
        reviewLogCount: 0,
        mediaReferenceCount: 0,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
    });

    render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText('Anki collection backup');
    await userEvent.upload(fileInput, new File(['ok'], 'japanese.colpkg'));
    await userEvent.click(screen.getByRole('button', { name: 'Import .colpkg' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel upload' }));

    expect(cancelStudyImportUploadMock).toHaveBeenCalledWith('import-1');
    expect(await screen.findByText('Study import upload was cancelled.')).toBeInTheDocument();
  });
});
