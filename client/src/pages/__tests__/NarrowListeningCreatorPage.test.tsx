/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NarrowListeningCreatorPage from '../NarrowListeningCreatorPage';

// Mock hooks
vi.mock('../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => vi.fn(),
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { preferredStudyLanguage: 'ja' },
  }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'narrowListening:pageTitle': 'Narrow Listening Packs',
        'narrowListening:pageSubtitle': 'The same story told 5 different ways for focused listening practice',
        'narrowListening:form.yourStory': 'Your Story',
        'narrowListening:form.whatAbout': 'What should your story be about?',
        'narrowListening:form.topicPlaceholder.ja': "e.g., Tanaka's weekend activities or a day at the office",
        'narrowListening:form.topicPlaceholder.zh': "e.g., Wang Wei's weekend activities or a day at the office",
        'narrowListening:form.topicPlaceholder.es': "e.g., María's weekend activities or a day at the office",
        'narrowListening:form.topicHelper': 'Describe what you want your story to be about',
        'narrowListening:form.targetJLPT': 'Target JLPT Level',
        'narrowListening:form.targetHSK': 'Target HSK Level',
        'narrowListening:form.targetCEFR': 'Target CEFR Level',
        'narrowListening:form.jlpt.n5': 'N5 (Beginner)',
        'narrowListening:form.jlpt.n4': 'N4',
        'narrowListening:form.jlpt.n3': 'N3',
        'narrowListening:form.jlpt.n2': 'N2',
        'narrowListening:form.jlpt.n1': 'N1 (Advanced)',
        'narrowListening:form.hsk.hsk1': 'HSK 1 (Beginner)',
        'narrowListening:form.hsk.hsk2': 'HSK 2',
        'narrowListening:form.hsk.hsk3': 'HSK 3',
        'narrowListening:form.hsk.hsk4': 'HSK 4',
        'narrowListening:form.hsk.hsk5': 'HSK 5',
        'narrowListening:form.hsk.hsk6': 'HSK 6 (Advanced)',
        'narrowListening:form.cefr.a1': 'A1 (Beginner)',
        'narrowListening:form.cefr.a2': 'A2',
        'narrowListening:form.cefr.b1': 'B1',
        'narrowListening:form.cefr.b2': 'B2',
        'narrowListening:form.cefr.c1': 'C1',
        'narrowListening:form.cefr.c2': 'C2 (Advanced)',
        'narrowListening:form.levelHelper': 'Choose the appropriate level',
        'narrowListening:form.grammarFocus': 'Grammar Focus (Optional)',
        'narrowListening:form.grammarPlaceholder': 'e.g., past vs present tense',
        'narrowListening:form.grammarHelper': 'Optionally specify a grammar point to focus on',
        'narrowListening:info.title': 'What is Narrow Listening?',
        'narrowListening:info.description': 'Narrow listening description',
        'narrowListening:info.features.versions': '5 versions of the same story with different grammar patterns',
        'narrowListening:info.features.slowAudio': 'Slow audio (0.7x speed) for shadowing practice',
        'narrowListening:info.features.normalAudio': 'Normal speed audio for listening practice',
        'narrowListening:info.features.textJa': 'Japanese text with furigana',
        'narrowListening:info.features.textZh': 'Chinese text with pinyin',
        'narrowListening:info.features.textEs': 'Spanish text with translations',
        'narrowListening:info.features.textFr': 'French text with translations',
        'narrowListening:actions.cancel': 'Cancel',
        'narrowListening:actions.generate': 'Generate Pack',
        'narrowListening:actions.generating': 'Generating...',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock DemoRestrictionModal
vi.mock('../../components/common/DemoRestrictionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="demo-modal">Demo Modal</div> : null,
}));

// Mock fetch
global.fetch = vi.fn();

describe('NarrowListeningCreatorPage', () => {
  const renderPage = () =>
    render(
      <BrowserRouter>
        <NarrowListeningCreatorPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      renderPage();
      expect(screen.getByText('Narrow Listening Packs')).toBeInTheDocument();
    });

    it('should render the subtitle', () => {
      renderPage();
      expect(
        screen.getByText('The same story told 5 different ways for focused listening practice')
      ).toBeInTheDocument();
    });

    it('should render Your Story section header', () => {
      renderPage();
      expect(screen.getByText('Your Story')).toBeInTheDocument();
    });

    it('should render What is Narrow Listening explanation', () => {
      renderPage();
      expect(screen.getByText('What is Narrow Listening?')).toBeInTheDocument();
    });
  });


  describe('proficiency level selection', () => {
    it('should show JLPT levels when Japanese is selected', () => {
      renderPage();
      expect(screen.getByText('Target JLPT Level')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('N5');
    });

    it('should allow changing JLPT level', () => {
      renderPage();
      const select = screen.getByRole('combobox');

      fireEvent.change(select, { target: { value: 'N3' } });

      expect(select).toHaveValue('N3');
    });
  });

  describe('topic input', () => {
    it('should render topic textarea', () => {
      renderPage();
      expect(screen.getByPlaceholderText(/Tanaka's weekend activities/)).toBeInTheDocument();
    });

    it('should update topic when typing', () => {
      renderPage();
      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);

      fireEvent.change(textarea, { target: { value: 'My test topic' } });

      expect(textarea).toHaveValue('My test topic');
    });
  });

  describe('grammar focus', () => {
    it('should render grammar focus input', () => {
      renderPage();
      expect(screen.getByPlaceholderText('e.g., past vs present tense')).toBeInTheDocument();
    });

    it('should show Grammar Focus label', () => {
      renderPage();
      expect(screen.getByText('Grammar Focus (Optional)')).toBeInTheDocument();
    });
  });

  describe('buttons', () => {
    it('should render Cancel button', () => {
      renderPage();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render Generate Pack button', () => {
      renderPage();
      expect(screen.getByText('Generate Pack')).toBeInTheDocument();
    });

    it('should disable Generate button when topic is empty', () => {
      renderPage();
      const generateButton = screen.getByText('Generate Pack').closest('button');
      expect(generateButton).toBeDisabled();
    });

    it('should enable Generate button when topic is entered', () => {
      renderPage();
      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);
      fireEvent.change(textarea, { target: { value: 'My topic' } });

      const generateButton = screen.getByText('Generate Pack').closest('button');
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('info section', () => {
    it('should describe 5 versions', () => {
      renderPage();
      expect(
        screen.getByText('• 5 versions of the same story with different grammar patterns')
      ).toBeInTheDocument();
    });

    it('should mention slow audio', () => {
      renderPage();
      expect(
        screen.getByText('• Slow audio (0.7x speed) for shadowing practice')
      ).toBeInTheDocument();
    });

    it('should mention furigana for Japanese', () => {
      renderPage();
      expect(screen.getByText(/Japanese text with furigana/)).toBeInTheDocument();
    });
  });

  describe('button state', () => {
    it('should disable Generate button for whitespace-only topic', () => {
      renderPage();

      const textarea = screen.getByPlaceholderText(/Tanaka's weekend activities/);
      fireEvent.change(textarea, { target: { value: '   ' } });

      const generateButton = screen.getByText('Generate Pack').closest('button');
      // Button should be disabled because trimmed topic is empty
      expect(generateButton).toBeDisabled();
    });
  });
});
