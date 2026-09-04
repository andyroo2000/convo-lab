import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SpeedValue } from '../common/SpeedSelector';
import { Episode } from '../../types';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import useScriptImageRetry from './useScriptImageRetry';
import useAudioScriptPlaybackUi from './useAudioScriptPlaybackUi';
import useAudioScriptPlaybackModel from './useAudioScriptPlaybackModel';
import AudioScriptPlaybackView from './AudioScriptPlaybackView';

interface AudioScriptPlaybackProps {
  episode: Episode;
}

const AudioScriptPlayback = ({ episode }: AudioScriptPlaybackProps) => {
  const { audioRef, currentTime, duration, isPlaying, seek, play, pause } = useAudioPlayer();
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedValue>('0.85x');
  const [showReadings, setShowReadings] = useState(false);
  const [showTranslations, setShowTranslations] = useState(true);
  const { imageRetryError, isRetryingImages, retryImages, scriptOverride } = useScriptImageRetry(
    episode.id
  );

  const {
    activeImageUrl,
    activeSegment,
    activeSegmentIndex,
    canRetryImages,
    currentUnit,
    displaySegment,
    script,
    selectedAudioUrl,
    selectedRender,
    timingData,
  } = useAudioScriptPlaybackModel({
    currentTime,
    duration,
    episode,
    scriptOverride,
    selectedSpeed,
  });
  const {
    cinemaVisible,
    closeCinemaMode,
    handleSegmentKeyDown,
    headerRef: stickyHeaderRef,
    imageRef: stickyImageRef,
    imageTop: readerImageTop,
    lineScrollMarginTop: readerLineScrollMarginTop,
    openCinemaMode,
    seekToSegment,
    segmentRefs,
  } = useAudioScriptPlaybackUi({
    activeSegmentIndex,
    cinemaEnabled: Boolean(script && selectedRender?.audioUrl),
    controls: { isPlaying, pause, play, seek },
    episodeId: episode.id,
    selectedAudioUrl,
    timingData,
  });

  if (!script) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="retro-paper-panel p-8 text-center">
          <p className="text-navy">Script not found.</p>
          <Link to="/app/library" className="btn-primary mt-4 inline-flex">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AudioScriptPlaybackView
      header={{
        audioRef,
        episodeTitle: episode.title,
        onOpenCinema: openCinemaMode,
        onSpeedChange: setSelectedSpeed,
        onToggleReadings: () => setShowReadings(!showReadings),
        onToggleTranslations: () => setShowTranslations(!showTranslations),
        pause,
        script,
        seek,
        selectedAudioUrl,
        selectedSpeed,
        showReadings,
        showTranslations,
        stickyHeaderRef,
      }}
      cinema={{
        activeImageUrl,
        activeSegment,
        currentUnit,
        episodeTitle: episode.title,
        onClose: closeCinemaMode,
        show: cinemaVisible,
        showReadings,
        showTranslations,
      }}
      activeImage={{
        activeImageUrl,
        canRetryImages,
        displaySegment,
        imageRetryError,
        isRetryingImages,
        onRetryImages: retryImages,
        script,
        stickyImageRef,
        top: readerImageTop,
      }}
      readerLines={{
        activeSegmentIndex,
        lineScrollMarginTop: readerLineScrollMarginTop,
        onKeyDown: handleSegmentKeyDown,
        onSelect: seekToSegment,
        script,
        segmentRefs,
        showReadings,
        showTranslations,
      }}
    />
  );
};

export default AudioScriptPlayback;
