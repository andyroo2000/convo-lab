import { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@languageflow/shared/src/constants-new';
import { getSelectableTtsVoices } from '@languageflow/shared/src/voiceSelection';
import { LanguageCode, ProficiencyLevel, ToneStyle } from '../../types';
import DemoRestrictionModal from '../common/DemoRestrictionModal';
import VoicePreview from '../common/VoicePreview';

export interface SpeakerFormData {
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color: string;
}

interface DialogueGeneratorFormProps {
  sourceText: string;
  setSourceText: (value: string) => void;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  dialogueLength: number;
  setDialogueLength: (value: number) => void;
  jlptLevel: string;
  setJlptLevel: (value: string) => void;
  tone: ToneStyle;
  setTone: (value: ToneStyle) => void;
  vocabSeedOverride: string;
  setVocabSeedOverride: (value: string) => void;
  grammarSeedOverride: string;
  setGrammarSeedOverride: (value: string) => void;
  speakers: SpeakerFormData[];
  setSpeakers: Dispatch<SetStateAction<SpeakerFormData[]>>;
  autoGenerateAudio: boolean;
  setAutoGenerateAudio: (value: boolean) => void;
  audioCourseEnabled: boolean;
  createAudioCourse: boolean;
  setCreateAudioCourse: (value: boolean) => void;
  courseTitle: string;
  setCourseTitle: (value: string) => void;
  courseNarratorVoice: string;
  setCourseNarratorVoice: (value: string) => void;
  courseMaxDuration: number;
  setCourseMaxDuration: (value: number) => void;
  loading: boolean;
  generationError: string | null;
  requestError: string | null;
  hasConflictedIntent: boolean;
  onGenerate: () => void;
  onAbandonConflictedRequest: () => void;
  showDemoModal: boolean;
  onCloseDemoModal: () => void;
}

type VoiceChoice = ReturnType<typeof getSelectableTtsVoices>[number];

const SeedOverrides = ({
  vocabSeedOverride,
  setVocabSeedOverride,
  grammarSeedOverride,
  setGrammarSeedOverride,
}: Pick<
  DialogueGeneratorFormProps,
  'vocabSeedOverride' | 'setVocabSeedOverride' | 'grammarSeedOverride' | 'setGrammarSeedOverride'
>) => {
  const { t } = useTranslation(['dialogue']);
  return (
    <div className="retro-dialogue-create-v3-divider">
      <h3 className="retro-dialogue-create-v3-subtitle-title">
        {t('dialogue:form.seedOverrides')}
      </h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="dialogue-vocab-seeds" className="retro-dialogue-create-v3-label is-small">
            {t('dialogue:form.vocabSeeds')}
          </label>
          <textarea
            id="dialogue-vocab-seeds"
            value={vocabSeedOverride}
            onChange={(event) => setVocabSeedOverride(event.target.value)}
            className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
            placeholder={t('dialogue:form.vocabSeedsPlaceholder')}
          />
        </div>
        <div>
          <label
            htmlFor="dialogue-grammar-seeds"
            className="retro-dialogue-create-v3-label is-small"
          >
            {t('dialogue:form.grammarSeeds')}
          </label>
          <textarea
            id="dialogue-grammar-seeds"
            value={grammarSeedOverride}
            onChange={(event) => setGrammarSeedOverride(event.target.value)}
            className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
            placeholder={t('dialogue:form.grammarSeedsPlaceholder')}
          />
        </div>
        <p className="retro-dialogue-create-v3-helper is-small">{t('dialogue:form.seedHelper')}</p>
      </div>
    </div>
  );
};

const StorySection = ({
  sourceText,
  setSourceText,
  targetLanguage,
  dialogueLength,
  setDialogueLength,
  jlptLevel,
  setJlptLevel,
  tone,
  setTone,
  vocabSeedOverride,
  setVocabSeedOverride,
  grammarSeedOverride,
  setGrammarSeedOverride,
}: Pick<
  DialogueGeneratorFormProps,
  | 'sourceText'
  | 'setSourceText'
  | 'targetLanguage'
  | 'dialogueLength'
  | 'setDialogueLength'
  | 'jlptLevel'
  | 'setJlptLevel'
  | 'tone'
  | 'setTone'
  | 'vocabSeedOverride'
  | 'setVocabSeedOverride'
  | 'grammarSeedOverride'
  | 'setGrammarSeedOverride'
>) => {
  const { t } = useTranslation(['dialogue']);

  return (
    <section className="retro-dialogue-create-v3-section">
      <h2 className="retro-dialogue-create-v3-section-title">{t('dialogue:form.yourStory')}</h2>
      <div className="space-y-6">
        <div>
          <label htmlFor="dialogue-source-text" className="retro-dialogue-create-v3-label">
            {t('dialogue:form.whatToTalkAbout')} *
          </label>
          <textarea
            id="dialogue-source-text"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea"
            placeholder={t('dialogue:form.storyPlaceholder')}
            data-testid="dialogue-input-source-text"
          />
          <p className="retro-dialogue-create-v3-helper">{t('dialogue:form.storyHelper')}</p>
        </div>
        <div className="space-y-6">
          <div>
            <label htmlFor="dialogue-length" className="retro-dialogue-create-v3-label">
              {t('dialogue:form.conversationLength')}
            </label>
            <select
              id="dialogue-length"
              value={dialogueLength}
              onChange={(event) => setDialogueLength(parseInt(event.target.value, 10))}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
              data-testid="dialogue-select-length"
            >
              <option value="8">{t('dialogue:form.turns', { count: 8 })}</option>
              <option value="15">{t('dialogue:form.turns', { count: 15 })}</option>
              <option value="20">{t('dialogue:form.turns', { count: 20 })}</option>
            </select>
          </div>
          {targetLanguage === 'ja' && (
            <div>
              <label htmlFor="dialogue-jlpt-level" className="retro-dialogue-create-v3-label">
                {t('dialogue:form.targetJLPT')}
              </label>
              <select
                id="dialogue-jlpt-level"
                value={jlptLevel}
                onChange={(event) => setJlptLevel(event.target.value)}
                className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                data-testid="dialogue-select-jlpt-level"
              >
                <option value="N5">{t('dialogue:form.jlpt.n5')}</option>
                <option value="N4">{t('dialogue:form.jlpt.n4')}</option>
                <option value="N3">{t('dialogue:form.jlpt.n3')}</option>
                <option value="N2">{t('dialogue:form.jlpt.n2')}</option>
                <option value="N1">{t('dialogue:form.jlpt.n1')}</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="dialogue-tone" className="retro-dialogue-create-v3-label">
              {t('dialogue:form.tone')}
            </label>
            <select
              id="dialogue-tone"
              value={tone}
              onChange={(event) => setTone(event.target.value as ToneStyle)}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
              data-testid="dialogue-select-tone"
            >
              <option value="casual">{t('dialogue:form.tones.casual')}</option>
              <option value="polite">{t('dialogue:form.tones.polite')}</option>
              <option value="formal">{t('dialogue:form.tones.formal')}</option>
            </select>
          </div>
          {targetLanguage === 'ja' && (
            <SeedOverrides
              vocabSeedOverride={vocabSeedOverride}
              setVocabSeedOverride={setVocabSeedOverride}
              grammarSeedOverride={grammarSeedOverride}
              setGrammarSeedOverride={setGrammarSeedOverride}
            />
          )}
        </div>
      </div>
    </section>
  );
};

const VoiceSection = ({
  speakers,
  setSpeakers,
  targetVoices,
}: Pick<DialogueGeneratorFormProps, 'speakers' | 'setSpeakers'> & {
  targetVoices: VoiceChoice[];
}) => {
  const { t } = useTranslation(['dialogue']);

  const selectVoice = (index: number, voiceId: string) => {
    setSpeakers((currentSpeakers) =>
      currentSpeakers.map((speaker, speakerIndex) =>
        speakerIndex === index ? { ...speaker, voiceId } : speaker
      )
    );
  };

  return (
    <section className="retro-dialogue-create-v3-section">
      <h2 className="retro-dialogue-create-v3-section-title">{t('dialogue:voiceConfig.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {speakers.map((speaker, index) => (
          <div key={`${speaker.name}-${speaker.voiceId}`}>
            <label
              htmlFor={`dialogue-speaker-${index + 1}-voice`}
              className="retro-dialogue-create-v3-label"
            >
              {t('dialogue:voiceConfig.speaker', { number: index + 1 })}
            </label>
            <select
              id={`dialogue-speaker-${index + 1}-voice`}
              value={speaker.voiceId}
              onChange={(event) => selectVoice(index, event.target.value)}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
            >
              {targetVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                </option>
              ))}
            </select>
            <VoicePreview voiceId={speaker.voiceId} />
          </div>
        ))}
      </div>
      <p className="retro-dialogue-create-v3-helper is-small">{t('dialogue:voiceConfig.helper')}</p>
    </section>
  );
};

const AudioSettingsSection = ({
  autoGenerateAudio,
  setAutoGenerateAudio,
}: Pick<DialogueGeneratorFormProps, 'autoGenerateAudio' | 'setAutoGenerateAudio'>) => {
  const { t } = useTranslation(['dialogue']);
  return (
    <section className="retro-dialogue-create-v3-section">
      <h2 className="retro-dialogue-create-v3-section-title">
        {t('dialogue:audioSettings.title')}
      </h2>
      <div className="retro-dialogue-create-v3-toggle-row">
        <div>
          <p className="retro-dialogue-create-v3-toggle-title">
            {t('dialogue:audioSettings.autoTitle')}
          </p>
          <p className="retro-dialogue-create-v3-helper">
            {t('dialogue:audioSettings.autoHelper')}
          </p>
        </div>
        <label htmlFor="dialogue-auto-audio" className="retro-dialogue-create-v3-switch">
          <input
            id="dialogue-auto-audio"
            type="checkbox"
            checked={autoGenerateAudio}
            onChange={(event) => setAutoGenerateAudio(event.target.checked)}
            className="retro-dialogue-create-v3-switch-input sr-only"
            aria-label={t('dialogue:audioSettings.autoTitle')}
          />
          <span className="retro-dialogue-create-v3-switch-track" />
        </label>
      </div>
    </section>
  );
};

const AudioCourseSection = ({
  createAudioCourse,
  setCreateAudioCourse,
  courseTitle,
  setCourseTitle,
  courseNarratorVoice,
  setCourseNarratorVoice,
  courseMaxDuration,
  setCourseMaxDuration,
  narratorVoiceChoices,
}: Pick<
  DialogueGeneratorFormProps,
  | 'createAudioCourse'
  | 'setCreateAudioCourse'
  | 'courseTitle'
  | 'setCourseTitle'
  | 'courseNarratorVoice'
  | 'setCourseNarratorVoice'
  | 'courseMaxDuration'
  | 'setCourseMaxDuration'
> & { narratorVoiceChoices: VoiceChoice[] }) => {
  const { t } = useTranslation(['dialogue']);
  return (
    <section className="retro-dialogue-create-v3-section is-course">
      <h2 className="retro-dialogue-create-v3-section-title">{t('dialogue:audioCourse.title')}</h2>
      <div className="retro-dialogue-create-v3-toggle-row">
        <div>
          <p className="retro-dialogue-create-v3-toggle-title">
            {t('dialogue:audioCourse.toggleTitle')}
          </p>
          <p className="retro-dialogue-create-v3-helper">
            {t('dialogue:audioCourse.toggleHelper')}
          </p>
        </div>
        <label htmlFor="dialogue-create-audio-course" className="retro-dialogue-create-v3-switch">
          <input
            id="dialogue-create-audio-course"
            type="checkbox"
            checked={createAudioCourse}
            onChange={(event) => setCreateAudioCourse(event.target.checked)}
            className="retro-dialogue-create-v3-switch-input sr-only"
            aria-label={t('dialogue:audioCourse.toggleTitle')}
          />
          <span className="retro-dialogue-create-v3-switch-track is-course" />
        </label>
      </div>
      {createAudioCourse && (
        <div className="mt-6 space-y-6">
          <div>
            <label htmlFor="dialogue-course-title" className="retro-dialogue-create-v3-label">
              {t('dialogue:audioCourse.courseTitle')}
            </label>
            <input
              id="dialogue-course-title"
              type="text"
              value={courseTitle}
              onChange={(event) => setCourseTitle(event.target.value)}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
              placeholder={t('dialogue:audioCourse.courseTitlePlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="dialogue-course-narrator" className="retro-dialogue-create-v3-label">
              {t('dialogue:audioCourse.narratorLabel')}
            </label>
            <select
              id="dialogue-course-narrator"
              value={courseNarratorVoice}
              onChange={(event) => setCourseNarratorVoice(event.target.value)}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
            >
              {narratorVoiceChoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.description} ({voice.gender})
                </option>
              ))}
            </select>
            <VoicePreview voiceId={courseNarratorVoice} />
          </div>
          <div>
            <label htmlFor="dialogue-course-duration" className="retro-dialogue-create-v3-label">
              {t('dialogue:audioCourse.maxDuration')}
            </label>
            <select
              id="dialogue-course-duration"
              value={courseMaxDuration}
              onChange={(event) => setCourseMaxDuration(parseInt(event.target.value, 10))}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
            >
              <option value={10}>{t('dialogue:audioCourse.durationOptions.10')}</option>
              <option value={15}>{t('dialogue:audioCourse.durationOptions.15')}</option>
              <option value={20}>{t('dialogue:audioCourse.durationOptions.20')}</option>
              <option value={30}>{t('dialogue:audioCourse.durationOptions.30')}</option>
            </select>
          </div>
          <p className="retro-dialogue-create-v3-helper is-small">
            {t('dialogue:audioCourse.helper')}
          </p>
        </div>
      )}
    </section>
  );
};

const areCourseFieldsMissing = ({
  createAudioCourse,
  audioCourseEnabled,
  courseTitle,
  courseNarratorVoice,
}: Pick<
  DialogueGeneratorFormProps,
  'createAudioCourse' | 'audioCourseEnabled' | 'courseTitle' | 'courseNarratorVoice'
>) => createAudioCourse && audioCourseEnabled && (!courseTitle.trim() || !courseNarratorVoice);

const proficiencyLabel = (jlptLevel: string) => jlptLevel || 'beginner';

const generateButtonLabel = (loading: boolean, t: ReturnType<typeof useTranslation>['t']) =>
  loading ? t('dialogue:generate.generating') : t('dialogue:generate.button');

const GenerationAlerts = ({
  generationError,
  requestError,
  hasConflictedIntent,
  onAbandonConflictedRequest,
}: Pick<
  DialogueGeneratorFormProps,
  'generationError' | 'requestError' | 'hasConflictedIntent' | 'onAbandonConflictedRequest'
>) => {
  const displayedError = generationError || requestError;
  return (
    <>
      {displayedError && (
        <div className="retro-dialogue-create-v3-alert is-error">{displayedError}</div>
      )}
      {hasConflictedIntent && (
        <button type="button" onClick={onAbandonConflictedRequest}>
          Start a new request
        </button>
      )}
    </>
  );
};

const GenerateSummary = ({
  targetLanguage,
  jlptLevel,
  tone,
  dialogueLength,
  loading,
  sourceText,
  createAudioCourse,
  audioCourseEnabled,
  courseTitle,
  courseNarratorVoice,
  generationError,
  requestError,
  hasConflictedIntent,
  onGenerate,
  onAbandonConflictedRequest,
}: Pick<
  DialogueGeneratorFormProps,
  | 'targetLanguage'
  | 'jlptLevel'
  | 'tone'
  | 'dialogueLength'
  | 'loading'
  | 'sourceText'
  | 'createAudioCourse'
  | 'audioCourseEnabled'
  | 'courseTitle'
  | 'courseNarratorVoice'
  | 'generationError'
  | 'requestError'
  | 'hasConflictedIntent'
  | 'onGenerate'
  | 'onAbandonConflictedRequest'
>) => {
  const { t } = useTranslation(['dialogue']);
  const courseFieldsMissing = areCourseFieldsMissing({
    createAudioCourse,
    audioCourseEnabled,
    courseTitle,
    courseNarratorVoice,
  });

  return (
    <section className="retro-dialogue-create-v3-summary">
      <div className="retro-dialogue-create-v3-summary-grid">
        <div className="flex-1">
          <h3 className="retro-dialogue-create-v3-summary-title">{t('dialogue:generate.ready')}</h3>
          <p className="retro-dialogue-create-v3-summary-copy">
            {t('dialogue:generate.description', {
              language: SUPPORTED_LANGUAGES[targetLanguage].name,
              level: proficiencyLabel(jlptLevel),
              tone,
            })}
          </p>
          <ul className="retro-dialogue-create-v3-summary-list">
            <li>• {t('dialogue:generate.features.turns', { count: dialogueLength })}</li>
            <li>• {t('dialogue:generate.features.variations')}</li>
            <li>• {t('dialogue:generate.features.translations')}</li>
            <li>• {t('dialogue:generate.features.complexity')}</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || !sourceText.trim() || courseFieldsMissing}
          className="retro-dialogue-create-v3-generate-btn"
          data-testid="dialogue-button-generate"
        >
          {generateButtonLabel(loading, t)}
        </button>
      </div>
      <GenerationAlerts
        generationError={generationError}
        requestError={requestError}
        hasConflictedIntent={hasConflictedIntent}
        onAbandonConflictedRequest={onAbandonConflictedRequest}
      />
    </section>
  );
};

const DialogueGeneratorForm = ({
  nativeLanguage,
  targetLanguage,
  audioCourseEnabled,
  showDemoModal,
  onCloseDemoModal,
  ...formProps
}: DialogueGeneratorFormProps) => {
  const props = {
    nativeLanguage,
    targetLanguage,
    audioCourseEnabled,
    showDemoModal,
    onCloseDemoModal,
    ...formProps,
  };
  const narratorVoices = getSelectableTtsVoices(nativeLanguage);
  const narratorVoiceChoices = narratorVoices.filter((voice) => voice.provider === 'fishaudio');
  const targetVoices = getSelectableTtsVoices(targetLanguage);

  return (
    <div className="space-y-6 retro-dialogue-create-v3-generator">
      <StorySection {...props} />
      <VoiceSection {...props} targetVoices={targetVoices} />
      <AudioSettingsSection {...props} />
      {audioCourseEnabled && (
        <AudioCourseSection {...props} narratorVoiceChoices={narratorVoiceChoices} />
      )}
      <GenerateSummary {...props} />
      <DemoRestrictionModal isOpen={showDemoModal} onClose={onCloseDemoModal} />
    </div>
  );
};

export default DialogueGeneratorForm;
