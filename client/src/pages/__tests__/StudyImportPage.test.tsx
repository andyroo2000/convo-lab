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
      deckName: '日本語',
      preview: {
        noteCount: 4,
        cardCount: 6,
        reviewLogCount: 3,
        mediaCount: 8,
        noteTypes: [],
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
  });
});
