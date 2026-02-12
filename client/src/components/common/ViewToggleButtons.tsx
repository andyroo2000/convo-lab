interface ViewToggleButtonsProps {
  showReadings: boolean;
  showTranslations: boolean;
  onToggleReadings: () => void;
  onToggleTranslations: () => void;
  readingsLabel?: string; // e.g., "Furigana"
  className?: string;
}

const ViewToggleButtons = ({
  showReadings,
  showTranslations,
  onToggleReadings,
  onToggleTranslations,
  readingsLabel = 'Furigana',
  className = '',
}: ViewToggleButtonsProps) => (
  <div className={`retro-toggle-row w-full ${className}`}>
    {/* Readings Toggle (Furigana) */}
    <button
      type="button"
      onClick={onToggleReadings}
      className={`retro-toggle-button ${showReadings ? 'is-on' : ''}`}
      title={
        showReadings ? `Hide ${readingsLabel.toLowerCase()}` : `Show ${readingsLabel.toLowerCase()}`
      }
      data-testid="playback-toggle-readings"
    >
      <span className="retro-toggle-switch" aria-hidden="true" />
      <span>{readingsLabel}</span>
    </button>

    {/* English Translation Toggle */}
    <button
      type="button"
      onClick={onToggleTranslations}
      className={`retro-toggle-button ${showTranslations ? 'is-on' : ''}`}
      title={showTranslations ? 'Hide English' : 'Show English'}
      data-testid="playback-toggle-translations"
    >
      <span className="retro-toggle-switch" aria-hidden="true" />
      <span>English</span>
    </button>
  </div>
);

export default ViewToggleButtons;
