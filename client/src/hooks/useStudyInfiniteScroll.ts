import { useEffect, useRef } from 'react';

const useStudyInfiniteScroll = (enabled: boolean, loadMore: () => void) => {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '320px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return targetRef;
};

export default useStudyInfiniteScroll;
