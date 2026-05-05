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
  const listboxId = `${idPrefix}-card-type-listbox`;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isCardKindOpen, setIsCardKindOpen] = useState(false);
  const activeCreationKindIndexRef = useRef(0);
  const selectedCreationKindOption = useMemo(
    () =>
      CARD_CREATION_KIND_OPTIONS.find((option) => option.value === creationKind) ??
      CARD_CREATION_KIND_OPTIONS[0],
    [creationKind]
  );
  const selectedCreationKindIndex = CARD_CREATION_KIND_OPTIONS.findIndex(
    (option) => option.value === selectedCreationKindOption.value
  );
  const [activeCreationKindIndex, setActiveCreationKindIndex] = useState(selectedCreationKindIndex);

  useEffect(() => {
    setActiveCreationKindIndex(selectedCreationKindIndex);
    activeCreationKindIndexRef.current = selectedCreationKindIndex;
  }, [selectedCreationKindIndex]);

  const setActiveCreationKind = useCallback((nextIndex: number) => {
    activeCreationKindIndexRef.current = nextIndex;
    setActiveCreationKindIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (!isCardKindOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsCardKindOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isCardKindOpen]);

  const openCreationKindDropdown = useCallback(
    (nextIndex = selectedCreationKindIndex) => {
      setActiveCreationKind(nextIndex);
      setIsCardKindOpen(true);
      window.requestAnimationFrame(() => {
        optionRefs.current[nextIndex]?.focus();
      });
    },
    [selectedCreationKindIndex, setActiveCreationKind]
  );

  const selectCreationKind = useCallback(
    (nextKind: StudyCardCreationKind) => {
      onCreationKindChange?.(nextKind);
      setIsCardKindOpen(false);
      window.requestAnimationFrame(() => {
        buttonRef.current?.focus();
      });
    },
    [onCreationKindChange]
  );

  const handleCreationKindButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = getNextIndex(
        isCardKindOpen ? activeCreationKindIndexRef.current : selectedCreationKindIndex,
        1,
        CARD_CREATION_KIND_OPTIONS.length
      );
      openCreationKindDropdown(nextIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = getNextIndex(
        isCardKindOpen ? activeCreationKindIndexRef.current : selectedCreationKindIndex,
        -1,
        CARD_CREATION_KIND_OPTIONS.length
      );
      openCreationKindDropdown(nextIndex);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isCardKindOpen) {
        selectCreationKind(CARD_CREATION_KIND_OPTIONS[activeCreationKindIndexRef.current].value);
        return;
      }
      openCreationKindDropdown();
    }
  };

  const handleCreationKindOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    optionIndex: number
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = getNextIndex(
        optionIndex,
        event.key === 'ArrowDown' ? 1 : -1,
        CARD_CREATION_KIND_OPTIONS.length
      );
      setActiveCreationKind(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : CARD_CREATION_KIND_OPTIONS.length - 1;
      setActiveCreationKind(nextIndex);
      optionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsCardKindOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCreationKind(CARD_CREATION_KIND_OPTIONS[optionIndex].value);
    }
  };
  const SelectedCreationKindIcon = selectedCreationKindOption.Icon;

  return (
    <>
      {includeCardTypeSelect ? (
        <div>
          <p id={cardTypeLabelId} className="mb-2 block text-sm font-medium text-gray-700">
            {t('form.cardType')}
          </p>
          {onCreationKindChange ? (
            <div ref={dropdownRef} className="relative">
              <button
                ref={buttonRef}
                type="button"
                role="combobox"
                aria-controls={listboxId}
                aria-expanded={isCardKindOpen}
                aria-haspopup="listbox"
                aria-labelledby={cardTypeLabelId}
                onClick={() => {
                  if (isCardKindOpen) {
                    setIsCardKindOpen(false);
                    return;
                  }
                  openCreationKindDropdown();
                }}
                onKeyDown={handleCreationKindButtonKeyDown}
                className="flex w-full items-center gap-4 rounded-xl border border-navy/45 bg-white px-4 py-3 text-left text-navy shadow-sm transition hover:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                  <SelectedCreationKindIcon aria-hidden="true" className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {t(`form.${selectedCreationKindOption.labelKey}`)}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-600">
                    {t(`form.${selectedCreationKindOption.labelKey}Description`)}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${
                    isCardKindOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isCardKindOpen ? (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={cardTypeLabelId}
                  className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                >
                  {CARD_CREATION_KIND_OPTIONS.map(({ value, labelKey, Icon }, optionIndex) => {
                    const isSelected = creationKind === value;
                    const isActive = activeCreationKindIndex === optionIndex;

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
                        onClick={() => selectCreationKind(value)}
                        onKeyDown={(event) => handleCreationKindOptionKeyDown(event, optionIndex)}
                        onMouseEnter={() => setActiveCreationKind(optionIndex)}
                        className={`flex w-full items-center gap-4 px-4 py-3 text-left transition ${
                          isSelected
                            ? 'bg-cream text-navy'
                            : 'text-gray-700 hover:bg-cream/70 hover:text-navy'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            isSelected ? 'bg-navy text-white' : 'bg-navy/5 text-navy'
                          }`}
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
          ) : (
            <div
              role="radiogroup"
              aria-labelledby={cardTypeLabelId}
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
              })}
            </div>
          )}
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
