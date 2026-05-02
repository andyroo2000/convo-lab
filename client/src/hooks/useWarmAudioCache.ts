import { useEffect } from 'react';

import { warmAudioCache } from '../lib/audioCache';

export default function useWarmAudioCache(
  urls: Array<string | null | undefined>,
  enabled: boolean = true
) {
  const urlKey = JSON.stringify(
    urls
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .map((url) => url.trim())
  );

  useEffect(() => {
    const audioUrls = JSON.parse(urlKey) as string[];
    if (!enabled || audioUrls.length === 0) return;

    warmAudioCache(audioUrls).catch((error) => {
      console.warn('Unable to warm audio cache:', error);
    });
  }, [enabled, urlKey]);
}
