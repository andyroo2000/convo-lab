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
  sentenceTranslationL1?: string | null;
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

  const renderSentenceWithHighlight = () => {
    // Render full sentence with vocabulary word highlighted
    const hasSentence = card.sentenceL2 && card.sentenceL2 !== card.textL2;

    if (!hasSentence) {
      return null;
    }

    // Always split based on plain text to ensure vocab word is found
    const plainSentence = card.sentenceL2!;
    const vocabWord = card.textL2;
    const vocabReading = card.readingL2 || card.textL2;
    const sentenceReading = card.sentenceReadingL2 || plainSentence;

    // Find the position of the vocab word in the plain sentence
    const vocabIndex = plainSentence.indexOf(vocabWord);

    if (vocabIndex !== -1) {
      // Split the sentence into before, vocab, and after parts
      const before = plainSentence.substring(0, vocabIndex);
      const after = plainSentence.substring(vocabIndex + vocabWord.length);

      // For reading version, extract the corresponding parts from sentenceReading
      let beforeReading = before;
      let afterReading = after;

      // Extract vocab word reading from sentence for highlighting
      let vocabReadingFromSentence = vocabReading;

      if (sentenceReading !== plainSentence) {
        // We need to map positions from plain sentence to reading sentence
        // The challenge: vocab word might have brackets interspersed (e.g., "本[ほん]当[とう]")
        // So we can't just use indexOf directly

        // Build a mapping by walking through both strings
        let plainPos = 0;
        let readingPos = 0;
        let vocabStartReading = -1;
        let vocabEndReading = -1;

        while (plainPos < plainSentence.length && readingPos < sentenceReading.length) {
          // Mark the start of vocab word in reading string
          if (plainPos === vocabIndex && vocabStartReading === -1) {
            vocabStartReading = readingPos;
          }

          // Mark the end of vocab word in reading string
          if (plainPos === vocabIndex + vocabWord.length && vocabEndReading === -1) {
            // Check if there's a bracket following (for the last character's furigana)
            if (sentenceReading[readingPos] === '[') {
              const closeBracket = sentenceReading.indexOf(']', readingPos);
              if (closeBracket !== -1) {
                vocabEndReading = closeBracket + 1;
              } else {
                vocabEndReading = readingPos;
              }
            } else {
              vocabEndReading = readingPos;
            }
            break;
          }

          // Check if current position in reading has a bracket (furigana annotation)
          if (sentenceReading[readingPos] === '[') {
            // Skip to the closing bracket
            const closeBracket = sentenceReading.indexOf(']', readingPos);
            if (closeBracket !== -1) {
              readingPos = closeBracket + 1;
            } else {
              readingPos += 1;
            }
          } else if (plainSentence[plainPos] === sentenceReading[readingPos]) {
            // Regular character - advance both positions
            plainPos += 1;
            readingPos += 1;
          } else {
            // Mismatch - fall back to simple approach
            break;
          }
        }

        if (vocabStartReading !== -1 && vocabEndReading !== -1) {
          beforeReading = sentenceReading.substring(0, vocabStartReading);
          vocabReadingFromSentence = sentenceReading.substring(vocabStartReading, vocabEndReading);
          afterReading = sentenceReading.substring(vocabEndReading);
        }
      }

      // Render with highlighted vocabulary word
      if (language === 'ja') {
        return (
          <div className="text-xl text-gray-600">
            <JapaneseText text={beforeReading} showFurigana={showReading} />
            <JapaneseText
              text={vocabReadingFromSentence}
              showFurigana={showReading}
              className="text-indigo-600 font-bold"
            />
            <JapaneseText text={afterReading} showFurigana={showReading} />
          </div>
        );
      }
      if (language === 'zh') {
        return (
          <div className="text-xl text-gray-600">
            <ChineseText text={beforeReading} showPinyin={showReading} />
            <ChineseText
              text={vocabReadingFromSentence}
              showPinyin={showReading}
              className="text-indigo-600 font-bold"
            />
            <ChineseText text={afterReading} showPinyin={showReading} />
          </div>
        );
      }
      return (
        <div className="text-xl text-gray-600">
          {before}
          <span className="text-indigo-600 font-bold">{vocabWord}</span>
          {after}
        </div>
      );
    }

    // Word not found in sentence - just show sentence
    const displayText = sentenceReading;
    if (language === 'ja') {
      return (
        <div className="text-xl text-gray-600">
          <JapaneseText text={displayText} showFurigana={showReading} />
        </div>
      );
    }
    if (language === 'zh') {
      return (
        <div className="text-xl text-gray-600">
          <ChineseText text={displayText} showPinyin={showReading} />
        </div>
      );
    }
    return <div className="text-xl text-gray-600">{displayText}</div>;
  };

  const renderVocabWord = () => {
    // Render standalone vocabulary word
    // Always prefer readingL2 (with bracket notation) if available
    const displayText = card.readingL2 || card.textL2;

    if (language === 'ja') {
      return <JapaneseText text={displayText} showFurigana={showReading} />;
    }
    if (language === 'zh') {
      return <ChineseText text={displayText} showPinyin={showReading} />;
    }
    return <span className="text-4xl">{displayText}</span>;
  };

  const renderTextL2Back = () => {
    // Back side: Show full sentence with vocabulary word highlighted, or just the word if no sentence
    const hasSentence = card.sentenceL2 && card.sentenceL2 !== card.textL2;

    if (hasSentence) {
      return null; // Sentence and vocab word are rendered separately now
    }

    // No sentence - show just the vocabulary word (original behavior)
    return renderVocabWord();
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
                {/* Sentence with highlighted word (if available) */}
                {renderSentenceWithHighlight() && (
                  <div className="text-center mb-4">{renderSentenceWithHighlight()}</div>
                )}
                {/* Sentence translation - only show if there's a different sentence */}
                {card.sentenceTranslationL1 &&
                  card.sentenceL2 &&
                  card.sentenceL2 !== card.textL2 && (
                    <p className="text-base text-gray-500 text-center mb-4 font-serif italic">
                      {card.sentenceTranslationL1}
                    </p>
                  )}
                {/* Audio button */}
                {card.audioUrl && (
                  <button
                    type="button"
                    onClick={playAudio}
                    className="mb-4 p-3 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Play size={40} className="text-gray-700" />
                  </button>
                )}
                {/* Horizontal line */}
                <div className="w-full border-t border-gray-300 mb-6" />
                {/* Standalone vocabulary word */}
                <div className="text-center mb-6 text-3xl font-medium">{renderVocabWord()}</div>
                {/* Translation */}
                <p className="text-xl text-gray-700 text-center font-serif leading-relaxed">
                  {card.translationL1}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 px-8">
                {/* Sentence with highlighted word (if available) or just vocab word */}
                {renderSentenceWithHighlight() ? (
                  <>
                    <div className="text-center">{renderSentenceWithHighlight()}</div>
                    {/* Sentence translation - only show if there's a different sentence */}
                    {card.sentenceTranslationL1 &&
                      card.sentenceL2 &&
                      card.sentenceL2 !== card.textL2 && (
                        <p className="text-base text-gray-500 text-center font-serif italic">
                          {card.sentenceTranslationL1}
                        </p>
                      )}
                    <div className="w-full border-t border-gray-300" />
                    <div className="text-center text-3xl font-medium">{renderVocabWord()}</div>
                  </>
                ) : (
                  <div className="text-center">{renderTextL2Back()}</div>
                )}
                {/* Translation */}
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
