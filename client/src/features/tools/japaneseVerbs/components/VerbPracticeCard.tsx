import {
  CONJUGATION_BADGE_LABELS,
  REGISTER_BADGE_LABELS,
  type RegisterBadge,
  type VerbGroup,
  type VerbPracticeCard,
} from '../logic/verbConjugation';

interface VerbPracticeCardPanelProps {
  card: VerbPracticeCard | null;
  isNextLedActive: boolean;
  isRevealed: boolean;
  onNext: () => void;
  showFurigana: boolean;
  statusText: string;
}

interface RubyPartProps {
  script: string;
  kana: string;
  showFurigana: boolean;
}

const RUBY_RT_CLASS = '!text-[0.34em] sm:!text-[0.27em]';
const KANJI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/u;
const SCRIPT_PARTS_REGEX = /^([\u3040-\u309f\u30a0-\u30ff]*)(.*?)([\u3040-\u309f\u30a0-\u30ff]*)$/u;

const GROUP_BADGE_CLASSES: Record<VerbGroup, string> = {
  '1': 'retro-verb-badge-group-1',
  '2': 'retro-verb-badge-group-2',
  '3': 'retro-verb-badge-group-3',
};

const REGISTER_BADGE_CLASSES: Record<RegisterBadge, string> = {
  formal: 'retro-verb-badge-register-formal',
  casual: 'retro-verb-badge-register-casual',
  spoken: 'retro-verb-badge-register-spoken',
  colloquial: 'retro-verb-badge-register-colloquial',
};

const trimMatchingAffixes = (kana: string, prefix: string, suffix: string) => {
  const withoutPrefix = prefix && kana.startsWith(prefix) ? kana.slice(prefix.length) : kana;
  return suffix && withoutPrefix.endsWith(suffix)
    ? withoutPrefix.slice(0, withoutPrefix.length - suffix.length)
    : withoutPrefix;
};

const buildRubyParts = (script: string, kana: string) => {
  if (!KANJI_REGEX.test(script)) return null;

  const [, prefix, kanjiPart, suffix] = script.match(SCRIPT_PARTS_REGEX) ?? ['', '', script, ''];
  const reading = trimMatchingAffixes(kana, prefix, suffix);
  return reading ? { prefix, kanjiPart, suffix, reading } : null;
};

const RubyPart = ({ script, kana, showFurigana }: RubyPartProps) => {
  const rubyParts = buildRubyParts(script, kana);
  if (!rubyParts) return <span className="mr-1">{script}</span>;

  return (
    <span className="mr-1">
      {rubyParts.prefix}
      <ruby>
        {rubyParts.kanjiPart}
        <rt className={`${RUBY_RT_CLASS}${showFurigana ? '' : ' invisible'}`}>
          {rubyParts.reading}
        </rt>
      </ruby>
      {rubyParts.suffix}
    </span>
  );
};

const VerbAnswer = ({ card, showFurigana }: { card: VerbPracticeCard; showFurigana: boolean }) => (
  <>
    <p className="japanese-text retro-verb-answer" aria-live="polite">
      <RubyPart
        script={card.answer.script}
        kana={card.answer.reading}
        showFurigana={showFurigana}
      />
    </p>
    {card.referenceAnswer && (
      <p className="retro-verb-reference-answer">
        Textbook: {card.referenceAnswer.script} ({card.referenceAnswer.reading})
      </p>
    )}
    <div className="retro-verb-badge-row mt-2">
      <span className={`retro-verb-badge ${GROUP_BADGE_CLASSES[card.verb.group]}`}>
        Group {card.verb.group}
      </span>
      <span className="retro-verb-badge retro-verb-badge-jlpt">{card.verb.jlptLevel}</span>
    </div>
  </>
);

const VerbCardContent = ({
  card,
  isRevealed,
  showFurigana,
  statusText,
}: {
  card: VerbPracticeCard;
  isRevealed: boolean;
  showFurigana: boolean;
  statusText: string;
}) => (
  <>
    <p className="retro-verb-status" aria-live="polite">
      {statusText || '\u00A0'}
    </p>
    <p className="japanese-text retro-verb-dictionary-form" aria-live="polite">
      <RubyPart
        script={card.verb.dictionary}
        kana={card.verb.reading}
        showFurigana={showFurigana}
      />
    </p>
    <p className="retro-verb-meaning">{card.verb.meaning}</p>
    <div className="retro-verb-badge-row mt-2">
      {card.conjugation.registers.map((register) => (
        <span
          key={`register-${register}`}
          className={`retro-verb-badge ${REGISTER_BADGE_CLASSES[register]}`}
        >
          {REGISTER_BADGE_LABELS[register]}
        </span>
      ))}
      <span className="retro-verb-badge retro-verb-badge-conjugation">
        {CONJUGATION_BADGE_LABELS[card.conjugation.conjugationBadge]}
      </span>
    </div>
    {card.conjugation.promptHint && (
      <p className="retro-verb-prompt-hint" data-testid="verb-colloquial-hint">
        {card.conjugation.promptHint}
      </p>
    )}
    <div className="retro-verb-answer-slot">
      {isRevealed && <VerbAnswer card={card} showFurigana={showFurigana} />}
    </div>
  </>
);

const VerbPracticeCardPanel = ({
  card,
  isNextLedActive,
  isRevealed,
  onNext,
  showFurigana,
  statusText,
}: VerbPracticeCardPanelProps) => (
  <div className="retro-verb-main-panel">
    <div className="retro-verb-sheet" role="region" aria-label="Verb conjugation quiz card">
      {card ? (
        <VerbCardContent
          card={card}
          isRevealed={isRevealed}
          showFurigana={showFurigana}
          statusText={statusText}
        />
      ) : (
        <div className="retro-verb-empty-state" role="status">
          <p className="retro-verb-empty-title">No matching cards.</p>
          <p className="retro-verb-empty-copy">
            Expand JLPT level, verb group, or conjugation filters to generate cards.
          </p>
        </div>
      )}
    </div>
    <div className="retro-verb-next-row">
      <span
        className={`retro-clock-radio-led retro-clock-radio-led-next ${isNextLedActive ? 'is-flash' : ''}`}
      />
      <button
        type="button"
        onClick={onNext}
        className="retro-counter-control-btn retro-verb-next-btn"
        aria-label={isRevealed ? 'Advance to the next item' : 'Show answer'}
        disabled={!card}
      >
        {isRevealed ? 'Next' : 'Show Answer'}
      </button>
    </div>
  </div>
);

export default VerbPracticeCardPanel;
