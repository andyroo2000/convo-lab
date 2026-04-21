import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyImportPage from '../StudyImportPage';

const { uploadStudyImportMock } = vi.hoisted(() => ({
  uploadStudyImportMock: vi.fn(),
}));

vi.mock('../../hooks/useStudy', () => ({
  uploadStudyImport: uploadStudyImportMock,
}));

describe('StudyImportPage', () => {
  beforeEach(() => {
    uploadStudyImportMock.mockReset();
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
    expect(uploadStudyImportMock).not.toHaveBeenCalled();
  });

  it('rejects oversized .colpkg files before submission', async () => {
    render(
      <BrowserRouter>
        <StudyImportPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText('Anki collection backup');
    const oversizedFile = new File(['ok'], 'large-export.colpkg');
    Object.defineProperty(oversizedFile, 'size', {
      configurable: true,
      value: 200 * 1024 * 1024 + 1,
    });

    await userEvent.upload(fileInput, oversizedFile);

    expect(
      screen.getByText('Please choose a .colpkg file that is 200 MB or smaller.')
    ).toBeInTheDocument();
    expect(uploadStudyImportMock).not.toHaveBeenCalled();
  });

  it('uploads a valid .colpkg and shows the import summary', async () => {
    uploadStudyImportMock.mockResolvedValue({
      id: 'import-1',
      status: 'completed',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      importedAt: new Date('2026-04-21T00:00:00.000Z').toISOString(),
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

    expect(uploadStudyImportMock).toHaveBeenCalled();
    expect(
      await screen.findByText('Imported 6 cards and 3 review logs from 日本語.')
    ).toBeInTheDocument();
    expect(screen.getByText('Skipped 1 unsafe or missing media reference.')).toBeInTheDocument();
    expect(screen.getByText('nested/0: Skipped unsafe archive entry.')).toBeInTheDocument();
  });
});
