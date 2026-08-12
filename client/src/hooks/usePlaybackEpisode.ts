import { useCallback, useEffect, useRef, useState } from 'react';

import type { Episode } from '../types';

type GetEpisode = (
  episodeId: string,
  bustCache?: boolean,
  viewAsUserId?: string
) => Promise<Episode>;

interface UsePlaybackEpisodeOptions {
  episodeId?: string;
  viewAsUserId?: string;
  getEpisode: GetEpisode;
}

interface PlaybackEpisodeState {
  episode: Episode | null;
  isEpisodeLoading: boolean;
  loadEpisode: (bustCache?: boolean) => Promise<boolean>;
}

/** Keeps playback data aligned with the current route and impersonated user. */
export default function usePlaybackEpisode({
  episodeId,
  viewAsUserId,
  getEpisode,
}: UsePlaybackEpisodeOptions): PlaybackEpisodeState {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);
  const requestIdRef = useRef(0);
  const routeIdentity = `${episodeId ?? ''}\0${viewAsUserId ?? ''}`;
  const routeIdentityRef = useRef(routeIdentity);
  routeIdentityRef.current = routeIdentity;

  const loadEpisode = useCallback(
    async (bustCache = false): Promise<boolean> => {
      const requestedRouteIdentity = routeIdentity;
      if (!episodeId || routeIdentityRef.current !== requestedRouteIdentity) return false;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsEpisodeLoading(true);
      if (!bustCache) setEpisode(null);

      try {
        const data = await getEpisode(episodeId, bustCache, viewAsUserId);
        if (
          requestIdRef.current !== requestId ||
          routeIdentityRef.current !== requestedRouteIdentity
        ) {
          return false;
        }

        setEpisode(data);
        return true;
      } catch (error) {
        if (
          requestIdRef.current === requestId &&
          routeIdentityRef.current === requestedRouteIdentity
        ) {
          console.error('Failed to load episode:', error);
        }
        return false;
      } finally {
        if (
          requestIdRef.current === requestId &&
          routeIdentityRef.current === requestedRouteIdentity
        ) {
          setIsEpisodeLoading(false);
        }
      }
    },
    [episodeId, getEpisode, routeIdentity, viewAsUserId]
  );

  useEffect(() => {
    loadEpisode();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadEpisode]);

  return { episode, isEpisodeLoading, loadEpisode };
}
