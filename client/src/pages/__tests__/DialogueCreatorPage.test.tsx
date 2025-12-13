import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock DialogueGenerator component
vi.mock('../../components/dialogue/DialogueGenerator', () => ({
  default: () => <div data-testid="dialogue-generator">Dialogue Generator Component</div>,
}));

import DialogueCreatorPage from '../DialogueCreatorPage';

describe('DialogueCreatorPage', () => {
  const renderPage = () => {
    return render(
      <BrowserRouter>
        <DialogueCreatorPage />
      </BrowserRouter>
    );
  };

  it('should render page title', () => {
    renderPage();
    expect(screen.getByText('Comprehensible Input Dialogues')).toBeInTheDocument();
  });

  it('should render page description', () => {
    renderPage();
    expect(screen.getByText('Generate AI dialogues calibrated to your proficiency level')).toBeInTheDocument();
  });

  it('should render DialogueGenerator component', () => {
    renderPage();
    expect(screen.getByTestId('dialogue-generator')).toBeInTheDocument();
  });

  it('should have border styling on header', () => {
    renderPage();
    const header = document.querySelector('.border-b-4.border-periwinkle');
    expect(header).toBeInTheDocument();
  });
});
