import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Banknote } from 'lucide-react';

import useToolArrowKeyNavigation from '../../hooks/useToolArrowKeyNavigation';
import {
  createMoneyPracticeCard,
  DEFAULT_MONEY_TIER_ID,
  getNextRandomCardFromTier,
  MONEY_TIERS,
  type MoneyPracticeCard,
  type MoneyTierId,
} from '../logic/moneyPractice';
import {
  buildMoneyReading,
  formatReceiptTimestamp,
  formatYenAmount,
} from '../logic/moneyFormatting';

interface CardSnapshot {
  card: MoneyPracticeCard;
  selectedTierId: MoneyTierId;
  isRevealed: boolean;
}

const HISTORY_LIMIT = 120;
const RUBY_RT_CLASS = 'retro-money-reading-rt';

const JapaneseMoneyToolPage = () => {
  const [selectedTierId, setSelectedTierId] = useState<MoneyTierId>(DEFAULT_MONEY_TIER_ID);
  const [card, setCard] = useState<MoneyPracticeCard>(() =>
    createMoneyPracticeCard(DEFAULT_MONEY_TIER_ID)
  );
  const [isRevealed, setIsRevealed] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);

  const previousCardsRef = useRef<CardSnapshot[]>([]);

  const formattedAmount = useMemo(() => formatYenAmount(card.amount), [card.amount]);
  const reading = useMemo(() => buildMoneyReading(card.amount), [card.amount]);
  const issuedAtLabel = useMemo(() => formatReceiptTimestamp(card.issuedAt), [card.issuedAt]);

  const resetHistory = useCallback(() => {
    previousCardsRef.current = [];
    setHistoryDepth(0);
  }, []);

  const pushCurrentCardToHistory = useCallback(() => {
    previousCardsRef.current.push({
      card,
      selectedTierId,
      isRevealed,
    });

    if (previousCardsRef.current.length > HISTORY_LIMIT) {
      previousCardsRef.current.shift();
    }

    setHistoryDepth(previousCardsRef.current.length);
  }, [card, isRevealed, selectedTierId]);

  const revealCard = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const advanceToNextCard = useCallback((tierId: MoneyTierId) => {
    setCard(getNextRandomCardFromTier(tierId));
    setIsRevealed(false);
  }, []);

  const handleNext = useCallback(() => {
    if (isRevealed) {
      pushCurrentCardToHistory();
      advanceToNextCard(selectedTierId);
      return;
    }

    pushCurrentCardToHistory();
    revealCard();
  }, [advanceToNextCard, isRevealed, pushCurrentCardToHistory, revealCard, selectedTierId]);

  const handlePrevious = useCallback(() => {
    const previousCard = previousCardsRef.current.pop();
    if (!previousCard) {
      return;
    }

    setCard(previousCard.card);
    setSelectedTierId(previousCard.selectedTierId);
    setIsRevealed(previousCard.isRevealed);
    setHistoryDepth(previousCardsRef.current.length);
  }, []);

  const handleTierChange = useCallback(
    (tierId: MoneyTierId) => {
      if (tierId === selectedTierId) {
        return;
      }

      setSelectedTierId(tierId);
      setCard(createMoneyPracticeCard(tierId));
      setIsRevealed(false);
      resetHistory();
    },
    [resetHistory, selectedTierId]
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
        <h2 className="retro-headline text-base sm:text-lg">Amount Tier</h2>
        <div className="retro-money-tier-grid" role="group" aria-label="Money amount tier">
          {MONEY_TIERS.map((tier) => {
            const isActive = selectedTierId === tier.id;

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
      </section>

      <section className="card retro-paper-panel retro-money-card">
        <div
          className={`retro-money-receipt template-${card.templateId}`}
          role="region"
          aria-label="Japanese receipt card"
        >
          <header className="retro-money-receipt-head">
            <p className="retro-money-category">{card.template.categoryLabel}</p>
            <h2 className="retro-money-store">{card.template.storeName}</h2>
            <p className="retro-money-store-kana">{card.template.storeKana}</p>
            <p className="retro-money-meta">
              <span>{card.template.headerLabel}</span>
              <span>Receipt #{card.receiptNumber}</span>
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
            <span className="retro-money-total-label">TOTAL</span>
            <span className="retro-money-total-value" data-testid="money-total-amount">
              {formattedAmount}
            </span>
          </div>
          <div className="retro-money-reading-box" aria-live="polite">
            {isRevealed ? (
              <>
                <p
                  className="japanese-text retro-money-reading-script"
                  data-testid="money-reading-script"
                >
                  <Banknote
                    className="inline-block h-6 w-6 align-[-0.16em] text-[#0f3e6e]"
                    aria-hidden
                  />{' '}
                  {reading.segments.map((segment) => (
                    <span
                      key={`${segment.unitScript || 'ones'}-${segment.digits}-${segment.digitsReading}`}
                      className="retro-money-reading-segment"
                    >
                      <ruby className="retro-money-reading-ruby">
                        {segment.digits}
                        <rt className={RUBY_RT_CLASS}>{segment.digitsReading}</rt>
                      </ruby>
                      {segment.unitScript ? (
                        <span className="retro-money-reading-unit">{segment.unitScript}</span>
                      ) : null}
                    </span>
                  ))}
                  <span className="retro-money-reading-unit">円</span>
                </p>
                <p className="retro-money-reading-kana" data-testid="money-reading-kana">
                  {reading.kana}
                </p>
              </>
            ) : (
              <p className="retro-money-reading-placeholder">
                Press <strong>Show Answer</strong> to reveal the Japanese reading.
              </p>
            )}
          </div>
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
            onClick={handleNext}
            className="retro-money-control-btn is-primary"
            aria-label={isRevealed ? 'Advance to the next amount' : 'Show answer'}
          >
            {nextButtonLabel}
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default JapaneseMoneyToolPage;
