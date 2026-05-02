import { useEffect, useRef } from 'react';

import { warmAudioCache } from '../lib/audioCache';

export default function useWarmAudioCache(
  urls: Array<string | null | undefined>,
  enabled: boolean = true
) {
  const audioUrls = urls
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map((url) => url.trim());
  const audioUrlsRef = useRef(audioUrls);
  const urlKey = JSON.stringify(audioUrls);

  audioUrlsRef.current = audioUrls;

  useEffect(() => {
    const urlsToWarm = audioUrlsRef.current;
    if (!enabled || urlsToWarm.length === 0) return;

    warmAudioCache(urlsToWarm).catch((error) => {
      console.warn('Unable to warm audio cache:', error);
    });
  }, [enabled, urlKey]);
}
