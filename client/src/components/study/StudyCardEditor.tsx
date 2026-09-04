import type {
  StudyCardImagePlacement,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';

import StudyAudioPlayer from './StudyAudioPlayer';
import type { AudioPlayerHandle } from './StudyAudioPlayer';
import StudyCardAudioSettingsFields from './StudyCardAudioSettingsFields';
import StudyCardFormFields from './StudyCardFormFields';
import StudyCardImageControls from './StudyCardImageControls';
import {
  useStudyCardForm,
  type StudyCardFormPayload,
  type StudyCardFormValues,
} from './studyCardFormModel';
import { getStudyCardAudio, isAudioLedPromptCard, toAssetUrl } from './studyCardUtils';

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
  onRegenerateImage?: (payload: {
    imagePrompt: string;
    imageRole: 'prompt' | 'answer' | 'both';
  }) => Promise<StudyCardSummary | void> | StudyCardSummary | void;
  onDelete?: () => Promise<void> | void;
  isSaving?: boolean;
  isDeleting?: boolean;
  isRegeneratingAudio?: boolean;
  isRegeneratingImage?: boolean;
  error?: string | null;
  imagePromptMaxLength?: number;
  defaultAnswerAudioVoiceId?: string;
}

interface CardMediaSnapshot {
  answerAudio: StudyMediaRef | null;
  image: StudyMediaRef | null;
  imageRole: StudyCardImagePlacement;
  imagePrompt: string;
}

interface ImageControlsProps {
  imageRole: StudyCardImagePlacement;
  imagePrompt: string;
  imagePromptMaxLength?: number;
  imageUrl: string | null;
  isBusy: boolean;
  isRegenerating: boolean;
  canRegenerate: boolean;
  onImagePlacementChange: (placement: StudyCardImagePlacement) => void;
  onImagePromptChange: (prompt: string) => void;
  onRegenerate: () => void;
}

interface AudioPreviewProps {
  answerAudioUrl: string | null;
  filename?: string | null;
  playerRef: MutableRefObject<AudioPlayerHandle | null>;
}

interface CardMediaResetConfig {
  cardResetKey: string;
  snapshotRef: MutableRefObject<CardMediaSnapshot>;
  setAnswerAudio: Dispatch<SetStateAction<StudyMediaRef | null>>;
  setImage: Dispatch<SetStateAction<StudyMediaRef | null>>;
  setImageRole: Dispatch<SetStateAction<StudyCardImagePlacement>>;
  setImagePrompt: Dispatch<SetStateAction<string>>;
  setPlayRequest: Dispatch<SetStateAction<number>>;
}

interface EditorActionsProps {
  isBusy: boolean;
  isDeleting: boolean;
  isRegeneratingAudio: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  onRegenerateAudio?: () => void;
}

function getCardImageRole(card: StudyCardSummary): StudyCardImagePlacement {
  if (card.prompt.cueImage && card.answer.answerImage) return 'both';
  if (card.prompt.cueImage) return 'prompt';
  if (card.answer.answerImage) return 'answer';
  return 'none';
}

function getCardImagePrompt(card: StudyCardSummary): string {
  if (!card.prompt.cueImage && !card.answer.answerImage) return '';

  const subject =
    card.answer.expression ??
    card.answer.restoredText ??
    card.prompt.cueText ??
    card.answer.meaning ??
    'this study card';
  const meaning = card.answer.meaning ? ` (${card.answer.meaning})` : '';
  return `A clear natural real-world image representing ${subject}${meaning}.`;
}

const getCardResetKey = (card: StudyCardSummary) =>
  [
    card.id,
    card.answer.expression ?? '',
    card.answer.meaning ?? '',
    card.answer.restoredText ?? '',
    card.prompt.cueText ?? '',
  ].join('\u001f');

const getCardMediaSnapshot = (card: StudyCardSummary): CardMediaSnapshot => ({
  answerAudio: getStudyCardAudio(card),
  image: card.prompt.cueImage ?? card.answer.answerImage ?? null,
  imageRole: getCardImageRole(card),
  imagePrompt: getCardImagePrompt(card),
});

const useDefaultAnswerVoice = (
  cardResetKey: string,
  defaultVoiceId: string | undefined,
  setValues: Dispatch<SetStateAction<StudyCardFormValues>>
) => {
  useEffect(() => {
    if (!defaultVoiceId) return;
    setValues((current) =>
      current.answerAudioVoiceId ? current : { ...current, answerAudioVoiceId: defaultVoiceId }
    );
  }, [cardResetKey, defaultVoiceId, setValues]);
};

const useCardMediaReset = ({
  cardResetKey,
  snapshotRef,
  setAnswerAudio,
  setImage,
  setImageRole,
  setImagePrompt,
  setPlayRequest,
}: CardMediaResetConfig) => {
  const lastResetKeyRef = useRef(cardResetKey);

  useEffect(() => {
    if (lastResetKeyRef.current === cardResetKey) return;

    const snapshot = snapshotRef.current;
    lastResetKeyRef.current = cardResetKey;
    setAnswerAudio(snapshot.answerAudio);
    setImage(snapshot.image);
    setImageRole(snapshot.imageRole);
    setImagePrompt(snapshot.imagePrompt);
    setPlayRequest(0);
  }, [
    cardResetKey,
    setAnswerAudio,
    setImage,
    setImagePrompt,
    setImageRole,
    setPlayRequest,
    snapshotRef,
  ]);
};

const useRegeneratedAudioPlayback = (
  answerAudioUrl: string | null,
  playRequest: number,
  playerRef: MutableRefObject<AudioPlayerHandle | null>
) => {
  useEffect(() => {
    let animationFrame: number | undefined;
    if (playRequest !== 0) {
      if (answerAudioUrl) {
        animationFrame = window.requestAnimationFrame(() => {
          playerRef.current?.stop();
          playerRef.current?.play().catch(() => {});
        });
      }
    }

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    };
  }, [answerAudioUrl, playRequest, playerRef]);
};

const attachCurrentMedia = (
  payload: StudyCardFormPayload,
  imageRole: StudyCardImagePlacement,
  image: StudyMediaRef | null,
  answerAudio: StudyMediaRef | null
) => ({
  prompt: {
    ...payload.prompt,
    cueImage: imageRole === 'prompt' || imageRole === 'both' ? image : null,
  },
  answer: {
    ...payload.answer,
    answerAudio,
    answerImage: imageRole === 'answer' || imageRole === 'both' ? image : null,
  },
});

const getRegeneratedImage = (card: StudyCardSummary, imageRole: StudyCardImagePlacement) => {
  if (imageRole === 'prompt') return card.prompt.cueImage;
  if (imageRole === 'both') return card.prompt.cueImage;
  return card.answer.answerImage;
};

const StudyCardEditorHeader = ({ cardType }: { cardType: StudyCardSummary['cardType'] }) => {
  const { t } = useTranslation('study');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold text-navy">{t('editor.title')}</h3>
        <p className="text-sm text-gray-500">{t('editor.description')}</p>
      </div>
      <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
        {cardType}
      </span>
    </div>
  );
};

const EditorImageControls = ({
  imageRole,
  imagePrompt,
  imagePromptMaxLength,
  imageUrl,
  isBusy,
  isRegenerating,
  canRegenerate,
  onImagePlacementChange,
  onImagePromptChange,
  onRegenerate,
}: ImageControlsProps) => {
  const { t } = useTranslation('study');

  return (
    <StudyCardImageControls
      altText={t('editor.currentImage')}
      imagePlacement={imageRole}
      imagePrompt={imagePrompt}
      imagePromptId="study-edit-image-prompt"
      imagePromptLabel={t('editor.imagePrompt')}
      imagePromptMaxLength={imagePromptMaxLength}
      isRegenerateDisabled={!canRegenerate || isBusy}
      isRegenerating={isRegenerating}
      onImagePlacementChange={onImagePlacementChange}
      onImagePromptChange={onImagePromptChange}
      onRegenerate={onRegenerate}
      previewUrl={imageUrl}
      regenerateLabel={isRegenerating ? t('editor.regeneratingImage') : t('editor.regenerateImage')}
      title={t('editor.currentImage')}
    />
  );
};

const CurrentAudioPreview = ({ answerAudioUrl, filename, playerRef }: AudioPreviewProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="rounded-2xl border border-gray-200 bg-cream/50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {t('editor.currentAudio')}
      </p>
      {answerAudioUrl ? (
        <StudyAudioPlayer
          ref={playerRef}
          filename={filename}
          label={t('editor.currentAudio')}
          showTimeline
          testId="study-editor-answer-audio"
          url={answerAudioUrl}
        />
      ) : (
        <p className="text-sm text-gray-500">{t('editor.noCurrentAudio')}</p>
      )}
    </div>
  );
};

const EditorActions = ({
  isBusy,
  isDeleting,
  isRegeneratingAudio,
  isSaving,
  onCancel,
  onDelete,
  onRegenerateAudio,
}: EditorActionsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={isBusy} className="app-button-primary">
        {isSaving ? t('editor.saving') : t('editor.save')}
      </button>
      {onRegenerateAudio ? (
        <button
          type="button"
          onClick={onRegenerateAudio}
          disabled={isBusy}
          className="app-button-secondary"
        >
          {isRegeneratingAudio ? t('editor.regeneratingAudio') : t('editor.regenerateAudio')}
        </button>
      ) : null}
      <button type="button" onClick={onCancel} disabled={isBusy} className="app-button-secondary">
        {t('editor.cancel')}
      </button>
      {onDelete ? (
        <button type="button" onClick={onDelete} disabled={isBusy} className="app-button-danger">
          {isDeleting ? t('editor.deleting') : t('editor.delete')}
        </button>
      ) : null}
    </div>
  );
};

const StudyCardEditor = ({
  card,
  onCancel,
  onSave,
  onRegenerateAudio,
  onRegenerateImage,
  onDelete,
  isSaving = false,
  isDeleting = false,
  isRegeneratingAudio = false,
  isRegeneratingImage = false,
  error,
  imagePromptMaxLength,
  defaultAnswerAudioVoiceId,
}: StudyCardEditorProps) => {
  const { values, setField, setValues, buildPayload } = useStudyCardForm({ card });
  const [currentAnswerAudio, setCurrentAnswerAudio] = useState(getStudyCardAudio(card));
  const [currentImage, setCurrentImage] = useState(
    card.prompt.cueImage ?? card.answer.answerImage ?? null
  );
  const [imageRole, setImageRole] = useState<StudyCardImagePlacement>(() => getCardImageRole(card));
  const [imagePrompt, setImagePrompt] = useState(() => getCardImagePrompt(card));
  const [audioPlayRequest, setAudioPlayRequest] = useState(0);
  const audioPlayerRef = useRef<AudioPlayerHandle | null>(null);
  const cardResetKey = getCardResetKey(card);
  const mediaSnapshotRef = useRef(getCardMediaSnapshot(card));
  mediaSnapshotRef.current = getCardMediaSnapshot(card);
  const answerAudioUrl = toAssetUrl(currentAnswerAudio?.url);
  const isBusy = [isSaving, isDeleting, isRegeneratingAudio, isRegeneratingImage].some(Boolean);

  useDefaultAnswerVoice(cardResetKey, defaultAnswerAudioVoiceId, setValues);
  useCardMediaReset({
    cardResetKey,
    snapshotRef: mediaSnapshotRef,
    setAnswerAudio: setCurrentAnswerAudio,
    setImage: setCurrentImage,
    setImageRole,
    setImagePrompt,
    setPlayRequest: setAudioPlayRequest,
  });
  useRegeneratedAudioPlayback(answerAudioUrl, audioPlayRequest, audioPlayerRef);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(attachCurrentMedia(buildPayload(), imageRole, currentImage, currentAnswerAudio));
  };

  const handleRegenerateImage = async () => {
    if (!onRegenerateImage) return;
    if (imageRole === 'none') return;

    try {
      const updatedCard = await onRegenerateImage({ imagePrompt, imageRole });
      if (updatedCard) setCurrentImage(getRegeneratedImage(updatedCard, imageRole) ?? null);
    } catch {
      // The owning mutation surfaces the user-facing error; avoid an unhandled rejection.
    }
  };

  const handleRegenerateAudio = async () => {
    if (!onRegenerateAudio) return;

    try {
      const updatedCard = await onRegenerateAudio({
        answerAudioVoiceId: values.answerAudioVoiceId || null,
        answerAudioTextOverride: values.answerAudioTextOverride || null,
      });
      if (!updatedCard) return;
      setCurrentAnswerAudio(getStudyCardAudio(updatedCard));
      setAudioPlayRequest((requestId) => requestId + 1);
    } catch {
      // The owning mutation surfaces the user-facing error; avoid an unhandled rejection.
    }
  };

  return (
    <form data-testid="study-card-editor" className="space-y-5" onSubmit={handleSubmit}>
      <StudyCardEditorHeader cardType={card.cardType} />
      <StudyCardFormFields
        values={values}
        idPrefix="study-edit"
        includeAudioSettings={false}
        includeSentenceFields
        hidePromptFields={isAudioLedPromptCard(card)}
        onFieldChange={setField}
      />
      <EditorImageControls
        imageRole={imageRole}
        imagePrompt={imagePrompt}
        imagePromptMaxLength={imagePromptMaxLength}
        imageUrl={toAssetUrl(currentImage?.url)}
        isBusy={isBusy}
        isRegenerating={isRegeneratingImage}
        canRegenerate={Boolean(onRegenerateImage)}
        onImagePlacementChange={setImageRole}
        onImagePromptChange={setImagePrompt}
        onRegenerate={handleRegenerateImage}
      />
      <CurrentAudioPreview
        answerAudioUrl={answerAudioUrl}
        filename={currentAnswerAudio?.filename}
        playerRef={audioPlayerRef}
      />
      <StudyCardAudioSettingsFields
        values={values}
        idPrefix="study-edit"
        onFieldChange={setField}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <EditorActions
        isBusy={isBusy}
        isDeleting={isDeleting}
        isRegeneratingAudio={isRegeneratingAudio}
        isSaving={isSaving}
        onCancel={onCancel}
        onDelete={onDelete}
        onRegenerateAudio={onRegenerateAudio ? handleRegenerateAudio : undefined}
      />
    </form>
  );
};

export default StudyCardEditor;
