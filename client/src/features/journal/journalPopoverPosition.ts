export default function journalPopoverPosition(
  anchor: Pick<DOMRect, 'left' | 'top' | 'bottom' | 'width'>,
  popup: Pick<DOMRect, 'width' | 'height'>,
  viewport: { width: number; height: number },
  gap = 6
) {
  const left = Math.max(12, Math.min(anchor.left, viewport.width - popup.width - 12));
  const below = anchor.bottom + popup.height + gap <= viewport.height - 12;
  const top = below ? anchor.bottom + gap : Math.max(12, anchor.top - popup.height - gap);
  const pointerLeft = Math.max(
    24,
    Math.min(anchor.left + Math.min(anchor.width / 2, 60) - left, popup.width - 24)
  );
  return {
    left,
    top,
    pointerLeft,
    placement: below ? 'below' : 'above',
    pointerVisible: below || top + popup.height <= anchor.top - gap,
  };
}
