import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ChunkPackExercisesPage from '../ChunkPackExercisesPage';

// Mock navigate
const mockNavigate = vi.fn();

// Use vi.hoisted for mock functions
const mockPlay = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockExercises = [
  {
    id: 'ex-1',
    exerciseType: 'fill_blank',
    prompt: '_______ is very important for health.',
    options: ['Exercise', 'TV', 'Coffee', 'Sleep'],
    correctOption: 'Exercise',
    explanation: 'Exercise helps keep your body healthy.',
    audioUrl: 'https://example.com/audio1.mp3',
  },
  {
    id: 'ex-2',
    exerciseType: 'multiple_choice',
    prompt: 'What does "take care of" mean?',
    options: ['Ignore', 'Look after', 'Destroy', 'Avoid'],
    correctOption: 'Look after',
    explanation: '"Take care of" means to look after or be responsible for something.',
    audioUrl: 'https://example.com/audio2.mp3',
  },
  {
    id: 'ex-3',
    exerciseType: 'translation',
    prompt: 'How do you say "I need to rest"?',
    options: ['I need to work', 'I need to rest', 'I need to play', 'I need to eat'],
    correctOption: 'I need to rest',
    explanation: 'This is the correct translation.',
    audioUrl: 'https://example.com/audio3.mp3',
  },
];

describe('ChunkPackExercisesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock HTMLAudioElement
    global.HTMLAudioElement.prototype.play = mockPlay;
    global.HTMLAudioElement.prototype.pause = vi.fn();

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ exercises: mockExercises }),
    });
  });

  const renderPage = (packId = 'pack-123') => render(
      <MemoryRouter initialEntries={[`/app/chunk-packs/${packId}/exercises`]}>
        <Routes>
          <Route path="/app/chunk-packs/:packId/exercises" element={<ChunkPackExercisesPage />} />
        </Routes>
      </MemoryRouter>
    );

  describe('loading state', () => {
    it('should show loading spinner while exercises are being fetched', () => {
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      renderPage();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should fetch exercises on mount', async () => {
      renderPage('pack-123');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/chunk-packs/pack-123'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });
  });

  describe('exercise display', () => {
    it('should display exercise prompt', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('_______ is very important for health.')).toBeInTheDocument();
      });
    });

    it('should display all options', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
        expect(screen.getByText('TV')).toBeInTheDocument();
        expect(screen.getByText('Coffee')).toBeInTheDocument();
        expect(screen.getByText('Sleep')).toBeInTheDocument();
      });
    });

    it('should have clickable option buttons', async () => {
      renderPage();

      await waitFor(() => {
        const option = screen.getByText('Exercise').closest('button');
        expect(option).not.toBeDisabled();
      });
    });
  });

  describe('progress bar', () => {
    it('should display current exercise number', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise 1 of 3')).toBeInTheDocument();
      });
    });

    it('should display step indicator', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Step 3: Practice')).toBeInTheDocument();
      });
    });

    it('should show correct progress percentage', async () => {
      renderPage();

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-gradient-to-r.from-emerald-500');
        const width = progressBar?.getAttribute('style');
        expect(width).toContain('33.33');
      });
    });
  });

  describe('answer selection', () => {
    it('should highlight selected option with green for correct answer', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      const correctOption = screen.getByText('Exercise').closest('button');
      fireEvent.click(correctOption!);

      expect(correctOption).toHaveClass('border-green-500', 'bg-green-50');
    });

    it('should highlight selected option with red for wrong answer', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('TV')).toBeInTheDocument();
      });

      const wrongOption = screen.getByText('TV').closest('button');
      fireEvent.click(wrongOption!);

      expect(wrongOption).toHaveClass('border-red-500', 'bg-red-50');
    });

    it('should show check circle icon for correct answer', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      const button = screen.getByText('Exercise').closest('button');
      const checkIcon = button?.querySelector('svg');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should show X circle icon for wrong answer', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('TV')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('TV'));

      const button = screen.getByText('TV').closest('button');
      const xIcon = button?.querySelector('svg');
      expect(xIcon).toBeInTheDocument();
    });

    it('should disable all options after answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      const allButtons = ['Exercise', 'TV', 'Coffee', 'Sleep'].map(text =>
        screen.getByText(text).closest('button')
      );

      allButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should not allow changing selection after answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('TV'));

      // First selection should remain
      const exerciseButton = screen.getByText('Exercise').closest('button');
      expect(exerciseButton).toHaveClass('border-green-500');
    });

    it('should auto-play audio after answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      await waitFor(() => {
        expect(mockPlay).toHaveBeenCalled();
      });
    });
  });

  describe('explanation display', () => {
    it('should not show explanation before answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      expect(screen.queryByText('Explanation:')).not.toBeInTheDocument();
    });

    it('should show explanation after answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      expect(screen.getByText('Explanation:')).toBeInTheDocument();
      expect(screen.getByText('Exercise helps keep your body healthy.')).toBeInTheDocument();
    });

    it('should have blue styling for explanation box', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      const explanationBox = screen.getByText('Explanation:').closest('div');
      expect(explanationBox).toHaveClass('bg-blue-50', 'border-blue-200');
    });
  });

  describe('navigation', () => {
    it('should show Next Exercise button after answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));

      expect(screen.getByText('Next Exercise')).toBeInTheDocument();
    });

    it('should not show Next button before answering', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      expect(screen.queryByText('Next Exercise')).not.toBeInTheDocument();
    });

    it('should advance to next exercise when Next is clicked', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('Next Exercise'));

      expect(screen.getByText('Exercise 2 of 3')).toBeInTheDocument();
      expect(screen.getByText('What does "take care of" mean?')).toBeInTheDocument();
    });

    it('should reset selection state when advancing', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('Next Exercise'));

      // New options should not be selected
      const option = screen.getByText('Ignore').closest('button');
      expect(option).not.toHaveClass('border-green-500');
      expect(option).not.toHaveClass('border-red-500');
    });

    it('should show View Results on last exercise', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      // Complete first exercise
      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('Next Exercise'));

      // Complete second exercise
      fireEvent.click(screen.getByText('Look after'));
      fireEvent.click(screen.getByText('Next Exercise'));

      // On third exercise
      fireEvent.click(screen.getByText('I need to rest'));

      expect(screen.getByText('View Results')).toBeInTheDocument();
    });

    it('should update progress bar as exercises are completed', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('Next Exercise'));

      const progressBar = document.querySelector('.bg-gradient-to-r.from-emerald-500');
      const width = progressBar?.getAttribute('style');
      expect(width).toContain('66.66');
    });
  });

  describe('results screen', () => {
    const completeAllExercises = async () => {
      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      // Complete first exercise (correct)
      fireEvent.click(screen.getByText('Exercise'));
      fireEvent.click(screen.getByText('Next Exercise'));

      // Complete second exercise (correct)
      fireEvent.click(screen.getByText('Look after'));
      fireEvent.click(screen.getByText('Next Exercise'));

      // Complete third exercise
      fireEvent.click(screen.getByText('I need to rest'));
      fireEvent.click(screen.getByText('View Results'));
    };

    it('should show results screen after completing all exercises', async () => {
      renderPage();

      await completeAllExercises();

      expect(screen.getByText('Exercises Complete!')).toBeInTheDocument();
    });

    it('should display correct accuracy percentage', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Exercise')).toBeInTheDocument();
      });

      // Answer 2 correct, 1 incorrect (67%)
      fireEvent.click(screen.getByText('Exercise')); // Correct
      fireEvent.click(screen.getByText('Next Exercise'));
      fireEvent.click(screen.getByText('Look after')); // Correct
      fireEvent.click(screen.getByText('Next Exercise'));
      fireEvent.click(screen.getByText('I need to work')); // Wrong
      fireEvent.click(screen.getByText('View Results'));

      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('should display correct count', async () => {
      renderPage();

      await completeAllExercises();

      expect(screen.getByText('3 correct out of 3')).toBeInTheDocument();
    });

    it('should show check circle icon on results screen', async () => {
      renderPage();

      await completeAllExercises();

      const iconContainer = document.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should display total exercise count', async () => {
      renderPage();

      await completeAllExercises();

      expect(screen.getByText("You've finished all 3 exercises")).toBeInTheDocument();
    });

    it('should have Back to Library button', async () => {
      renderPage();

      await completeAllExercises();

      expect(screen.getByText('Back to Library')).toBeInTheDocument();
    });

    it('should navigate to library when Back to Library is clicked', async () => {
      renderPage();

      await completeAllExercises();

      fireEvent.click(screen.getByText('Back to Library'));

      expect(mockNavigate).toHaveBeenCalledWith('/app/library');
    });

    it('should have Back to Create button', async () => {
      renderPage();

      await completeAllExercises();

      expect(screen.getByText('Back to Create')).toBeInTheDocument();
    });

    it('should navigate to create page when Back to Create is clicked', async () => {
      renderPage();

      await completeAllExercises();

      fireEvent.click(screen.getByText('Back to Create'));

      expect(mockNavigate).toHaveBeenCalledWith('/app/create');
    });
  });

  describe('error handling', () => {
    it('should handle API error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

      renderPage();

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to load exercises:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('should show loading spinner when exercises array is empty', () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ exercises: [] }),
      });

      renderPage();

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });
});
