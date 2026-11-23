export default function createLandingPlayback(videos: HTMLVideoElement[], reduced: MediaQueryList) {
  const manualPauses = new Set<HTMLVideoElement>();
  let selected = -1;
  const canPlay = (video: HTMLVideoElement, index: number) => {
    if (document.hidden || reduced.matches) return false;
    return index === selected && !manualPauses.has(video);
  };
  const refresh = () =>
    videos.forEach((video, index) => {
      if (canPlay(video, index)) {
        video.play().catch(() => undefined);
      } else video.pause();
    });
  const toggle = (video: HTMLVideoElement) => {
    if (video.paused) {
      manualPauses.delete(video);
      video.play().catch(() => undefined);
    } else {
      manualPauses.add(video);
      video.pause();
    }
  };
  const detach = videos.map((video) => {
    const click = () => toggle(video);
    const keydown = (event: KeyboardEvent) => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      toggle(video);
    };
    video.addEventListener('click', click);
    video.addEventListener('keydown', keydown);
    return () => {
      video.removeEventListener('click', click);
      video.removeEventListener('keydown', keydown);
      video.pause();
    };
  });
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  return {
    select(index: number) {
      if (index === selected) return;
      selected = index;
      refresh();
    },
    destroy() {
      detach.forEach((remove) => remove());
      document.removeEventListener('visibilitychange', refresh);
      reduced.removeEventListener('change', refresh);
    },
  };
}
