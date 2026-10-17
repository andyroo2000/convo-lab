import { useCallback, useEffect, useRef, useState } from 'react';
import { positionKey } from './readingPosition';
import ReadingPositionSync, { type ReaderPosition } from './ReadingPositionSync';
import type { ReadingDetail } from './types';

export default function useReadingPosition(reading: ReadingDetail, userId?: string) {
  const [position, setPosition] = useState<ReaderPosition>({ pageIndex: 0, selected: null });
  const [error, setError] = useState<string | null>(null);
  const current = useRef(position);
  const sync = useRef<ReadingPositionSync>();
  const update = useCallback((next: ReaderPosition) => {
    current.current = next;
    setPosition(next);
  }, []);
  const change = useCallback(
    (next: ReaderPosition) => {
      update(next);
      sync.current?.record(next);
    },
    [update]
  );

  useEffect(() => {
    if (!userId) return undefined;
    const session = new ReadingPositionSync(
      reading,
      positionKey(userId, reading.id),
      update,
      setError
    );
    sync.current = session;
    session.restore();
    const retry = () => {
      session.flush();
    };
    const leaving = () => {
      session.flushOnExit();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') leaving();
    };
    window.addEventListener('online', retry);
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      leaving();
      session.dispose();
      sync.current = undefined;
      window.removeEventListener('online', retry);
      window.removeEventListener('pagehide', leaving);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [userId, reading, update]);

  const select = useCallback(
    (selected: number | null) => change({ ...current.current, selected }),
    [change]
  );
  const turnPage = useCallback(
    (direction: number) => {
      const pageIndex = current.current.pageIndex + direction;
      if (pageIndex >= 0 && pageIndex < reading.document.pages.length)
        change({ pageIndex, selected: current.current.selected });
    },
    [change, reading.document.pages.length]
  );
  return { ...position, select, turnPage, error };
}
