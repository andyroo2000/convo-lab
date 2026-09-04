import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { ArrowRightLeft, Banknote, Volume2 } from 'lucide-react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import type { AudioSequencePlayback } from '../../logic/audioClipPlayback';
import {
  createMoneyPracticeCardFromTiers,
  DEFAULT_MONEY_TIER_ID,
  MONEY_TIERS,
  type MoneyPracticeCard,
  type MoneyTierId,
} from '../logic/moneyPractice';
import {
  buildMoneyReading,
  formatReceiptTimestamp,
  formatYenAmount,
} from '../logic/moneyFormatting';
import {
  buildMoneyAudioClipUrls,
  playMoneyAudioClipSequence,
} from '../logic/preRenderedMoneyAudio';

interface CardSnapshot {
  card: MoneyPracticeCard;
  selectedTierIds: MoneyTierId[];
  isRevealed: boolean;
}

const HISTORY_LIMIT = 120;

type StateSetter<T> = Dispatch<SetStateAction<T>>;

const stopAudioPlayback = (
  playbackRef: MutableRefObject<AudioSequencePlayback | null>,
  setIsPlaying: StateSetter<boolean>
) => {
  const activePlaybackRef = playbackRef;
  activePlaybackRef.current?.stop();
  activePlaybackRef.current = null;
  setIsPlaying(false);
};

const playCardAudio = async (
  amount: number,
  playbackRef: MutableRefObject<AudioSequencePlayback | null>,
  setIsPlaying: StateSetter<boolean>,
  setPlaybackHint: StateSetter<string | null>
) => {
  stopAudioPlayback(playbackRef, setIsPlaying);
  const activePlaybackRef = playbackRef;
  let currentPlayback: AudioSequencePlayback | null = null;

  try {
    const urls = buildMoneyAudioClipUrls(amount);
    const playback = playMoneyAudioClipSequence(urls);
    currentPlayback = playback;
    activePlaybackRef.current = playback;
    setIsPlaying(true);
    setPlaybackHint(null);
    await playback.finished;
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    if (!isAbort) {
      setPlaybackHint('Autoplay was blocked. Tap Replay Audio to hear it.');
    }
  } finally {
    if (currentPlayback && activePlaybackRef.current === currentPlayback) {
      activePlaybackRef.current = null;
    }
    setIsPlaying(false);
  }
};

interface SaveCardSnapshotOptions {
  card: MoneyPracticeCard;
  selectedTierIds: MoneyTierId[];
  isRevealed: boolean;
  previousCardsRef: MutableRefObject<CardSnapshot[]>;
  setHistoryDepth: StateSetter<number>;
}

const saveCardSnapshot = ({
  card,
  selectedTierIds,
  isRevealed,
  previousCardsRef,
  setHistoryDepth,
}: SaveCardSnapshotOptions) => {
  previousCardsRef.current.push({ card, selectedTierIds, isRevealed });
  if (previousCardsRef.current.length > HISTORY_LIMIT) {
    previousCardsRef.current.shift();
  }
  setHistoryDepth(previousCardsRef.current.length);
};

interface RestorePreviousCardOptions {
  previousCardsRef: MutableRefObject<CardSnapshot[]>;
  playbackRef: MutableRefObject<AudioSequencePlayback | null>;
  setCard: StateSetter<MoneyPracticeCard>;
  setHistoryDepth: StateSetter<number>;
  setIsPlaying: StateSetter<boolean>;
  setIsRevealed: StateSetter<boolean>;
  setPlaybackHint: StateSetter<string | null>;
  setSelectedTierIds: StateSetter<MoneyTierId[]>;
}

const restorePreviousCard = ({
  previousCardsRef,
  playbackRef,
  setCard,
  setHistoryDepth,
  setIsPlaying,
  setIsRevealed,
  setPlaybackHint,
  setSelectedTierIds,
}: RestorePreviousCardOptions) => {
  stopAudioPlayback(playbackRef, setIsPlaying);
  const previousCard = previousCardsRef.current.pop();
  if (!previousCard) {
    return;
  }

  setCard(previousCard.card);
  setSelectedTierIds(previousCard.selectedTierIds);
  setIsRevealed(previousCard.isRevealed);
  setHistoryDepth(previousCardsRef.current.length);
  setPlaybackHint(null);
};

interface ChangeTierOptions {
  tierId: MoneyTierId;
  selectedTierIds: MoneyTierId[];
  previousCardsRef: MutableRefObject<CardSnapshot[]>;
  playbackRef: MutableRefObject<AudioSequencePlayback | null>;
  setCard: StateSetter<MoneyPracticeCard>;
  setHistoryDepth: StateSetter<number>;
  setIsPlaying: StateSetter<boolean>;
  setIsRevealed: StateSetter<boolean>;
  setPlaybackHint: StateSetter<string | null>;
  setSelectedTierIds: StateSetter<MoneyTierId[]>;
}

const changeTier = ({
  tierId,
  selectedTierIds,
  previousCardsRef,
  playbackRef,
  setCard,
  setHistoryDepth,
  setIsPlaying,
  setIsRevealed,
  setPlaybackHint,
  setSelectedTierIds,
}: ChangeTierOptions) => {
  const isSelected = selectedTierIds.includes(tierId);
  if (isSelected && selectedTierIds.length === 1) {
    return;
  }

  const nextTierIds = isSelected
    ? selectedTierIds.filter((id) => id !== tierId)
    : [...selectedTierIds, tierId];

  setSelectedTierIds(nextTierIds);
  stopAudioPlayback(playbackRef, setIsPlaying);
  setCard(createMoneyPracticeCardFromTiers(nextTierIds));
  setIsRevealed(false);
  setPlaybackHint(null);
  const cardHistoryRef = previousCardsRef;
  cardHistoryRef.current = [];
  setHistoryDepth(0);
};

const useMoneyAudioPlayback = (amount: number, isRevealed: boolean) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const stopPlayback = useCallback(() => {
    stopAudioPlayback(playbackRef, setIsPlaying);
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    await playCardAudio(amount, playbackRef, setIsPlaying, setPlaybackHint);
  }, [amount]);

  const handleReplayAudio = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!isRevealed) {
      return;
    }

    playCurrentCardAudio().catch((error) => {
      console.warn('[Money Tool] Replay audio failed:', error);
      setPlaybackHint('Playback failed. Please try again.');
    });
  }, [isPlaying, isRevealed, playCurrentCardAudio, stopPlayback]);

  useEffect(() => stopPlayback, [stopPlayback]);

  return {
    handleReplayAudio,
    isPlaying,
    playbackHint,
    playbackRef,
    playCurrentCardAudio,
    setIsPlaying,
    setPlaybackHint,
    stopPlayback,
  };
};

const useMoneyCardPresentation = (card: MoneyPracticeCard) =>
  useMemo(
    () => ({
      formattedAmount: formatYenAmount(card.amount),
      reading: buildMoneyReading(card.amount),
      issuedAtLabel: formatReceiptTimestamp(card.issuedAt),
      receiptStyleClass: card.template.receiptStyle === 'thermal' ? 'receipt-style-thermal' : '',
      isWideTier: ['lt_10m', 'lt_100m', 'lt_1b', 'lt_10b'].includes(card.tierId),
    }),
    [card.amount, card.issuedAt, card.template.receiptStyle, card.tierId]
  );

const MoneyPageHeader = () => (
  <section className="card retro-paper-panel retro-money-card">
    <div className="retro-money-header">
      <h1 className="retro-headline text-2xl sm:text-3xl">Large Numbers</h1>
      <p className="retro-money-kana text-lg font-semibold text-[#2f4f73] sm:text-xl">大きい数字</p>
      <p className="retro-money-copy mt-1 text-sm text-[#2f4f73] sm:text-base">
        Practice reading large Japanese numbers on receipt-style cards. Start with everyday amounts,
        then move up to statement-scale figures.
      </p>
    </div>
  </section>
);

interface MoneyReceiptProps {
  card: MoneyPracticeCard;
  formattedAmount: string;
  issuedAtLabel: string;
  receiptStyleClass: string;
}

const MoneyReceipt = ({
  card,
  formattedAmount,
  issuedAtLabel,
  receiptStyleClass,
}: MoneyReceiptProps) => (
  <div
    className={`retro-money-receipt template-${card.templateId} store-${card.storeClassName} ${receiptStyleClass}`}
    role="region"
    aria-label="Japanese receipt card"
  >
    <header className="retro-money-receipt-head">
      <span className="retro-money-brand-mark" aria-hidden />
      <p className="retro-money-category">{card.template.categoryLabel}</p>
      <h2 className="retro-money-store">{card.storeName}</h2>
      {card.storeKana ? <p className="retro-money-store-kana">{card.storeKana}</p> : null}
      <p className="retro-money-meta">
        <span>{card.template.headerLabel}</span>
        <span>レシート番号 {card.receiptNumber}</span>
        <span>{issuedAtLabel}</span>
      </p>
    </header>

    <div className="retro-money-line-items">
      {card.lineItems.map((lineItem) => (
        <div className="retro-money-line-item" key={lineItem.id}>
          <span className="retro-money-line-label">{lineItem.description}</span>
          <span className="retro-money-line-value">{formatYenAmount(lineItem.amount)}</span>
        </div>
      ))}
    </div>

    <div className="retro-money-total-row">
      <span className="retro-money-total-label">合計</span>
      <span className="retro-money-total-value" data-testid="money-total-amount">
        {formattedAmount}
      </span>
    </div>
  </div>
);

interface MoneyReadingProps {
  isRevealed: boolean;
  reading: ReturnType<typeof buildMoneyReading>;
}

const MoneyReading = ({ isRevealed, reading }: MoneyReadingProps) => (
  <div className="retro-money-reading-box" aria-live="polite">
    {isRevealed ? (
      <p className="japanese-text retro-money-reading-kana" data-testid="money-reading-kana">
        <Banknote className="inline-block h-5 w-5 align-[-0.12em] text-[#0f3e6e]" aria-hidden />{' '}
        {reading.kana}
      </p>
    ) : (
      <p className="retro-money-reading-placeholder">
        Press <strong>Show Answer</strong> to reveal the Japanese reading.
      </p>
    )}
  </div>
);

interface MoneyControlsProps {
  historyDepth: number;
  isPlaying: boolean;
  isRevealed: boolean;
  playbackHint: string | null;
  onNext: () => void;
  onPrevious: () => void;
  onReplayAudio: () => void;
}

const MoneyControls = ({
  historyDepth,
  isPlaying,
  isRevealed,
  playbackHint,
  onNext,
  onPrevious,
  onReplayAudio,
}: MoneyControlsProps) => (
  <>
    <div className="retro-money-controls" role="group" aria-label="Money quiz controls">
      <button
        type="button"
        onClick={onPrevious}
        disabled={historyDepth === 0}
        className="retro-money-control-btn"
        aria-label="Go to previous amount"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={onReplayAudio}
        disabled={!isRevealed && !isPlaying}
        className="retro-money-control-btn"
        aria-label={isPlaying ? 'Stop audio playback' : 'Replay audio playback'}
      >
        {isPlaying ? 'Stop Audio' : 'Replay Audio'}
        <Volume2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="retro-money-control-btn is-primary"
        aria-label={isRevealed ? 'Advance to the next amount' : 'Show answer'}
      >
        {isRevealed ? 'Next' : 'Show Answer'}
        <ArrowRightLeft className="h-4 w-4" />
      </button>
    </div>
    {playbackHint && (
      <p className="retro-money-playback-hint mt-2 text-sm text-[#9e4c2a]">{playbackHint}</p>
    )}
  </>
);

interface MoneyTierPanelProps {
  selectedTierIds: MoneyTierId[];
  onTierChange: (tierId: MoneyTierId) => void;
}

const MoneyTierPanel = ({ selectedTierIds, onTierChange }: MoneyTierPanelProps) => (
  <aside className="retro-money-tier-panel" aria-label="Amount Tier filter">
    <h2 className="retro-headline retro-money-tier-title">Amount Tier</h2>
    <div className="retro-money-tier-grid" role="group" aria-label="Amount Tier">
      {MONEY_TIERS.map((tier) => {
        const isActive = selectedTierIds.includes(tier.id);

        return (
          <button
            key={tier.id}
            type="button"
            aria-pressed={isActive}
            aria-label={`Use amount tier ${tier.label}`}
            className={`retro-money-tier-btn ${isActive ? 'is-active' : ''}`}
            onClick={() => onTierChange(tier.id)}
          >
            {tier.label}
          </button>
        );
      })}
    </div>
  </aside>
);

const JapaneseMoneyToolPage = () => {
  const [selectedTierIds, setSelectedTierIds] = useState<MoneyTierId[]>([DEFAULT_MONEY_TIER_ID]);
  const [card, setCard] = useState<MoneyPracticeCard>(() =>
    createMoneyPracticeCardFromTiers([DEFAULT_MONEY_TIER_ID])
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);
  const previousCardsRef = useRef<CardSnapshot[]>([]);
  const {
    handleReplayAudio,
    isPlaying,
    playbackHint,
    playbackRef,
    playCurrentCardAudio,
    setIsPlaying,
    setPlaybackHint,
    stopPlayback,
  } = useMoneyAudioPlayback(card.amount, isRevealed);

  const presentation = useMoneyCardPresentation(card);

  const pushCurrentCardToHistory = useCallback(() => {
    saveCardSnapshot({
      card,
      selectedTierIds,
      isRevealed,
      previousCardsRef,
      setHistoryDepth,
    });
  }, [card, isRevealed, selectedTierIds]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio().catch((error) => {
      console.warn('[Money Tool] Unexpected reveal audio rejection:', error);
      setPlaybackHint('Autoplay was blocked. Tap Replay Audio to hear it.');
    });
  }, [playCurrentCardAudio, setPlaybackHint]);

  const advanceToNextCard = useCallback(
    (tierIds: MoneyTierId[]) => {
      setCard(createMoneyPracticeCardFromTiers(tierIds));
      setIsRevealed(false);
      setPlaybackHint(null);
    },
    [setPlaybackHint]
  );

  const handleNext = useCallback(() => {
    stopPlayback();

    if (isRevealed) {
      pushCurrentCardToHistory();
      advanceToNextCard(selectedTierIds);
      return;
    }

    // Intentionally preserve an unrevealed snapshot before reveal so learners can step back through both states.
    pushCurrentCardToHistory();
    revealCard();
  }, [
    advanceToNextCard,
    isRevealed,
    pushCurrentCardToHistory,
    revealCard,
    selectedTierIds,
    stopPlayback,
  ]);

  const handlePrevious = useCallback(() => {
    restorePreviousCard({
      previousCardsRef,
      playbackRef,
      setCard,
      setHistoryDepth,
      setIsPlaying,
      setIsRevealed,
      setPlaybackHint,
      setSelectedTierIds,
    });
  }, [playbackRef, setIsPlaying, setPlaybackHint]);

  const handleTierChange = useCallback(
    (tierId: MoneyTierId) => {
      changeTier({
        tierId,
        selectedTierIds,
        previousCardsRef,
        playbackRef,
        setCard,
        setHistoryDepth,
        setIsPlaying,
        setIsRevealed,
        setPlaybackHint,
        setSelectedTierIds,
      });
    },
    [playbackRef, selectedTierIds, setIsPlaying, setPlaybackHint]
  );

  useToolArrowKeyNavigation({ onNext: handleNext, onPrevious: handlePrevious });

  return (
    <div className="retro-money-page space-y-4 sm:space-y-5">
      <MoneyPageHeader />

      <section className="card retro-paper-panel retro-money-card">
        <div className="retro-money-practice-layout">
          <div className={`retro-money-main${presentation.isWideTier ? ' is-wide-tier' : ''}`}>
            <MoneyReceipt
              card={card}
              formattedAmount={presentation.formattedAmount}
              issuedAtLabel={presentation.issuedAtLabel}
              receiptStyleClass={presentation.receiptStyleClass}
            />
            <MoneyReading isRevealed={isRevealed} reading={presentation.reading} />
            <MoneyControls
              historyDepth={historyDepth}
              isPlaying={isPlaying}
              isRevealed={isRevealed}
              playbackHint={playbackHint}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onReplayAudio={handleReplayAudio}
            />
          </div>
          <MoneyTierPanel selectedTierIds={selectedTierIds} onTierChange={handleTierChange} />
        </div>
      </section>
    </div>
  );
};

export default JapaneseMoneyToolPage;
