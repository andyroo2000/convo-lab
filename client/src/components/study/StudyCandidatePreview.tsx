import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { StudyCardFace } from './StudyCardPreview';

const StudyCandidateCardPreviewModal = ({
  card,
  onClose,
}: {
  card: StudyCardSummary;
  onClose: () => void;
}) => {
  const { t } = useTranslation('study');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const toggleSide = useCallback(
    () => setSide((current) => (current === 'front' ? 'back' : 'front')),
    []
  );

  useEffect(() => {
    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];
        const lastElement = focusableElements.at(-1);
        if (!firstElement || !lastElement) return;

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === ' ') {
        event.preventDefault();
        toggleSide();
      }
    };

    const originalBodyOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [onClose, toggleSide]);

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, audio, input, select, textarea, a')) {
      return;
    }

    toggleSide();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-card-preview-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="candidate-card-preview-title" className="text-lg font-bold text-navy">
              {t('create.previewCardTitle')}
            </h2>
            <p className="text-sm text-gray-500">{t(`create.previewSides.${side}`)}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.closePreview')}
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handlePreviewClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              toggleSide();
            }
          }}
          className="min-h-[52vh] flex-1 overflow-y-auto px-5 py-8 text-left"
        >
          <StudyCardFace card={card} side={side} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={() => setSide('front')}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.previewPrompt')}
          </button>
          <p className="hidden text-sm text-gray-500 sm:block">{t('create.previewHint')}</p>
          <button
            type="button"
            onClick={() => setSide('back')}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {t('create.previewAnswer')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyCandidateCardPreviewModal;
