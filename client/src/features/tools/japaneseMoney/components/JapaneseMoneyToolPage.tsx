import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const JapaneseMoneyToolPage = () => {
  const [selectedTierIds, setSelectedTierIds] = useState<MoneyTierId[]>([DEFAULT_MONEY_TIER_ID]);
  const [card, setCard] = useState<MoneyPracticeCard>(() =>
    createMoneyPracticeCardFromTiers([DEFAULT_MONEY_TIER_ID])
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);

  const previousCardsRef = useRef<CardSnapshot[]>([]);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);

  const formattedAmount = useMemo(() => formatYenAmount(card.amount), [card.amount]);
  const reading = useMemo(() => buildMoneyReading(card.amount), [card.amount]);
  const issuedAtLabel = useMemo(() => formatReceiptTimestamp(card.issuedAt), [card.issuedAt]);
  const receiptStyleClass = useMemo(
    () => (card.template.receiptStyle === 'thermal' ? 'receipt-style-thermal' : ''),
    [card.template.receiptStyle]
  );

  const resetHistory = useCallback(() => {
    previousCardsRef.current = [];
    setHistoryDepth(0);
  }, []);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({
      card,
      selectedTierIds,
      isRevealed,
    });

    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }

    setHistoryDepth(previousCardsRef.current.length);
  }, [card, isRevealed, selectedTierIds]);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  const playCurrentCardAudio = useCallback(async () => {
    stopPlayback();

    let currentPlayback: AudioSequencePlayback | null = null;

    try {
      const urls = buildMoneyAudioClipUrls(card.amount);
      const playback = playMoneyAudioClipSequence(urls);
      currentPlayback = playback;
      playbackRef.current = playback;
      setIsPlaying(true);
      setPlaybackHint(null);
      await playback.finished;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!isAbort) {
        setPlaybackHint('Autoplay was blocked. Tap Replay Audio to hear it.');
      }
    } finally {
      if (currentPlayback && playbackRef.current === currentPlayback) {
        playbackRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [card.amount, stopPlayback]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
    playCurrentCardAudio().catch((error) => {
      console.warn('[Money Tool] Unexpected reveal audio rejection:', error);
      setPlaybackHint('Autoplay was blocked. Tap Replay Audio to hear it.');
    });
  }, [playCurrentCardAudio]);

  const advanceToNextCard = useCallback((tierIds: MoneyTierId[]) => {
    setCard(createMoneyPracticeCardFromTiers(tierIds));
    setIsRevealed(false);
    setPlaybackHint(null);
  }, []);

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
    stopPlayback();

    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) {
      return;
    }

    setCard(previousCard.card);
    setSelectedTierIds(previousCard.selectedTierIds);
    setIsRevealed(previousCard.isRevealed);
    setHistoryDepth(previousCardsRef.current.length);
    setPlaybackHint(null);
  }, [stopPlayback]);

  const handleTierChange = useCallback(
    (tierId: MoneyTierId) => {
      const isSelected = selectedTierIds.includes(tierId);
      if (isSelected && selectedTierIds.length === 1) {
        return;
      }

      const nextTierIds = isSelected
        ? selectedTierIds.filter((id) => id !== tierId)
        : [...selectedTierIds, tierId];

      setSelectedTierIds(nextTierIds);
      stopPlayback();
      setCard(createMoneyPracticeCardFromTiers(nextTierIds));
      setIsRevealed(false);
      setPlaybackHint(null);
      resetHistory();
    },
    [resetHistory, selectedTierIds, stopPlayback]
  );

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

  useEffect(
    () => () => {
      stopPlayback();
    },
    [stopPlayback]
  );

  useToolArrowKeyNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
  });

  const nextButtonLabel = isRevealed ? 'Next' : 'Show Answer';

  return (
    <div className="retro-money-page space-y-4 sm:space-y-5">
      <section className="card retro-paper-panel retro-money-card">
        <div className="retro-money-header">
          <h1 className="retro-headline text-2xl sm:text-3xl">Japanese Money</h1>
          <p className="retro-money-kana text-lg font-semibold text-[#2f4f73] sm:text-xl">
            日本語のお金
          </p>
          <p className="retro-money-copy mt-1 text-sm text-[#2f4f73] sm:text-base">
            Read realistic yen totals on receipt-style cards. Start with small purchases, then move
            up to statement-scale amounts.
          </p>
        </div>
      </section>

      <section className="card retro-paper-panel retro-money-card">
        <div className="retro-money-practice-layout">
          <div className="retro-money-main">
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
                    <span className="retro-money-line-value">
                      {formatYenAmount(lineItem.amount)}
                    </span>
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
            <div className="retro-money-reading-box" aria-live="polite">
              {isRevealed ? (
                <p
                  className="japanese-text retro-money-reading-kana"
                  data-testid="money-reading-kana"
                >
                  <Banknote
                    className="inline-block h-5 w-5 align-[-0.12em] text-[#0f3e6e]"
                    aria-hidden
                  />{' '}
                  {reading.kana}
                </p>
              ) : (
                <p className="retro-money-reading-placeholder">
                  Press <strong>Show Answer</strong> to reveal the Japanese reading.
                </p>
              )}
            </div>

            <div className="retro-money-controls" role="group" aria-label="Money quiz controls">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={historyDepth === 0}
                className="retro-money-control-btn"
                aria-label="Go to previous amount"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleReplayAudio}
                disabled={!isRevealed && !isPlaying}
                className="retro-money-control-btn"
                aria-label={isPlaying ? 'Stop audio playback' : 'Replay audio playback'}
              >
                {isPlaying ? 'Stop Audio' : 'Replay Audio'}
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="retro-money-control-btn is-primary"
                aria-label={isRevealed ? 'Advance to the next amount' : 'Show answer'}
              >
                {nextButtonLabel}
                <ArrowRightLeft className="h-4 w-4" />
              </button>
            </div>
            {playbackHint && (
              <p className="retro-money-playback-hint mt-2 text-sm text-[#9e4c2a]">
                {playbackHint}
              </p>
            )}
          </div>

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
                    onClick={() => handleTierChange(tier.id)}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default JapaneseMoneyToolPage;
