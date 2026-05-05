import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  getSelectableTtsVoices,
  getTtsVoiceById,
  getTtsVoiceAvatarPath,
  type VoiceConfig,
  type VoiceLanguage,
} from '@languageflow/shared/src/voiceSelection';

import VoicePreview from './VoicePreview';

interface VoiceSelectProps {
  disabled?: boolean;
  id: string;
  label: string;
  language: VoiceLanguage;
  onChange: (voiceId: string) => void;
  value: string;
}

function formatVoiceLabel(voice: VoiceConfig): { name: string; meta: string } {
  const [providerPart, detailPart] = voice.description.split(': ');
  const [namePart, traitPart] = (detailPart ?? voice.description).split(' - ');
  const provider = providerPart && detailPart ? providerPart : (voice.provider ?? 'Voice');
  const gender = voice.gender === 'male' ? 'Male' : 'Female';
  const trait = traitPart?.trim() || 'Natural voice';
  const name = namePart?.trim() || voice.id;

  return {
    name,
    meta: `${gender} · ${provider} · ${trait}`,
  };
}

interface VoiceAvatarBadgeProps {
  className?: string;
  language: VoiceLanguage;
  voice: VoiceConfig;
}

const VoiceAvatarBadge = ({ className = '', language, voice }: VoiceAvatarBadgeProps) => {
  const avatarPath = getTtsVoiceAvatarPath(language, voice);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarPath]);

  const badgeClassName = `flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy/5 text-xs font-bold uppercase text-navy ring-1 ring-navy/10 ${className}`;

  if (avatarPath && !imageFailed) {
    return (
      <span className={badgeClassName}>
        <img
          src={avatarPath}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          data-testid={`voice-avatar-image-${voice.id}`}
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return <span className={badgeClassName}>{voice.gender === 'male' ? 'M' : 'F'}</span>;
};

const VoiceSelect = ({
  disabled = false,
  id,
  label,
  language,
  onChange,
  value,
}: VoiceSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const voices = useMemo(() => getSelectableTtsVoices(language), [language]);
  const selectedVoice = useMemo(() => getTtsVoiceById(language, value), [language, value]);
  const hasVoices = voices.length > 0;
  const hasSelectedVoice = Boolean(selectedVoice);
  const hasUnavailableSelection = hasVoices && Boolean(value) && !hasSelectedVoice;
  const isSelectedLegacy = Boolean(selectedVoice?.hiddenFromPicker);
  const menuVoices = selectedVoice?.hiddenFromPicker ? [selectedVoice, ...voices] : voices;
  const isDisabled = disabled || !hasVoices;
  const listboxId = `${id}-listbox`;
  const selectedIndex = menuVoices.findIndex((voice) => voice.id === value);
  const activeOptionId =
    isOpen && menuVoices[activeIndex] ? `${id}-option-${activeIndex}` : undefined;

  const activateOption = (nextIndex: number) => {
    const voiceCount = menuVoices.length;
    if (voiceCount === 0) return;

    setActiveIndex((nextIndex + voiceCount) % voiceCount);
  };

  const selectActiveVoice = () => {
    const activeVoice = menuVoices[activeIndex];
    if (!activeVoice) return;

    onChange(activeVoice.id);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const handleComboboxKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        activateOption(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      activateOption(activeIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        activateOption(selectedIndex >= 0 ? selectedIndex : menuVoices.length - 1);
        return;
      }
      activateOption(activeIndex - 1);
      return;
    }

    if (isOpen && event.key === 'Home') {
      event.preventDefault();
      activateOption(0);
      return;
    }

    if (isOpen && event.key === 'End') {
      event.preventDefault();
      activateOption(menuVoices.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        activateOption(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      selectActiveVoice();
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const formattedSelectedVoice = selectedVoice ? formatVoiceLabel(selectedVoice) : null;
  let selectedLabel = formattedSelectedVoice?.name ?? 'No voices available';
  if (hasUnavailableSelection) {
    selectedLabel = 'Selected voice unavailable';
  }
  const selectedMeta = formattedSelectedVoice?.meta ?? null;

  return (
    <div ref={rootRef} className="relative">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleComboboxKeyDown}
        className="flex min-h-[72px] w-full items-center justify-between gap-4 rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-navy/40 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          {selectedVoice ? (
            <VoiceAvatarBadge className="h-14 w-14" language={language} voice={selectedVoice} />
          ) : null}
          <span id={`${id}-value`} className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-semibold text-navy">{selectedLabel}</span>
              {isSelectedLegacy ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Legacy
                </span>
              ) : null}
            </span>
            {selectedMeta ? (
              <span className="mt-0.5 block truncate text-xs text-gray-500">{selectedMeta}</span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !isDisabled ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute z-30 mt-2 grid max-h-[32rem] w-full grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 text-sm shadow-xl sm:grid-cols-2"
        >
          {menuVoices.map((voice, index) => {
            const formatted = formatVoiceLabel(voice);
            const isSelected = voice.id === value;
            const isActive = index === activeIndex;
            let optionStateClassName = 'border-transparent hover:border-navy/15 hover:bg-cream/70';

            if (isActive) {
              optionStateClassName = 'border-navy/20 bg-cream/80';
            }

            if (isSelected) {
              optionStateClassName = 'border-navy/50 bg-cream';
            }

            return (
              <li
                key={voice.id}
                id={`${id}-option-${index}`}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(voice.id);
                  setIsOpen(false);
                }}
                className={`flex min-h-[13rem] w-full cursor-pointer flex-col items-center justify-start gap-3 rounded-lg border px-3.5 py-4 text-center focus:outline-none ${optionStateClassName}`}
              >
                <VoiceAvatarBadge className="h-24 w-24" language={language} voice={voice} />
                <span className="flex min-w-0 flex-1 flex-col items-center">
                  <span className="flex max-w-full items-center gap-2">
                    <span className="truncate text-base font-semibold text-navy">
                      {formatted.name}
                    </span>
                    {voice.hiddenFromPicker ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        Legacy
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-wrap text-xs leading-snug text-gray-500">
                    {formatted.meta}
                  </span>
                </span>
                {isSelected ? (
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-navy" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {hasUnavailableSelection ? (
        <p className="mt-2 text-xs text-red-600">Selected voice is not available.</p>
      ) : null}
      {hasSelectedVoice ? <VoicePreview voiceId={value} /> : null}
    </div>
  );
};

export default VoiceSelect;
