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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const toggleSide = useCallback(
    () => setSide((current) => (current === 'front' ? 'back' : 'front')),
    []
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        toggleSide();
      }
    };

    if (dialog) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }

      closeButtonRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog?.removeAttribute('open');
      }
    };
  }, [toggleSide]);

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, audio, input, select, textarea, a')) {
      return;
    }

    toggleSide();
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[calc(100%-2rem)] max-w-5xl rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/50"
      aria-labelledby="candidate-card-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
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
    </dialog>
  );
};

export default StudyCandidateCardPreviewModal;
