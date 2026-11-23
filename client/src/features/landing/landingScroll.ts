import createLandingPlayback from './landingPlayback';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function chapterPosition(top: number, height: number, viewport: number, count: number) {
  const progress = clamp(-top / Math.max(1, height - viewport)) * count;
  const transition = clamp(((progress % 1) - 0.65) / 0.35);
  const eased = transition * transition * (3 - 2 * transition);
  return Math.min(count - 1, Math.floor(progress) + eased);
}

function paintPanels(panels: HTMLElement[], position: number) {
  panels.forEach((panel, index) => {
    panel.style.setProperty('transform', `translateX(${(index - position) * 100}%)`);
    const active = index === Math.round(position);
    panel.toggleAttribute('inert', !active);
    panel.setAttribute('aria-hidden', String(!active));
  });
}

function nearestPanel(panels: HTMLElement[]) {
  const distance = (panel: HTMLElement) => {
    const bounds = panel.getBoundingClientRect();
    return Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2);
  };
  return panels.reduce(
    (best, panel, index) => (distance(panel) < distance(panels[best]) ? index : best),
    0
  );
}

export function startLandingStory(story: HTMLElement) {
  const panels = Array.from(story.querySelectorAll<HTMLElement>('.landing-chapter'));
  const videos = Array.from(story.querySelectorAll<HTMLVideoElement>('video'));
  const buttons = Array.from(story.querySelectorAll<HTMLButtonElement>('[data-chapter]'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const roomy = matchMedia('(min-width:851px) and (min-height:650px)');
  const playback = createLandingPlayback(videos, reduced);
  let frame = 0;
  const render = () => {
    frame = 0;
    const bounds = story.getBoundingClientRect();
    let active = nearestPanel(panels);
    if (roomy.matches && !reduced.matches) {
      const position = chapterPosition(
        bounds.top,
        bounds.height,
        window.innerHeight,
        panels.length
      );
      paintPanels(panels, position);
      active = Math.round(position);
    }
    const visible =
      bounds.top < window.innerHeight * 0.7 && bounds.bottom > window.innerHeight * 0.3;
    buttons.forEach((button, index) =>
      button.setAttribute('aria-current', index === active ? 'step' : 'false')
    );
    playback.select(visible ? active : -1);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const reset = () => {
    panels.forEach((panel) => {
      panel.style.removeProperty('transform');
      panel.removeAttribute('aria-hidden');
      panel.removeAttribute('inert');
    });
    render();
  };
  story.classList.add('is-ready');
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', reset);
  roomy.addEventListener('change', reset);
  render();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    reduced.removeEventListener('change', reset);
    roomy.removeEventListener('change', reset);
    playback.destroy();
  };
}

export function goToLandingChapter(story: HTMLElement | null, index: number) {
  if (!story) return;
  const bounds = story.getBoundingClientRect();
  const count = story.querySelectorAll('.landing-chapter').length;
  const top =
    window.scrollY + bounds.top + (index * (bounds.height - window.innerHeight)) / count + 4;
  window.scrollTo({ top, behavior: 'instant' });
}
