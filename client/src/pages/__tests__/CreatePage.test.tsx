import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreatePage from '../CreatePage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      narrowListeningEnabled: true,
      processingInstructionEnabled: true,
      lexicalChunksEnabled: true,
    },
    isLoading: false,
    error: null,
    isFeatureEnabled: () => true,
    isAdmin: false,
  }),
}));

describe('CreatePage', () => {
  const renderCreatePage = () => render(
      <BrowserRouter>
        <CreatePage />
      </BrowserRouter>
    );

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Mobile layout - Title and footer', () => {
    it('should have padding on mobile for title section', () => {
      const { container } = renderCreatePage();

      const titleSection = container.querySelector('.mb-12.text-center');
      expect(titleSection).toBeTruthy();
      expect(titleSection).toHaveClass('px-4', 'sm:px-0');
    });

    it('should have padding on mobile for footer text', () => {
      const { container } = renderCreatePage();

      const footerText = container.querySelector('.text-center.text-gray-500.mt-12');
      expect(footerText).toBeTruthy();
      expect(footerText).toHaveClass('px-4', 'sm:px-0');
    });
  });

  describe('Mobile layout - Cards', () => {
    it('should render cards at full width (no extra padding wrapper)', () => {
      const { container } = renderCreatePage();

      // The cards container should not have horizontal padding
      const cardsContainer = container.querySelector('.max-w-5xl.mx-auto.space-y-3');
      expect(cardsContainer).toBeTruthy();
      expect(cardsContainer?.classList.contains('px-4')).toBe(false);
      expect(cardsContainer?.classList.contains('px-6')).toBe(false);
    });

    it('should render all content type cards', () => {
      renderCreatePage();

      expect(screen.getByTestId('create-card-dialogues')).toBeTruthy();
      expect(screen.getByTestId('create-card-audio-course')).toBeTruthy();
      expect(screen.getByTestId('create-card-narrow-listening')).toBeTruthy();
      expect(screen.getByTestId('create-card-processing-instruction')).toBeTruthy();
      expect(screen.getByTestId('create-card-lexical-chunks')).toBeTruthy();
    });
  });

  describe('Content rendering', () => {
    it('should render page title', () => {
      renderCreatePage();

      expect(screen.getByText('What do you want to create?')).toBeTruthy();
    });

    it('should render page description', () => {
      renderCreatePage();

      expect(screen.getByText('Choose an activity type to get started')).toBeTruthy();
    });

    it('should render footer text', () => {
      renderCreatePage();

      expect(screen.getByText(/Experiment, iterate, and discover/i)).toBeTruthy();
    });
  });

  describe('Navigation', () => {
    it('should navigate to dialogue creation on click', () => {
      renderCreatePage();

      const dialogueCard = screen.getByTestId('create-card-dialogues');
      fireEvent.click(dialogueCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/dialogue');
    });

    it('should navigate to audio course creation on click', () => {
      renderCreatePage();

      const audioCourseCard = screen.getByTestId('create-card-audio-course');
      fireEvent.click(audioCourseCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/audio-course');
    });

    it('should navigate to narrow listening creation on click', () => {
      renderCreatePage();

      const narrowListeningCard = screen.getByTestId('create-card-narrow-listening');
      fireEvent.click(narrowListeningCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/narrow-listening');
    });

    it('should navigate to processing instruction creation on click', () => {
      renderCreatePage();

      const piCard = screen.getByTestId('create-card-processing-instruction');
      fireEvent.click(piCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/processing-instruction');
    });

    it('should navigate to lexical chunk pack creation on click', () => {
      renderCreatePage();

      const chunkCard = screen.getByTestId('create-card-lexical-chunks');
      fireEvent.click(chunkCard);

      expect(mockNavigate).toHaveBeenCalledWith('/app/create/lexical-chunk-pack');
    });
  });

  describe('Card structure', () => {
    it('should render cards with full-width class', () => {
      const { container } = renderCreatePage();

      const dialogueCard = screen.getByTestId('create-card-dialogues');
      expect(dialogueCard).toHaveClass('w-full');
    });

    it('should have proper internal padding in card content', () => {
      const { container } = renderCreatePage();

      // Cards should have internal padding via px-4 sm:px-8 on content divs
      const cardContent = container.querySelector('[data-testid="create-card-dialogues"] .flex-1');
      expect(cardContent).toHaveClass('px-4', 'sm:px-8');
    });
  });

  describe('Responsive design', () => {
    it('should use responsive padding for title', () => {
      const { container } = renderCreatePage();

      const title = screen.getByText('What do you want to create?');
      expect(title.parentElement).toHaveClass('px-4', 'sm:px-0');
    });

    it('should use responsive padding for footer', () => {
      const { container } = renderCreatePage();

      const footer = screen.getByText(/Experiment, iterate/i);
      expect(footer).toHaveClass('px-4', 'sm:px-0');
    });
  });
});
