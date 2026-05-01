import { useTranslation } from 'react-i18next';

import VoiceSelect from '../common/VoiceSelect';
import StudyFormField from './StudyFormField';
import type { StudyCardFormValues } from './studyCardFormModel';

interface StudyCardAudioSettingsFieldsProps {
  values: StudyCardFormValues;
  idPrefix: string;
  onFieldChange: <K extends keyof StudyCardFormValues>(
    field: K,
    value: StudyCardFormValues[K]
  ) => void;
}

const StudyCardAudioSettingsFields = ({
  values,
  idPrefix,
  onFieldChange,
}: StudyCardAudioSettingsFieldsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Study cards are Japanese-only for now; derive this from card language if that changes. */}
      <VoiceSelect
        id={`${idPrefix}-answer-audio-voice`}
        label={t('form.answerAudioVoice')}
        language="ja"
        value={values.answerAudioVoiceId}
        onChange={(voiceId) => onFieldChange('answerAudioVoiceId', voiceId)}
      />
      <StudyFormField
        htmlFor={`${idPrefix}-answer-audio-override`}
        label={t('form.answerAudioTextOverride')}
      >
        <input
          id={`${idPrefix}-answer-audio-override`}
          value={values.answerAudioTextOverride}
          onChange={(event) => onFieldChange('answerAudioTextOverride', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          placeholder={t('form.answerAudioTextOverridePlaceholder')}
        />
      </StudyFormField>
    </div>
  );
};

export default StudyCardAudioSettingsFields;
