export function placeCandidates(field, panel) {
  if (panel.hidden) return;
  const mirror = document.createElement('div');
  const style = getComputedStyle(field);
  for (const property of [
    'font',
    'letterSpacing',
    'lineHeight',
    'padding',
    'border',
    'boxSizing',
    'tabSize',
  ])
    mirror.style[property] = style[property];
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    left: '0',
    top: '0',
    width: `${field.getBoundingClientRect().width}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  const offset = Number(panel.dataset.anchorOffset ?? field.selectionStart);
  mirror.textContent = field.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = field.value.slice(offset, offset + 1) || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const caret = marker.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  const x = rect.left + caret.left - field.scrollLeft;
  const y = rect.top + caret.top - field.scrollTop;
  mirror.remove();
  const height = panel.getBoundingClientRect().height;
  const width = panel.getBoundingClientRect().width;
  let top = y - height - 8;
  if (panel.dataset.placement === 'below') top = y + parseFloat(style.lineHeight) + 4;
  if (top + height > innerHeight - 12) top = y - height - 8;
  if (top < 12) top = y + parseFloat(style.lineHeight) + 4;
  panel.style.left = `${Math.max(12, Math.min(x, innerWidth - width - 12))}px`;
  panel.style.top = `${Math.min(top, Math.max(12, innerHeight - height - 12))}px`;
}
