import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StudyAudioPlayer from './StudyAudioPlayer';
import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyCardFormFields, { StudyCardAudioSettingsFields } from './StudyCardFormFields';
import { useStudyCardForm } from './studyCardFormModel';
import { toAssetUrl } from './studyCardUtils';

interface StudyCardEditorProps {
  card: StudyCardSummary;
  onCancel: () => void;
  onSave: (payload: {
    prompt: StudyCardSummary['prompt'];
    answer: StudyCardSummary['answer'];
  }) => Promise<void> | void;
  onRegenerateAudio?: (payload: {
    answerAudioVoiceId: string | null;
    answerAudioTextOverride: string | null;
  }) => Promise<StudyCardSummary | void> | StudyCardSummary | void;
  isSaving?: boolean;
  isRegeneratingAudio?: boolean;
  error?: string | null;
}

const StudyCardEditor = ({
  card,
  onCancel,
  onSave,
  onRegenerateAudio,
  isSaving = false,
  isRegeneratingAudio = false,
  error,
}: StudyCardEditorProps) => {
  const { t } = useTranslation('study');
  const { values, setField, buildPayload } = useStudyCardForm({ card });
  const [currentAnswerAudio, setCurrentAnswerAudio] = useState(card.answer.answerAudio ?? null);
  const [regeneratedAudioPlayRequest, setRegeneratedAudioPlayRequest] = useState(0);
  const currentAudioPlayerRef = useRef<AudioPlayerHandle | null>(null);
  const answerAudioUrl = toAssetUrl(currentAnswerAudio?.url);

  useEffect(() => {
    setCurrentAnswerAudio(card.answer.answerAudio ?? null);
  }, [card.answer.answerAudio, card.id]);

  useEffect(() => {
    if (regeneratedAudioPlayRequest === 0 || !answerAudioUrl) return undefined;

    const animationFrame = window.requestAnimationFrame(() => {
      const player = currentAudioPlayerRef.current;
      player?.stop();
      player?.play().catch(() => {});
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [answerAudioUrl, regeneratedAudioPlayRequest]);

  return (
    <form
      data-testid="study-card-editor"
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const { prompt, answer } = buildPayload();
        // Regeneration saves media immediately; include the current reference so a later form save
        // does not accidentally drop freshly previewed audio.
        await onSave({ prompt, answer: { ...answer, answerAudio: currentAnswerAudio } });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-navy">{t('editor.title')}</h3>
          <p className="text-sm text-gray-500">{t('editor.description')}</p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
          {card.cardType}
        </span>
      </div>
      <StudyCardFormFields
        values={values}
        idPrefix="study-edit"
        includeAudioSettings={false}
        includeSentenceFields
        onFieldChange={setField}
      />

      <div className="rounded-2xl border border-gray-200 bg-cream/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          {t('editor.currentAudio')}
        </p>
        {answerAudioUrl ? (
          <StudyAudioPlayer
            ref={currentAudioPlayerRef}
            filename={currentAnswerAudio?.filename}
            label={t('editor.currentAudio')}
            showTimeline
            testId="study-editor-answer-audio"
            url={answerAudioUrl}
          />
        ) : (
          <p className="text-sm text-gray-500">{t('editor.noCurrentAudio')}</p>
        )}
      </div>

      <StudyCardAudioSettingsFields
        values={values}
        idPrefix="study-edit"
        onFieldChange={setField}
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving || isRegeneratingAudio}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? t('editor.saving') : t('editor.save')}
        </button>
        {onRegenerateAudio ? (
          <button
            type="button"
            onClick={async () => {
              try {
                const updatedCard = await onRegenerateAudio({
                  answerAudioVoiceId: values.answerAudioVoiceId || null,
                  answerAudioTextOverride: values.answerAudioTextOverride || null,
                });
                if (updatedCard) {
                  setCurrentAnswerAudio(updatedCard.answer.answerAudio ?? null);
                  setRegeneratedAudioPlayRequest((requestId) => requestId + 1);
                }
              } catch {
                // The owning mutation surfaces the user-facing error; avoid an unhandled rejection.
              }
            }}
            disabled={isSaving || isRegeneratingAudio}
            className="rounded-full border border-navy/30 px-5 py-3 text-sm font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRegeneratingAudio ? t('editor.regeneratingAudio') : t('editor.regenerateAudio')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving || isRegeneratingAudio}
          className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('editor.cancel')}
        </button>
      </div>
    </form>
  );
};

export default StudyCardEditor;
