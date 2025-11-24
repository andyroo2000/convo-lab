import { Eye, EyeOff } from 'lucide-react';

interface ViewToggleButtonsProps {
  showReadings: boolean;
  showTranslations: boolean;
  onToggleReadings: () => void;
  onToggleTranslations: () => void;
  readingsLabel?: string; // e.g., "Furigana" or "Pinyin"
}

export default function ViewToggleButtons({
  showReadings,
  showTranslations,
  onToggleReadings,
  onToggleTranslations,
  readingsLabel = 'Furigana',
}: ViewToggleButtonsProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
      {/* Readings Toggle (Furigana/Pinyin) */}
      <button
        onClick={onToggleReadings}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
          showReadings
            ? 'bg-coral text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        title={showReadings ? `Hide ${readingsLabel.toLowerCase()}` : `Show ${readingsLabel.toLowerCase()}`}
        data-testid="playback-toggle-readings"
      >
        {showReadings ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>{readingsLabel}</span>
      </button>

      {/* English Translation Toggle */}
      <button
        onClick={onToggleTranslations}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
          showTranslations
            ? 'bg-coral text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        title={showTranslations ? 'Hide English' : 'Show English'}
        data-testid="playback-toggle-translations"
      >
        {showTranslations ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>English</span>
      </button>
    </div>
  );
}
