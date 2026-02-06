import React from 'react';
import { LessonScriptUnit, LanguageCode } from '../types';
import JapaneseText from './JapaneseText';

interface CurrentTextDisplayProps {
  currentUnit: LessonScriptUnit | null;
  targetLanguage: LanguageCode;
  showReadings: boolean;
  showTranslations: boolean;
}

/**
 * Display the current target language (L2) text being spoken during audio course playback
 *
 * Features:
 * - Only shows when L2 is actively speaking (currentUnit non-null)
 * - Large, prominent text display with subtle background
 * - Smooth fade-in/fade-out transition (200ms)
 * - Supports furigana (Japanese) with toggle
 */
const CurrentTextDisplay: React.FC<CurrentTextDisplayProps> = ({
  currentUnit,
  targetLanguage,
  showReadings,
  showTranslations,
}) => {
  // Check if we have L2 content to display
  const hasL2Content = currentUnit && currentUnit.type === 'L2';
  const text = hasL2Content ? currentUnit.text : '';
  const reading = hasL2Content ? currentUnit.reading : undefined;
  const translation = hasL2Content ? currentUnit.translation : undefined;

  // Determine how to render text based on language
  const renderText = () => {
    if (!hasL2Content) {
      return null;
    }

    if (targetLanguage === 'ja') {
      // Japanese with optional furigana
      // Prefer reading (which should be bracket notation like "北[ほっ]海[かい]道[どう]")
      // Fall back to plain text if reading not available
      const displayText = reading || text;
      return (
        <JapaneseText
          text={displayText}
          showFurigana={showReadings}
          className="text-3xl font-medium"
        />
      );
    }
    // Other languages: plain text display
    return <div className="text-3xl font-medium">{text}</div>;
  };

  return (
    <div
      className="
        min-h-[120px]
        flex items-center justify-center
        px-6 py-8
        bg-blue-50
        rounded-lg
        shadow-sm
      "
    >
      <div
        className="text-center max-w-4xl transition-opacity duration-200"
        style={{
          opacity: hasL2Content ? 1 : 0,
        }}
      >
        {renderText()}
        <div className="mt-4 text-lg text-gray-600 min-h-[28px]">
          {showTranslations && translation && translation}
        </div>
      </div>
    </div>
  );
};

export default CurrentTextDisplay;
