import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const studyFeatureFlagsMock = vi.hoisted(() => ({
  id: 'flags-1',
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  studyApiEnabled: false,
  studyApiSettings: false,
  studyApiOverview: false,
  studyApiBrowser: false,
  studyApiNewQueue: false,
  studyApiImports: false,
  studyApiSettingsWrite: false,
  studyApiNewQueueWrite: false,
  updatedAt: '2026-07-14T00:00:00.000Z',
}));

vi.mock('../../hooks/useStudy', () => ({
  cancelStudyImportUpload: cancelStudyImportUploadMock,
  completeStudyImportUpload: completeStudyImportUploadMock,
  createStudyImportUploadSession: createStudyImportUploadSessionMock,
  getCurrentStudyImport: getCurrentStudyImportMock,
  getStudyImportStatus: getStudyImportStatusMock,
  uploadStudyImportArchive: uploadStudyImportArchiveMock,
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: studyFeatureFlagsMock,
  }),
}));

async function waitForInitialImportResume() {
  await waitFor(() => expect(getCurrentStudyImportMock).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText('Checking the latest import status…')).not.toBeInTheDocument()
  );
}

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
    await waitForInitialImportResume();

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
    await waitForInitialImportResume();

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
    await waitForInitialImportResume();

    const fileInput = screen.getByLabelText('Anki collection backup');
    await userEvent.upload(fileInput, new File(['ok'], 'japanese.colpkg'));
    const submitButton = screen.getByRole('button', { name: 'Import .colpkg' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await userEvent.click(submitButton);

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
    await waitForInitialImportResume();

    const fileInput = screen.getByLabelText('Anki collection backup');
    await userEvent.upload(fileInput, new File(['ok'], 'japanese.colpkg'));
    const submitButton = screen.getByRole('button', { name: 'Import .colpkg' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    await userEvent.click(submitButton);
    await waitFor(() => expect(createStudyImportUploadSessionMock).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel upload' }));

    expect(cancelStudyImportUploadMock).toHaveBeenCalledWith('import-1');
    expect(await screen.findByText('Study import upload was cancelled.')).toBeInTheDocument();
  });

  it('aborts resumed status polling when the page unmounts', async () => {
    const signals: AbortSignal[] = [];
    window.localStorage.setItem('study.import.activeJobId', 'import-1');
    getStudyImportStatusMock.mockImplementation(
      (_importJobId: string, init?: { signal?: AbortSignal }) => {
        if (init?.signal) {
          signals.push(init.signal);
        }

        return Promise.resolve({
          id: 'import-1',
          status: 'processing',
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
      }
    );

    const { unmount } = render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(signals.length).toBeGreaterThan(0));
    unmount();

    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
