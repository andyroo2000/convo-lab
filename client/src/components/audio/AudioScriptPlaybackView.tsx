import type { KeyboardEvent, MutableRefObject, RefObject } from 'react';

import type { SpeedValue } from '../common/SpeedSelector';
import type { AudioScript, AudioScriptSegment, LessonScriptUnit } from '../../types';
import AudioPlayer from '../AudioPlayer';
import JapaneseText from '../JapaneseText';
import SpeedSelector from '../common/SpeedSelector';
import ViewToggleButtons from '../common/ViewToggleButtons';

const SCRIPT_SPEED_OPTIONS = [
  { value: '0.75x' as const, label: 'Slow', numericValue: 0.75 },
  { value: '0.85x' as const, label: 'Medium', numericValue: 0.85 },
  { value: '1.0x' as const, label: 'Normal', numericValue: 1.0 },
];

export interface PlaybackHeaderView {
  audioRef: (element: HTMLAudioElement | null) => void;
  episodeTitle: string;
  onOpenCinema: () => void;
  onSpeedChange: (speed: SpeedValue) => void;
  onToggleReadings: () => void;
  onToggleTranslations: () => void;
  pause: () => void;
  script: AudioScript;
  seek: (time: number) => void;
  selectedAudioUrl: string | null;
  selectedSpeed: SpeedValue;
  showReadings: boolean;
  showTranslations: boolean;
  stickyHeaderRef: RefObject<HTMLDivElement>;
}

const PlaybackHeader = ({
  audioRef,
  episodeTitle,
  onOpenCinema,
  onSpeedChange,
  onToggleReadings,
  onToggleTranslations,
  pause,
  script,
  seek,
  selectedAudioUrl,
  selectedSpeed,
  showReadings,
  showTranslations,
  stickyHeaderRef,
}: PlaybackHeaderView) => (
  <div ref={stickyHeaderRef} className="sticky top-[4.5rem] z-10 mb-3 bg-[rgba(251,245,224,0.98)]">
    <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.18)] shadow-[0_6px_0_rgba(17,51,92,0.08)] px-4 py-2.5 sm:px-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="retro-headline text-3xl sm:text-5xl">{episodeTitle}</h1>
          {selectedAudioUrl ? (
            <div className="mt-1.5 max-w-4xl">
              <AudioPlayer
                src={selectedAudioUrl}
                audioRef={audioRef}
                variant="compact"
                onEnded={() => {
                  pause();
                  seek(0);
                }}
              />
            </div>
          ) : (
            <div className="mt-2 bg-yellow p-3 text-sm font-medium text-dark-brown">
              {script.status === 'error'
                ? script.errorMessage || 'Script audio generation failed.'
                : 'Script audio is not ready yet.'}
            </div>
          )}
        </div>

        {selectedAudioUrl ? (
          <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-6">
            <ViewToggleButtons
              showReadings={showReadings}
              showTranslations={showTranslations}
              onToggleReadings={onToggleReadings}
              onToggleTranslations={onToggleTranslations}
              readingsLabel="Furigana"
            />
            <SpeedSelector
              selectedSpeed={selectedSpeed}
              onSpeedChange={onSpeedChange}
              options={SCRIPT_SPEED_OPTIONS}
              showLabels
            />
            <button
              type="button"
              onClick={onOpenCinema}
              className="btn-secondary inline-flex justify-center"
              data-testid="script-button-movie-mode"
            >
              Movie mode
            </button>
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

interface CinemaIllustrationProps {
  activeImageUrl: string | null | undefined;
  activeSegment: AudioScriptSegment | null;
}

const CinemaIllustration = ({ activeImageUrl, activeSegment }: CinemaIllustrationProps) =>
  activeImageUrl ? (
    <img
      src={activeImageUrl}
      alt={activeSegment?.translation || 'Script scene illustration'}
      className="max-h-full max-w-full object-contain"
      data-testid="script-cinema-image"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center px-4 text-center retro-caps text-white/45">
      Illustration pending
    </div>
  );

interface CinemaCaptionProps {
  activeSegment: AudioScriptSegment | null;
  currentUnit: LessonScriptUnit | null;
  showReadings: boolean;
  showTranslations: boolean;
}

const CinemaCaption = ({
  activeSegment,
  currentUnit,
  showReadings,
  showTranslations,
}: CinemaCaptionProps) => {
  if (currentUnit?.type !== 'L2') return null;

  return (
    <div
      className="pointer-events-auto max-h-[34vh] w-fit max-w-[min(92vw,64rem)] overflow-y-auto rounded-md border border-white/20 bg-[rgba(4,16,28,0.68)] px-3 py-2 text-center shadow-[0_18px_52px_rgba(0,0,0,0.52)] backdrop-blur-md sm:px-5 sm:py-3"
      data-testid="script-cinema-caption"
    >
      <div
        className="text-2xl font-semibold leading-relaxed text-[#fff3b0] sm:text-4xl"
        style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)' }}
      >
        <JapaneseText
          text={currentUnit.reading || currentUnit.text}
          showFurigana={showReadings}
          metadata={activeSegment?.metadata}
          style={{ color: '#fff3b0' }}
        />
      </div>
      {showTranslations && currentUnit.translation ? (
        <div
          className="mx-auto mt-2 max-w-4xl text-base font-medium leading-snug text-[rgba(255,255,255,0.9)] sm:text-xl"
          style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.75)' }}
        >
          {currentUnit.translation}
        </div>
      ) : null}
    </div>
  );
};

export interface CinemaView extends CinemaCaptionProps, CinemaIllustrationProps {
  episodeTitle: string;
  onClose: () => void;
  show: boolean;
}

const CinemaOverlay = ({
  activeImageUrl,
  activeSegment,
  currentUnit,
  episodeTitle,
  onClose,
  show,
  showReadings,
  showTranslations,
}: CinemaView) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-[#061522] text-white"
      data-testid="script-cinema-overlay"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/15 bg-black/30 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="retro-caps text-xs text-white/60">Script</div>
          <div className="truncate text-lg font-semibold">{episodeTitle}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          Exit
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-2 sm:p-4">
        <CinemaIllustration activeImageUrl={activeImageUrl} activeSegment={activeSegment} />
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:bottom-6 sm:px-8">
          <CinemaCaption
            activeSegment={activeSegment}
            currentUnit={currentUnit}
            showReadings={showReadings}
            showTranslations={showTranslations}
          />
        </div>
      </div>
    </div>
  );
};

interface ActiveIllustrationProps {
  activeImageUrl: string | null | undefined;
  displaySegment: AudioScriptSegment | null;
}

const ActiveIllustration = ({ activeImageUrl, displaySegment }: ActiveIllustrationProps) =>
  activeImageUrl ? (
    <img
      src={activeImageUrl}
      alt={displaySegment?.translation || 'Script scene illustration'}
      className="max-h-full max-w-full object-contain"
      data-testid="script-active-image"
    />
  ) : (
    <div className="flex h-full items-center justify-center px-4 text-center retro-caps text-[rgba(20,50,86,0.48)]">
      Illustration pending
    </div>
  );

interface ImageRetryControlsProps {
  canRetryImages: boolean;
  imageRetryError: string | null;
  isRetryingImages: boolean;
  onRetryImages: () => void;
  scriptImageError: string | null | undefined;
}

const ImageRetryControls = ({
  canRetryImages,
  imageRetryError,
  isRetryingImages,
  onRetryImages,
  scriptImageError,
}: ImageRetryControlsProps) => {
  if (!canRetryImages && !imageRetryError) return null;

  return (
    <div className="flex flex-col gap-2 border-t-2 border-[rgba(20,50,86,0.08)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-[rgba(20,50,86,0.72)]">
        {imageRetryError || scriptImageError || 'Some illustrations are missing.'}
      </p>
      {canRetryImages ? (
        <button
          type="button"
          onClick={onRetryImages}
          disabled={isRetryingImages}
          className="btn-secondary inline-flex justify-center"
          data-testid="script-button-retry-images"
        >
          {isRetryingImages ? 'Retrying...' : 'Retry images'}
        </button>
      ) : null}
    </div>
  );
};

export interface ActiveImageView
  extends ActiveIllustrationProps, Omit<ImageRetryControlsProps, 'scriptImageError'> {
  script: AudioScript;
  stickyImageRef: RefObject<HTMLDivElement>;
  top: string;
}

const ActiveImagePanel = ({
  activeImageUrl,
  canRetryImages,
  displaySegment,
  imageRetryError,
  isRetryingImages,
  onRetryImages,
  script,
  stickyImageRef,
  top,
}: ActiveImageView) => (
  <div
    ref={stickyImageRef}
    className="retro-paper-panel sticky z-[8] mx-auto max-w-4xl overflow-hidden border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.96)] shadow-[0_10px_0_rgba(17,51,92,0.08)]"
    style={{ top }}
    data-testid="script-active-image-panel"
  >
    <div className="flex h-[min(34vh,22rem)] min-h-[11rem] w-full items-center justify-center bg-[rgba(20,50,86,0.08)] p-2 sm:p-3">
      <ActiveIllustration activeImageUrl={activeImageUrl} displaySegment={displaySegment} />
    </div>
    <ImageRetryControls
      canRetryImages={canRetryImages}
      imageRetryError={imageRetryError}
      isRetryingImages={isRetryingImages}
      onRetryImages={onRetryImages}
      scriptImageError={script.imageErrorMessage}
    />
  </div>
);

export interface ReaderLinesView {
  activeSegmentIndex: number;
  lineScrollMarginTop: string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onSelect: (index: number) => void;
  script: AudioScript;
  segmentRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  showReadings: boolean;
  showTranslations: boolean;
}

function setSegmentRef(
  segmentRefs: MutableRefObject<Array<HTMLButtonElement | null>>,
  index: number,
  element: HTMLButtonElement | null
) {
  const elements = segmentRefs.current;
  elements[index] = element;
}

const ReaderLines = ({
  activeSegmentIndex,
  lineScrollMarginTop,
  onKeyDown,
  onSelect,
  script,
  segmentRefs,
  showReadings,
  showTranslations,
}: ReaderLinesView) => (
  <div className="mx-auto max-w-4xl space-y-3" data-testid="script-reader-lines">
    {script.segments.map((segment, index) => (
      <button
        key={segment.id}
        ref={(element) => {
          setSegmentRef(segmentRefs, index, element);
        }}
        type="button"
        onClick={() => onSelect(index)}
        onKeyDown={(event) => onKeyDown(event, index)}
        className={`retro-paper-panel w-full text-left p-4 transition ${
          activeSegmentIndex === index
            ? 'border-2 border-[rgba(20,50,86,0.32)] bg-[rgba(247,199,68,0.38)] shadow-[0_8px_0_rgba(17,51,92,0.12)]'
            : 'bg-[rgba(255,255,255,0.55)]'
        }`}
        style={{ scrollMarginTop: lineScrollMarginTop }}
        data-active={activeSegmentIndex === index ? 'true' : 'false'}
        data-testid="script-segment-row"
      >
        <div className="text-2xl text-navy leading-relaxed">
          <JapaneseText
            text={segment.reading || segment.text}
            showFurigana={showReadings}
            metadata={segment.metadata}
          />
        </div>
        {showTranslations ? (
          <div className="mt-2 text-base text-[rgba(20,50,86,0.72)]">{segment.translation}</div>
        ) : null}
      </button>
    ))}
  </div>
);

interface AudioScriptPlaybackViewProps {
  activeImage: ActiveImageView;
  cinema: CinemaView;
  header: PlaybackHeaderView;
  readerLines: ReaderLinesView;
}

const AudioScriptPlaybackView = ({
  activeImage,
  cinema,
  header,
  readerLines,
}: AudioScriptPlaybackViewProps) => (
  <div
    className="retro-playback-v3-page w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-3"
    data-testid="script-playback-page"
  >
    <PlaybackHeader {...header} />
    <CinemaOverlay {...cinema} />
    <ActiveImagePanel {...activeImage} />
    <ReaderLines {...readerLines} />
  </div>
);

export default AudioScriptPlaybackView;
