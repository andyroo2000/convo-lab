import { useEffect } from 'react';

import { warmAudioCache } from '../lib/audioCache';

export default function useWarmAudioCache(
  urls: Array<string | null | undefined>,
  enabled: boolean = true
) {
  const urlKey = urls
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .join('\n');

  useEffect(() => {
    if (!enabled || !urlKey) return;

    warmAudioCache(urlKey.split('\n')).catch((error) => {
      console.warn('Unable to warm audio cache:', error);
    });
  }, [enabled, urlKey]);
}
