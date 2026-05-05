import type { StudyCardCreationKind, StudyCardType } from '@languageflow/shared/src/types';
import { Braces, Eye, Image, Pencil, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import StudyCardAudioSettingsFields from './StudyCardAudioSettingsFields';
import StudyFormField from './StudyFormField';
import type { StudyCardFormValues } from './studyCardFormModel';

interface StudyCardFormFieldsProps {
  values: StudyCardFormValues;
  idPrefix: string;
  includeCardTypeSelect?: boolean;
  includeAudioSettings?: boolean;
  hidePromptFields?: boolean;
  includeSentenceFields?: boolean;
  creationKind?: StudyCardCreationKind;
  onCardTypeChange?: (cardType: StudyCardType) => void;
  onCreationKindChange?: (creationKind: StudyCardCreationKind) => void;
  onFieldChange: <K extends keyof StudyCardFormValues>(
    field: K,
    value: StudyCardFormValues[K]
  ) => void;
}

const CARD_TYPE_OPTIONS = [
  { value: 'recognition', labelKey: 'recognition', Icon: Eye },
  { value: 'production', labelKey: 'production', Icon: Pencil },
  { value: 'cloze', labelKey: 'cloze', Icon: Braces },
] as const;

const CARD_CREATION_KIND_OPTIONS = [
  { value: 'text-recognition', labelKey: 'textRecognition', Icon: Eye },
  { value: 'audio-recognition', labelKey: 'audioRecognition', Icon: Volume2 },
  { value: 'production-text', labelKey: 'productionText', Icon: Pencil },
  { value: 'production-image', labelKey: 'productionImage', Icon: Image },
  { value: 'cloze', labelKey: 'cloze', Icon: Braces },
] as const;

const StudyCardFormFields = ({
  values,
  idPrefix,
  includeCardTypeSelect = false,
  includeAudioSettings = true,
  hidePromptFields = false,
  includeSentenceFields = false,
  creationKind,
  onCardTypeChange,
  onCreationKindChange,
  onFieldChange,
}: StudyCardFormFieldsProps) => {
  const { t } = useTranslation('study');
  const cardTypeLabelId = `${idPrefix}-card-type-label`;

  return (
    <>
      {includeCardTypeSelect ? (
        <div>
          <p id={cardTypeLabelId} className="mb-2 block text-sm font-medium text-gray-700">
            {t('form.cardType')}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={cardTypeLabelId}
            className={`grid grid-cols-1 gap-2 ${
              onCreationKindChange ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-3'
            }`}
          >
            {(onCreationKindChange ? CARD_CREATION_KIND_OPTIONS : CARD_TYPE_OPTIONS).map(
              ({ value, labelKey, Icon }) => {
                const isSelected = onCreationKindChange
                  ? creationKind === value
                  : values.cardType === value;

                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      if (onCreationKindChange) {
                        onCreationKindChange(value as StudyCardCreationKind);
                        return;
                      }
                      onCardTypeChange?.(value as StudyCardType);
                    }}
                    className={`flex min-h-[4.75rem] items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-navy/15 ${
                      isSelected
                        ? 'border-navy/50 bg-cream text-navy shadow-sm'
                        : 'border-gray-300 text-gray-700 hover:border-navy/30 hover:bg-cream/60'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isSelected ? 'bg-navy text-white' : 'bg-navy/5 text-navy'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="font-semibold">{t(`form.${labelKey}`)}</span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      ) : null}

      {!hidePromptFields ? (
        <>
          <StudyFormField
            htmlFor={`${idPrefix}-cue-text`}
            label={values.cardType === 'cloze' ? t('form.clozeText') : t('form.promptText')}
          >
            <textarea
              id={`${idPrefix}-cue-text`}
              value={values.cueText}
              onChange={(event) => onFieldChange('cueText', event.target.value)}
              className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              required
            />
          </StudyFormField>

          {values.cardType === 'cloze' ? (
            <StudyFormField htmlFor={`${idPrefix}-cloze-hint`} label={t('form.clozeHint')}>
              <input
                id={`${idPrefix}-cloze-hint`}
                value={values.cueMeaning}
                onChange={(event) => onFieldChange('cueMeaning', event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              />
            </StudyFormField>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <StudyFormField htmlFor={`${idPrefix}-cue-reading`} label={t('form.promptReading')}>
                <input
                  id={`${idPrefix}-cue-reading`}
                  value={values.cueReading}
                  onChange={(event) => onFieldChange('cueReading', event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </StudyFormField>
              <StudyFormField htmlFor={`${idPrefix}-cue-meaning`} label={t('form.promptMeaning')}>
                <input
                  id={`${idPrefix}-cue-meaning`}
                  value={values.cueMeaning}
                  onChange={(event) => onFieldChange('cueMeaning', event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </StudyFormField>
            </div>
          )}
        </>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <StudyFormField
          htmlFor={`${idPrefix}-answer-expression`}
          label={values.cardType === 'cloze' ? t('form.answer') : t('form.answerExpression')}
        >
          <input
            id={`${idPrefix}-answer-expression`}
            value={values.answerExpression}
            onChange={(event) => onFieldChange('answerExpression', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            required
          />
        </StudyFormField>
        <StudyFormField htmlFor={`${idPrefix}-answer-reading`} label={t('form.answerReading')}>
          <input
            id={`${idPrefix}-answer-reading`}
            value={values.answerReading}
            onChange={(event) => onFieldChange('answerReading', event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            placeholder={
              values.cardType === 'cloze' ? t('form.restoredAnswerReadingPlaceholder') : undefined
            }
          />
        </StudyFormField>
      </div>

      <StudyFormField htmlFor={`${idPrefix}-answer-meaning`} label={t('form.answerMeaning')}>
        <input
          id={`${idPrefix}-answer-meaning`}
          value={values.answerMeaning}
          onChange={(event) => onFieldChange('answerMeaning', event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </StudyFormField>

      {includeAudioSettings ? (
        <StudyCardAudioSettingsFields
          values={values}
          idPrefix={idPrefix}
          onFieldChange={onFieldChange}
        />
      ) : null}

      {includeSentenceFields && values.cardType !== 'cloze' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StudyFormField htmlFor={`${idPrefix}-sentence-jp`} label={t('form.sentenceJp')}>
            <textarea
              id={`${idPrefix}-sentence-jp`}
              value={values.sentenceJp}
              onChange={(event) => onFieldChange('sentenceJp', event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>
          <StudyFormField htmlFor={`${idPrefix}-sentence-en`} label={t('form.sentenceEn')}>
            <textarea
              id={`${idPrefix}-sentence-en`}
              value={values.sentenceEn}
              onChange={(event) => onFieldChange('sentenceEn', event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>
        </div>
      ) : null}

      <StudyFormField htmlFor={`${idPrefix}-notes`} label={t('form.notes')}>
        <textarea
          id={`${idPrefix}-notes`}
          value={values.notes}
          onChange={(event) => onFieldChange('notes', event.target.value)}
          className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </StudyFormField>
    </>
  );
};

export default StudyCardFormFields;
