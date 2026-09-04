import { useEffect, useRef, useState } from 'react';

import type { DailyAudioPracticeTiming } from '../../types';
import { shouldIgnoreGlobalShortcut } from '../../lib/keyboardShortcuts';

interface PlaybackControls {
  isPlaying: boolean;
  pause: () => void;
  play: () => void;
  seek: (time: number) => void;
}

function isSegmentActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

function usePlaybackShortcut(
  selectedAudioUrl: string | null,
  { isPlaying, pause, play }: PlaybackControls
) {
  useEffect(() => {
    if (!selectedAudioUrl) return undefined;

    const handlePlaybackShortcut = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || shouldIgnoreGlobalShortcut(event)) return;

      event.preventDefault();
      if (isPlaying) pause();
      else play();
    };

    window.addEventListener('keydown', handlePlaybackShortcut);
    return () => {
      window.removeEventListener('keydown', handlePlaybackShortcut);
    };
  }, [selectedAudioUrl, isPlaying, pause, play]);
}

function useCinemaMode(episodeId: string, enabled: boolean, isPlaying: boolean, play: () => void) {
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const cinemaVisible = enabled && cinemaOpen;

  useEffect(() => setCinemaOpen(false), [episodeId]);

  useEffect(() => {
    if (!cinemaVisible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cinemaVisible]);

  useEffect(() => {
    if (!cinemaVisible) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCinemaOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [cinemaVisible]);

  const openCinemaMode = () => {
    setCinemaOpen(true);
    if (!isPlaying) play();
  };

  return { cinemaVisible, closeCinemaMode: () => setCinemaOpen(false), openCinemaMode };
}

function useStickyMeasurements() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      setHeaderHeight(headerRef.current?.getBoundingClientRect().height ?? 0);
      setImageHeight(imageRef.current?.getBoundingClientRect().height ?? 0);
    };
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    if (headerRef.current) observer.observe(headerRef.current);
    if (imageRef.current) observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, []);

  return {
    headerRef,
    imageRef,
    imageTop: `calc(4.5rem + ${headerHeight}px + 0.5rem)`,
    lineScrollMarginTop: `calc(4.5rem + ${headerHeight + imageHeight}px + 1.5rem)`,
  };
}

function useSegmentNavigation(
  timingData: DailyAudioPracticeTiming[],
  activeSegmentIndex: number,
  cinemaOpen: boolean,
  { isPlaying, play, seek }: PlaybackControls
) {
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (activeSegmentIndex < 0 || cinemaOpen) return;
    const row = segmentRefs.current[activeSegmentIndex];
    if (typeof row?.scrollIntoView !== 'function') return;
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSegmentIndex, cinemaOpen]);

  const seekToSegment = (segmentIndex: number) => {
    const timing = timingData.find((entry) => entry.unitIndex === segmentIndex * 2);
    if (!timing) return;
    seek(timing.startTime / 1000);
    if (!isPlaying) play();
  };

  const handleSegmentKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    segmentIndex: number
  ) => {
    if (!isSegmentActivationKey(event.key)) return;
    event.preventDefault();
    seekToSegment(segmentIndex);
  };

  return { handleSegmentKeyDown, seekToSegment, segmentRefs };
}

export default function useAudioScriptPlaybackUi({
  activeSegmentIndex,
  cinemaEnabled,
  controls,
  episodeId,
  selectedAudioUrl,
  timingData,
}: {
  activeSegmentIndex: number;
  cinemaEnabled: boolean;
  controls: PlaybackControls;
  episodeId: string;
  selectedAudioUrl: string | null;
  timingData: DailyAudioPracticeTiming[];
}) {
  usePlaybackShortcut(selectedAudioUrl, controls);
  const cinema = useCinemaMode(episodeId, cinemaEnabled, controls.isPlaying, controls.play);
  const sticky = useStickyMeasurements();
  const navigation = useSegmentNavigation(
    timingData,
    activeSegmentIndex,
    cinema.cinemaVisible,
    controls
  );

  return { ...cinema, ...navigation, ...sticky };
}
