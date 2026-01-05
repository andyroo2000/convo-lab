import { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import JapaneseText from '../JapaneseText';
import ChineseText from '../ChineseText';

interface Card {
  id: string;
  textL2: string;
  readingL2?: string | null;
  translationL1: string;
  audioUrl?: string | null;
  sentenceL2?: string | null;
  sentenceReadingL2?: string | null;
}

interface FlashCardProps {
  card: Card;
  cardType: 'recognition' | 'audio';
  isFlipped: boolean;
  showReading: boolean;
  language: string;
  onFlip: () => void;
}

const FlashCard = ({
  card,
  cardType,
  isFlipped,
  showReading,
  language,
  onFlip,
}: FlashCardProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-play audio for audio cards on mount or when flipping to back for recognition cards
  useEffect(() => {
    if (audioRef.current && card.audioUrl) {
      if (cardType === 'audio' && !isFlipped) {
        // Auto-play audio card front side
        audioRef.current.play().catch(() => {
          // Ignore audio play errors
        });
      } else if (cardType === 'recognition' && isFlipped) {
        // Auto-play audio on recognition card back side
        audioRef.current.play().catch(() => {
          // Ignore audio play errors
        });
      }
    }
  }, [cardType, isFlipped, card.audioUrl]);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const renderTextL2Front = () => {
    // Front side: Always show plain text (textL2) without furigana
    if (language === 'ja') {
      return <JapaneseText text={card.textL2} showFurigana={false} />;
    }
    if (language === 'zh') {
      return <ChineseText text={card.textL2} showPinyin={false} />;
    }
    return <span className="text-4xl">{card.textL2}</span>;
  };

  const renderTextL2Back = () => {
    // Back side: Show full sentence with vocabulary word highlighted, or just the word if no sentence
    const hasSentence = card.sentenceL2 && card.sentenceL2 !== card.textL2;

    if (hasSentence) {
      // Show sentence with highlighted vocabulary word
      const sentenceText = showReading && card.sentenceReadingL2 ? card.sentenceReadingL2 : card.sentenceL2!;

      // Split sentence at the vocabulary word to highlight it
      const vocabWord = card.textL2;
      const parts = sentenceText.split(vocabWord);

      if (parts.length > 1) {
        // Found the word in the sentence - highlight it
        if (language === 'ja') {
          return (
            <div className="text-2xl">
              <JapaneseText text={parts[0]} showFurigana={showReading} />
              <span className="text-indigo-600 font-bold">
                <JapaneseText text={vocabWord} showFurigana={showReading} />
              </span>
              <JapaneseText text={parts.slice(1).join(vocabWord)} showFurigana={showReading} />
            </div>
          );
        }
        if (language === 'zh') {
          return (
            <div className="text-2xl">
              <ChineseText text={parts[0]} showPinyin={showReading} />
              <span className="text-indigo-600 font-bold">
                <ChineseText text={vocabWord} showPinyin={showReading} />
              </span>
              <ChineseText text={parts.slice(1).join(vocabWord)} showPinyin={showReading} />
            </div>
          );
        }
        return (
          <div className="text-2xl">
            {parts[0]}
            <span className="text-indigo-600 font-bold">{vocabWord}</span>
            {parts.slice(1).join(vocabWord)}
          </div>
        );
      }

      // Word not found in sentence - just show sentence
      if (language === 'ja') {
        return <div className="text-2xl"><JapaneseText text={sentenceText} showFurigana={showReading} /></div>;
      }
      if (language === 'zh') {
        return <div className="text-2xl"><ChineseText text={sentenceText} showPinyin={showReading} /></div>;
      }
      return <div className="text-2xl">{sentenceText}</div>;
    }

    // No sentence - show just the vocabulary word (original behavior)
    const hasFuriganaBrackets = card.readingL2?.includes('[');
    const displayText = hasFuriganaBrackets ? card.readingL2! : card.textL2;

    if (language === 'ja') {
      return <JapaneseText text={displayText} showFurigana={showReading} />;
    }
    if (language === 'zh') {
      const hasPinyinBrackets = card.readingL2?.includes('[');
      const chineseText = hasPinyinBrackets ? card.readingL2! : card.textL2;
      return <ChineseText text={chineseText} showPinyin={showReading} />;
    }
    return <span className="text-4xl">{displayText}</span>;
  };

  return (
    <div className="flashcard-container">
      {/* Audio element - persistent outside flip animation */}
      {card.audioUrl && <audio ref={audioRef} src={card.audioUrl} />}

      <div
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onFlip();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Flip flashcard"
      >
        <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
          {/* Front Side */}
          <div className="flashcard-front">
            {cardType === 'recognition' ? (
              <div className="flex flex-col items-center justify-center px-8">
                <div className="text-center">{renderTextL2Front()}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={playAudio}
                  className="audio-icon-container hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <Play size={80} className="text-indigo-500" />
                </button>
                <p className="text-gray-500 text-lg">Listen and recall...</p>
              </div>
            )}
          </div>

          {/* Back Side */}
          <div className="flashcard-back">
            {cardType === 'recognition' ? (
              <div className="flex flex-col items-center justify-center px-8 py-6">
                <div className="text-center mb-4">{renderTextL2Back()}</div>
                {card.audioUrl && (
                  <button
                    type="button"
                    onClick={playAudio}
                    className="mb-6 p-3 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Play size={40} className="text-gray-700" />
                  </button>
                )}
                <div className="w-full border-t border-gray-300 mb-6" />
                <p className="text-xl text-gray-700 text-center font-serif leading-relaxed">
                  {card.translationL1}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 px-8">
                <div className="text-center">{renderTextL2Back()}</div>
                <div className="w-full border-t border-gray-300" />
                <p className="text-xl text-gray-700 text-center font-serif leading-relaxed">
                  {card.translationL1}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Click to flip instruction */}
        {!isFlipped && (
          <p className="text-center text-gray-500 mt-4 text-sm">
            Click card or press Space to flip
          </p>
        )}
      </div>
    </div>
  );
};

export default FlashCard;
