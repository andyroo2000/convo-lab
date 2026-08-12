const interactiveTargetSelector = [
  'a[href]',
  'audio',
  'button',
  'input',
  'select',
  'summary',
  'textarea',
  'video',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
].join(',');

export const isInteractiveShortcutTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || target.closest(interactiveTargetSelector) !== null;
};

export const shouldIgnoreGlobalShortcut = (event: KeyboardEvent): boolean =>
  event.defaultPrevented ||
  event.repeat ||
  event.altKey ||
  event.ctrlKey ||
  event.metaKey ||
  event.shiftKey ||
  isInteractiveShortcutTarget(event.target);
