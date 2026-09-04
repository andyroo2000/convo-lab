import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { StudyCardCreationKind, StudyCardType } from '@languageflow/shared/src/types';
import { Braces, ChevronDown, Eye, Image, Pencil, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import StudyCardAudioSettingsFields from './StudyCardAudioSettingsFields';
import StudyFormField from './StudyFormField';
import type { StudyCardFormValues } from './studyCardFormModel';

interface StudyCardFormFieldsProps {
  values: StudyCardFormValues;
  idPrefix: string;
  includeCardTypeSelect?: boolean;
  includeAudioSettings?: boolean;
  includeNotesField?: boolean;
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

const getNextIndex = (currentIndex: number, direction: 1 | -1, optionCount: number) =>
  (currentIndex + direction + optionCount) % optionCount;

function getArrowIndex(key: string, currentIndex: number) {
  if (key === 'ArrowDown') return getNextIndex(currentIndex, 1, CARD_CREATION_KIND_OPTIONS.length);
  if (key === 'ArrowUp') return getNextIndex(currentIndex, -1, CARD_CREATION_KIND_OPTIONS.length);
  return null;
}

function getBoundaryIndex(key: string) {
  if (key === 'Home') return 0;
  if (key === 'End') return CARD_CREATION_KIND_OPTIONS.length - 1;
  return null;
}

function isSelectionKey(key: string) {
  return key === 'Enter' || key === ' ';
}

export const StudyCardNotesField = ({
  values,
  idPrefix,
  onFieldChange,
}: Pick<StudyCardFormFieldsProps, 'values' | 'idPrefix' | 'onFieldChange'>) => {
  const { t } = useTranslation('study');

  return (
    <StudyFormField htmlFor={`${idPrefix}-notes`} label={t('form.notes')}>
      <textarea
        id={`${idPrefix}-notes`}
        value={values.notes}
        onChange={(event) => onFieldChange('notes', event.target.value)}
        className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
      />
    </StudyFormField>
  );
};

const CreationKindSelect = ({
  creationKind,
  idPrefix,
  onCreationKindChange,
}: {
  creationKind?: StudyCardCreationKind;
  idPrefix: string;
  onCreationKindChange: (creationKind: StudyCardCreationKind) => void;
}) => {
  const { t } = useTranslation('study');
  const cardTypeLabelId = `${idPrefix}-card-type-label`;
  const listboxId = `${idPrefix}-card-type-listbox`;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const activeIndexRef = useRef(0);
  const selectedOption = useMemo(
    () =>
      CARD_CREATION_KIND_OPTIONS.find((option) => option.value === creationKind) ??
      CARD_CREATION_KIND_OPTIONS[0],
    [creationKind]
  );
  const selectedIndex = CARD_CREATION_KIND_OPTIONS.findIndex(
    (option) => option.value === selectedOption.value
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    setActiveIndex(selectedIndex);
    activeIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const activate = useCallback((nextIndex: number) => {
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const open = useCallback(
    (nextIndex = selectedIndex) => {
      activate(nextIndex);
      setIsOpen(true);
      window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
    },
    [activate, selectedIndex]
  );

  const select = useCallback(
    (nextKind: StudyCardCreationKind) => {
      onCreationKindChange(nextKind);
      setIsOpen(false);
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    },
    [onCreationKindChange]
  );

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const startIndex = isOpen ? activeIndexRef.current : selectedIndex;
    const arrowIndex = getArrowIndex(event.key, startIndex);
    if (arrowIndex !== null) {
      event.preventDefault();
      open(arrowIndex);
      return;
    }
    if (!isSelectionKey(event.key)) return;
    event.preventDefault();
    if (isOpen) {
      select(CARD_CREATION_KIND_OPTIONS[activeIndexRef.current].value);
      return;
    }
    open();
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) => {
    const arrowIndex = getArrowIndex(event.key, optionIndex);
    if (arrowIndex !== null) {
      event.preventDefault();
      activate(arrowIndex);
      optionRefs.current[arrowIndex]?.focus();
      return;
    }
    const boundaryIndex = getBoundaryIndex(event.key);
    if (boundaryIndex !== null) {
      event.preventDefault();
      activate(boundaryIndex);
      optionRefs.current[boundaryIndex]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (isSelectionKey(event.key)) {
      event.preventDefault();
      select(CARD_CREATION_KIND_OPTIONS[optionIndex].value);
    }
  };
  const SelectedIcon = selectedOption.Icon;

  return (
    <div
      ref={dropdownRef}
      data-testid={`${idPrefix}-creation-kind-dropdown`}
      className={`relative ${isOpen ? 'z-40' : ''}`}
    >
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={cardTypeLabelId}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          open();
        }}
        onKeyDown={handleButtonKeyDown}
        className="flex w-full items-center gap-4 rounded-xl border border-navy/45 bg-white px-4 py-3 text-left text-navy shadow-sm transition hover:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white">
          <SelectedIcon aria-hidden="true" className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t(`form.${selectedOption.labelKey}`)}</span>
          <span className="mt-0.5 block text-sm text-gray-600">
            {t(`form.${selectedOption.labelKey}Description`)}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={cardTypeLabelId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {CARD_CREATION_KIND_OPTIONS.map(({ value, labelKey, Icon }, optionIndex) => {
            const isSelected = creationKind === value;
            const isActive = activeIndex === optionIndex;
            return (
              <button
                key={value}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(value)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
                onMouseEnter={() => activate(optionIndex)}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left transition ${isSelected ? 'bg-cream text-navy' : 'text-gray-700 hover:bg-cream/70 hover:text-navy'}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-navy text-white' : 'bg-navy/5 text-navy'}`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(`form.${labelKey}`)}</span>
                  <span className="mt-0.5 block text-sm text-gray-600">
                    {t(`form.${labelKey}Description`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const CardTypeField = ({
  creationKind,
  idPrefix,
  onCardTypeChange,
  onCreationKindChange,
  values,
}: Pick<
  StudyCardFormFieldsProps,
  'creationKind' | 'idPrefix' | 'onCardTypeChange' | 'onCreationKindChange' | 'values'
>) => {
  const { t } = useTranslation('study');
  const labelId = `${idPrefix}-card-type-label`;
  return (
    <div>
      <p id={labelId} className="mb-2 block text-sm font-medium text-gray-700">
        {t('form.cardType')}
      </p>
      {onCreationKindChange ? (
        <CreationKindSelect
          creationKind={creationKind}
          idPrefix={idPrefix}
          onCreationKindChange={onCreationKindChange}
        />
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {CARD_TYPE_OPTIONS.map(({ value, labelKey, Icon }) => {
            const isSelected = values.cardType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onCardTypeChange?.(value as StudyCardType)}
                className={`flex min-h-[4.75rem] items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-navy/15 ${isSelected ? 'border-navy/50 bg-cream text-navy shadow-sm' : 'border-gray-300 text-gray-700 hover:border-navy/30 hover:bg-cream/60'}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-navy text-white' : 'bg-navy/5 text-navy'}`}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="font-semibold">{t(`form.${labelKey}`)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PromptFields = ({
  idPrefix,
  onFieldChange,
  values,
}: Pick<StudyCardFormFieldsProps, 'idPrefix' | 'onFieldChange' | 'values'>) => {
  const { t } = useTranslation('study');
  return (
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
  );
};

const AnswerFields = ({
  idPrefix,
  onFieldChange,
  values,
}: Pick<StudyCardFormFieldsProps, 'idPrefix' | 'onFieldChange' | 'values'>) => {
  const { t } = useTranslation('study');
  return (
    <>
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
    </>
  );
};

const SentenceFields = ({
  idPrefix,
  onFieldChange,
  values,
}: Pick<StudyCardFormFieldsProps, 'idPrefix' | 'onFieldChange' | 'values'>) => {
  const { t } = useTranslation('study');
  return (
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
  );
};

const StudyCardFormFields = ({
  values,
  idPrefix,
  includeCardTypeSelect = false,
  includeAudioSettings = true,
  includeNotesField = true,
  hidePromptFields = false,
  includeSentenceFields = false,
  creationKind,
  onCardTypeChange,
  onCreationKindChange,
  onFieldChange,
}: StudyCardFormFieldsProps) => (
  <>
    {includeCardTypeSelect ? (
      <CardTypeField
        creationKind={creationKind}
        idPrefix={idPrefix}
        onCardTypeChange={onCardTypeChange}
        onCreationKindChange={onCreationKindChange}
        values={values}
      />
    ) : null}
    {!hidePromptFields ? (
      <PromptFields idPrefix={idPrefix} onFieldChange={onFieldChange} values={values} />
    ) : null}
    <AnswerFields idPrefix={idPrefix} onFieldChange={onFieldChange} values={values} />
    {includeAudioSettings ? (
      <StudyCardAudioSettingsFields
        values={values}
        idPrefix={idPrefix}
        onFieldChange={onFieldChange}
      />
    ) : null}

    {includeSentenceFields && values.cardType !== 'cloze' ? (
      <SentenceFields idPrefix={idPrefix} onFieldChange={onFieldChange} values={values} />
    ) : null}
    {includeNotesField ? (
      <StudyCardNotesField values={values} idPrefix={idPrefix} onFieldChange={onFieldChange} />
    ) : null}
  </>
);

export default StudyCardFormFields;
