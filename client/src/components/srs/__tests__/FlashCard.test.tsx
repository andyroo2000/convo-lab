/* eslint-disable testing-library/no-node-access */
// Testing flashcard furigana rendering requires direct DOM access to verify ruby tags
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FlashCard from '../FlashCard';

// Mock HTMLMediaElement play method
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

describe('FlashCard', () => {
  describe('sentence with furigana rendering', () => {
    it('should render sentence with full furigana when sentenceReadingL2 has brackets', () => {
      const card = {
        id: '1',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
        sentenceL2: '雪、年末年始の予定は？',
        sentenceReadingL2: '雪[ゆき]、年[ねん]末[まつ]年[ねん]始[し]の予[よ]定[てい]は？',
        sentenceTranslationL1: "Yuki, do you have plans for the New Year's holiday?",
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      // Check that the sentence is rendered (with vocab word highlighted)
      const container = screen.getByRole('button', { name: /flip flashcard/i });
      expect(container).toBeInTheDocument();

      // The vocab word should be in the sentence with indigo color
      const vocabElements = container.querySelectorAll('.text-indigo-600');
      expect(vocabElements.length).toBeGreaterThan(0);
    });

    it('should extract vocab word portion from sentenceReadingL2 correctly', () => {
      const card = {
        id: '2',
        textL2: '本当',
        readingL2: '本当[ほんとう]',
        translationL1: 'really',
        sentenceL2: 'え、本当？すごく嬉しい！',
        sentenceReadingL2: 'え、本[ほん]当[とう]？すごく嬉[うれ]しい！',
        sentenceTranslationL1: "Really? I'm so happy!",
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      const container = screen.getByRole('button', { name: /flip flashcard/i });

      // Should render furigana using ruby tags (not raw brackets)
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);
    });

    it('should handle vocab word with split furigana (e.g., 予[よ]定[てい])', () => {
      const card = {
        id: '3',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
        sentenceL2: '明日の予定は？',
        sentenceReadingL2: '明[あ]日[す]の予[よ]定[てい]は？',
        sentenceTranslationL1: 'What are your plans for tomorrow?',
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      const container = screen.getByRole('button', { name: /flip flashcard/i });

      // Should have furigana rendered with ruby tags
      const rubyElements = container.querySelectorAll('ruby');
      expect(rubyElements.length).toBeGreaterThan(0);

      // Vocab word should be highlighted in indigo
      const vocabElements = container.querySelectorAll('.text-indigo-600');
      expect(vocabElements.length).toBeGreaterThan(0);
    });

    it('should render sentence without furigana when showReading is false', () => {
      const card = {
        id: '4',
        textL2: '何か',
        readingL2: '何[なに]か',
        translationL1: 'something',
        sentenceL2: 'うん！何か食べたいものある？',
        sentenceReadingL2: 'うん！何[なに]か食[た]べたいものある？',
        sentenceTranslationL1: 'Yeah! Is there something you want to eat?',
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading={false}
          language="ja"
          onFlip={vi.fn()}
        />
      );

      const container = screen.getByRole('button', { name: /flip flashcard/i });
      expect(container).toBeInTheDocument();

      // Even without furigana visible, vocab should still be highlighted
      const vocabElements = container.querySelectorAll('.text-indigo-600');
      expect(vocabElements.length).toBeGreaterThan(0);
    });

    it('should handle card without sentence (just vocab word)', () => {
      const card = {
        id: '5',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      const container = screen.getByRole('button', { name: /flip flashcard/i });
      expect(container).toBeInTheDocument();

      // Should show just the vocab word, not a sentence
      expect(screen.getByText('plans')).toBeInTheDocument();
    });

    it('should show sentence translation when available', () => {
      const card = {
        id: '6',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
        sentenceL2: '雪、年末年始の予定は？',
        sentenceReadingL2: '雪[ゆき]、年[ねん]末[まつ]年[ねん]始[し]の予[よ]定[てい]は？',
        sentenceTranslationL1: "Yuki, do you have plans for the New Year's holiday?",
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      // Should show both the vocab translation and sentence translation
      expect(screen.getByText('plans')).toBeInTheDocument();
      expect(
        screen.getByText("Yuki, do you have plans for the New Year's holiday?")
      ).toBeInTheDocument();
    });
  });

  describe('audio card type', () => {
    it('should show play button for audio card front', () => {
      const card = {
        id: '7',
        textL2: '本当',
        readingL2: '本当[ほんとう]',
        translationL1: 'really',
        audioUrl: 'https://example.com/audio.mp3',
      };

      render(
        <FlashCard
          card={card}
          cardType="audio"
          isFlipped={false}
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      // Audio card should show "Listen and recall..." text
      expect(screen.getByText('Listen and recall...')).toBeInTheDocument();
    });

    it('should show vocab on audio card back', () => {
      const card = {
        id: '8',
        textL2: '本当',
        readingL2: '本当[ほんとう]',
        translationL1: 'really',
        audioUrl: 'https://example.com/audio.mp3',
      };

      render(
        <FlashCard
          card={card}
          cardType="audio"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      expect(screen.getByText('really')).toBeInTheDocument();
    });
  });

  describe('recognition card type', () => {
    it('should show vocab word on front', () => {
      const card = {
        id: '9',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped={false}
          showReading={false}
          language="ja"
          onFlip={vi.fn()}
        />
      );

      const container = screen.getByRole('button', { name: /flip flashcard/i });
      expect(container).toBeInTheDocument();

      // Front side should show the vocab word (without furigana since showReading=false)
      expect(container.textContent).toContain('予定');
    });

    it('should show translation on back', () => {
      const card = {
        id: '10',
        textL2: '予定',
        readingL2: '予定[よてい]',
        translationL1: 'plans',
      };

      render(
        <FlashCard
          card={card}
          cardType="recognition"
          isFlipped
          showReading
          language="ja"
          onFlip={vi.fn()}
        />
      );

      expect(screen.getByText('plans')).toBeInTheDocument();
    });
  });
});
