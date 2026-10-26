import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createManualDraftMock,
  createVocabBundleDraftsMock,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
} from './StudyCreatePageTestHarness';

async function chooseSource() {
  await userEvent.click(screen.getByText('Source and priority for new cards'));
  await userEvent.selectOptions(screen.getByLabelText('Book or source'), 'book');
  await userEvent.selectOptions(screen.getByLabelText('Chapter'), 'chapter');
  await userEvent.click(screen.getByLabelText('Learn soon'));
}

const placement = { bookSource: { pileId: 'book', chapterId: 'chapter' }, learnSoon: true };
describe('card creation source placement', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);
  it('sends the selected parked book and priority to manual draft creation', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseSource();
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));
    expect(createManualDraftMock).toHaveBeenCalledWith(expect.objectContaining(placement));
  });
  it('sends the selected source to every generated vocabulary family', async () => {
    renderPage();
    await chooseSource();
    await userEvent.type(screen.getByLabelText('Target word'), '営業する');
    await userEvent.click(screen.getByRole('button', { name: 'Generate vocab bundle' }));
    expect(createVocabBundleDraftsMock).toHaveBeenCalledWith(expect.objectContaining(placement));
  });
});
