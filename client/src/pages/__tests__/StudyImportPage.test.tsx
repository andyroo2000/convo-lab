import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyImportPage from '../StudyImportPage';

const {
  completeStudyImportUploadMock,
  createStudyImportUploadSessionMock,
  getStudyImportStatusMock,
  uploadStudyImportArchiveMock,
} = vi.hoisted(() => ({
  completeStudyImportUploadMock: vi.fn(),
  createStudyImportUploadSessionMock: vi.fn(),
  getStudyImportStatusMock: vi.fn(),
  uploadStudyImportArchiveMock: vi.fn(),
}));

vi.mock('../../hooks/useStudy', () => ({
  completeStudyImportUpload: completeStudyImportUploadMock,
  createStudyImportUploadSession: createStudyImportUploadSessionMock,
  getStudyImportStatus: getStudyImportStatusMock,
  uploadStudyImportArchive: uploadStudyImportArchiveMock,
}));

describe('StudyImportPage', () => {
  beforeEach(() => {
    completeStudyImportUploadMock.mockReset();
    createStudyImportUploadSessionMock.mockReset();
    getStudyImportStatusMock.mockReset();
    uploadStudyImportArchiveMock.mockReset();
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

  it('uploads a valid .colpkg and shows the import summary', async () => {
    createStudyImportUploadSessionMock.mockResolvedValue({
      importJob: {
        id: 'import-1',
        status: 'pending',
        sourceFilename: 'japanese.colpkg',
        deckName: '日本語',
        uploadedAt: null,
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
        contentType: 'application/zip',
      },
    });
    uploadStudyImportArchiveMock.mockResolvedValue(undefined);
    completeStudyImportUploadMock.mockResolvedValue({
      id: 'import-1',
      status: 'pending',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      uploadedAt: new Date('2026-04-21T00:00:00.000Z').toISOString(),
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
    expect(completeStudyImportUploadMock).toHaveBeenCalledWith('import-1');
    expect(
      await screen.findByText('Imported 6 cards and 3 review logs from 日本語.')
    ).toBeInTheDocument();
    expect(screen.getByText('Skipped 1 unsafe or missing media reference.')).toBeInTheDocument();
    expect(screen.getByText('nested/0: Skipped unsafe archive entry.')).toBeInTheDocument();
  });
});
