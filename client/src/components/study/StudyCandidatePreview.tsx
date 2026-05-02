import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import StudyAudioPlayer from './StudyAudioPlayer';
import { StudyCardFace } from './StudyCardPreview';

export const StudyCandidatePreviewAudio = ({
  isRegenerating,
  label,
  onRegenerate,
  previewUrl,
  regenerateLabel,
  regenerateError,
  staleLabel,
  title,
}: {
  isRegenerating: boolean;
  label: string;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateLabel: string;
  regenerateError: string | null;
  staleLabel: string;
  title: string;
}) => (
  <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
    {previewUrl ? (
      <div className="mt-2">
        <StudyAudioPlayer url={previewUrl} label={label} size="compact" />
      </div>
    ) : (
      <p className="mt-2 text-sm text-amber-700">{staleLabel}</p>
    )}
    <button
      type="button"
      onClick={onRegenerate}
      disabled={isRegenerating}
      className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {regenerateLabel}
    </button>
    {regenerateError ? <p className="mt-2 text-sm text-red-600">{regenerateError}</p> : null}
  </div>
);

export const StudyCandidateCardPreviewModal = ({
  card,
  onClose,
}: {
  card: StudyCardSummary;
  onClose: () => void;
}) => {
  const { t } = useTranslation('study');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const toggleSide = useCallback(
    () => setSide((current) => (current === 'front' ? 'back' : 'front')),
    []
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
            if (event.key === 'Enter') {
              event.preventDefault();
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
