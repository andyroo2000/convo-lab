import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FlashCard from '../components/srs/FlashCard';
import RatingButtons from '../components/srs/RatingButtons';
import api from '../lib/api';

interface Card {
  id: string;
  deckId: string;
  textL2: string;
  readingL2?: string | null;
  translationL1: string;
  audioUrl?: string | null;
  enableRecognition: boolean;
  enableAudio: boolean;
  recognitionDue: string;
  audioDue: string;
}

interface Deck {
  id: string;
  language: string;
  name: string;
}

export default function ReviewPage() {
  const { deckId } = useParams<{ deckId?: string }>();
  const navigate = useNavigate();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showReading, setShowReading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());

  // Fetch decks on mount
  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const decksData = await api.get<Deck[]>('/api/srs/decks');
        setDecks(decksData);

        if (deckId) {
          const deck = decksData.find((d) => d.id === deckId);
          if (deck) {
            setSelectedDeck(deck);
          }
        } else if (decksData.length === 1) {
          // Auto-select if only one deck
          setSelectedDeck(decksData[0]);
        }
      } catch (error) {
        console.error('Failed to fetch decks:', error);
      }
    };

    fetchDecks();
  }, [deckId]);

  // Fetch due cards when deck is selected
  useEffect(() => {
    if (selectedDeck) {
      fetchDueCards();
    }
  }, [selectedDeck]);

  const fetchDueCards = async () => {
    if (!selectedDeck) return;

    setLoading(true);
    try {
      const cardsData = await api.get<Card[]>(
        `/api/srs/decks/${selectedDeck.id}/due?limit=20`
      );
      setDueCards(cardsData);
      setCurrentIndex(0);
      setIsFlipped(false);
      setCompletedCount(0);
      setCardStartTime(Date.now());
    } catch (error) {
      console.error('Failed to fetch due cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentCard = dueCards[currentIndex];

  // Determine which card type to show
  const cardType = currentCard
    ? new Date(currentCard.recognitionDue) <= new Date() &&
      (new Date(currentCard.audioDue) > new Date() ||
        new Date(currentCard.recognitionDue) <= new Date(currentCard.audioDue))
      ? 'recognition'
      : 'audio'
    : 'recognition';

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleRating = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard || submitting) return;

    setSubmitting(true);
    const durationMs = Date.now() - cardStartTime;

    try {
      await api.post('/api/srs/reviews', {
        cardId: currentCard.id,
        cardType,
        rating,
        durationMs,
      });

      setCompletedCount((prev) => prev + 1);

      // Move to next card
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setCardStartTime(Date.now());
      } else {
        // All cards completed
        setDueCards([]);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped && !submitting) {
        if (e.key === '1') handleRating(1);
        else if (e.key === '2') handleRating(2);
        else if (e.key === '3') handleRating(3);
        else if (e.key === '4') handleRating(4);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, handleFlip, submitting, currentCard]);

  // Deck selection screen
  if (!selectedDeck) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Select a Deck</h1>
        {decks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">
              You don't have any decks yet. Start adding vocabulary cards from your courses!
            </p>
            <button
              onClick={() => navigate('/app/library')}
              className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Go to Library
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => setSelectedDeck(deck)}
                className="p-6 border rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
              >
                <h2 className="text-xl font-semibold">{deck.name}</h2>
                <p className="text-gray-600">{deck.language.toUpperCase()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading cards...</p>
        </div>
      </div>
    );
  }

  // Completion screen
  if (dueCards.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">🎉 All Done!</h1>
          <p className="text-xl text-gray-600 mb-6">
            You've completed {completedCount} cards in this session.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/app/library')}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Back to Library
            </button>
            <button
              onClick={() => setSelectedDeck(null)}
              className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Change Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review session
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{selectedDeck.name}</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReading}
              onChange={(e) => setShowReading(e.target.checked)}
              className="rounded"
            />
            Show Reading
          </label>
          <button
            onClick={() => navigate(`/app/decks/${selectedDeck.id}/edit`)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Edit Deck
          </button>
          <button
            onClick={() => setSelectedDeck(null)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Change Deck
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            Card {currentIndex + 1} of {dueCards.length}
          </span>
          <span>{completedCount} completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / dueCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      {currentCard && (
        <FlashCard
          card={currentCard}
          cardType={cardType}
          isFlipped={isFlipped}
          showReading={showReading}
          language={selectedDeck.language}
          onFlip={handleFlip}
        />
      )}

      {/* Rating Buttons */}
      {isFlipped && currentCard && (
        <RatingButtons onRate={handleRating} disabled={submitting} />
      )}
    </div>
  );
}
