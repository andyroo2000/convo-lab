import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import api from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

interface Card {
  id: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  audioUrl: string | null;
  enableRecognition: boolean;
  enableAudio: boolean;
  recognitionReps: number;
  audioReps: number;
}

interface Deck {
  id: string;
  name: string;
  language: string;
}

const DeckEditorPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state (only for single card editing)
  const [editedTextL2, setEditedTextL2] = useState('');
  const [editedReadingL2, setEditedReadingL2] = useState('');
  const [editedTranslationL1, setEditedTranslationL1] = useState('');
  const [editedEnableRecognition, setEditedEnableRecognition] = useState(true);
  const [editedEnableAudio, setEditedEnableAudio] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get single selected card for editing
  const selectedCard =
    selectedCardIds.size === 1
      ? filteredCards.find((c) => selectedCardIds.has(c.id)) || null
      : null;

  const fetchDeckAndCards = useCallback(async () => {
    if (!deckId) return;

    setLoading(true);
    try {
      const [deckData, cardsData] = await Promise.all([
        api.get<Deck>(`/api/srs/decks/${deckId}`),
        api.get<Card[]>(`/api/srs/cards?deckId=${deckId}`),
      ]);

      setDeck(deckData);
      setCards(cardsData);
      setFilteredCards(cardsData);
    } catch (error) {
      console.error('Failed to fetch deck and cards:', error);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchDeckAndCards();
  }, [fetchDeckAndCards]);

  useEffect(() => {
    // Filter cards based on search query
    if (searchQuery.trim() === '') {
      setFilteredCards(cards);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCards(
        cards.filter(
          (card) =>
            card.textL2.toLowerCase().includes(query) ||
            card.readingL2?.toLowerCase().includes(query) ||
            card.translationL1.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, cards]);

  // Load edit form when a single card is selected
  useEffect(() => {
    if (selectedCard) {
      setEditedTextL2(selectedCard.textL2);
      setEditedReadingL2(selectedCard.readingL2 || '');
      setEditedTranslationL1(selectedCard.translationL1);
      setEditedEnableRecognition(selectedCard.enableRecognition);
      setEditedEnableAudio(selectedCard.enableAudio);
    }
  }, [selectedCard]);

  const handleSelectCard = (card: Card, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== -1) {
      // Shift-click: select range
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSelectedIds = new Set(selectedCardIds);
      for (let i = start; i <= end; i += 1) {
        newSelectedIds.add(filteredCards[i].id);
      }
      setSelectedCardIds(newSelectedIds);
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl-click: toggle selection
      const newSelectedIds = new Set(selectedCardIds);
      if (newSelectedIds.has(card.id)) {
        newSelectedIds.delete(card.id);
      } else {
        newSelectedIds.add(card.id);
      }
      setSelectedCardIds(newSelectedIds);
      setLastClickedIndex(index);
    } else {
      // Regular click: select single card
      setSelectedCardIds(new Set([card.id]));
      setLastClickedIndex(index);
    }
  };

  const handleSaveCard = async () => {
    if (!selectedCard) return;

    setSaving(true);
    try {
      await api.put(`/api/srs/cards/${selectedCard.id}`, {
        textL2: editedTextL2.trim(),
        readingL2: editedReadingL2.trim() || null,
        translationL1: editedTranslationL1.trim(),
        enableRecognition: editedEnableRecognition,
        enableAudio: editedEnableAudio,
      });

      // Update local state
      const updatedCards = cards.map((card) =>
        card.id === selectedCard.id
          ? {
              ...card,
              textL2: editedTextL2.trim(),
              readingL2: editedReadingL2.trim() || null,
              translationL1: editedTranslationL1.trim(),
              enableRecognition: editedEnableRecognition,
              enableAudio: editedEnableAudio,
            }
          : card
      );
      setCards(updatedCards);
      // selectedCard will automatically update via the computed value
    } catch (error) {
      console.error('Failed to save card:', error);
      console.error('Failed to save card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCardIds.size === 0) return;

    try {
      // Delete all selected cards
      await Promise.all(
        Array.from(selectedCardIds).map((cardId) => api.delete(`/api/srs/cards/${cardId}`))
      );

      // Update local state
      const updatedCards = cards.filter((card) => !selectedCardIds.has(card.id));
      setCards(updatedCards);

      // Clear selection
      setSelectedCardIds(new Set());
      setLastClickedIndex(-1);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete cards:', error);
      console.error('Failed to delete cards. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">Loading cards...</p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-600">Deck not found</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/app/review')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-navy">{deck.name}</h1>
              <p className="text-sm text-gray-600">
                {filteredCards.length} of {cards.length} cards
                {selectedCardIds.size > 0 && ` • ${selectedCardIds.size} selected`}
              </p>
            </div>
          </div>
          {selectedCardIds.size > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Trash2 size={16} />
              Delete Selected ({selectedCardIds.size})
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Card List */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto bg-gray-50">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Expression
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Translation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Reviews
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card, index) => (
                <tr
                  key={card.id}
                  onClick={(e) => handleSelectCard(card, index, e)}
                  className={`cursor-pointer border-b border-gray-200 hover:bg-indigo-50 transition-colors select-none ${
                    selectedCardIds.has(card.id) ? 'bg-indigo-100' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{card.textL2}</div>
                    {card.readingL2 && (
                      <div className="text-sm text-gray-500">{card.readingL2}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700">{card.translationL1}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {card.enableRecognition && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          R
                        </span>
                      )}
                      {card.enableAudio && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                          A
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {card.recognitionReps + card.audioReps}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCards.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? 'No cards match your search' : 'No cards in this deck'}
            </div>
          )}
        </div>

        {/* Card Editor */}
        <div className="w-1/2 bg-white overflow-y-auto">
          {selectedCardIds.size > 1 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <p className="text-lg">{selectedCardIds.size} cards selected</p>
              <p className="text-sm">Select a single card to edit</p>
            </div>
          )}
          {selectedCardIds.size === 1 && selectedCard && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-navy mb-6">Edit Card</h2>

              {/* Text L2 */}
              <div className="mb-4">
                <input
                  type="text"
                  value={editedTextL2}
                  onChange={(e) => setEditedTextL2(e.target.value)}
                  placeholder="Expression"
                  className="w-full px-4 py-3 text-2xl border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Reading L2 */}
              <div className="mb-4">
                <input
                  type="text"
                  value={editedReadingL2}
                  onChange={(e) => setEditedReadingL2(e.target.value)}
                  placeholder="Reading (furigana/pinyin)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Translation L1 */}
              <div className="mb-6">
                <textarea
                  value={editedTranslationL1}
                  onChange={(e) => setEditedTranslationL1(e.target.value)}
                  placeholder="Meaning"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Card Types */}
              <div className="mb-6 space-y-3">
                <label
                  htmlFor="enable-recognition"
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    id="enable-recognition"
                    type="checkbox"
                    checked={editedEnableRecognition}
                    onChange={(e) => setEditedEnableRecognition(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">Recognition Card (L2 → L1)</span>
                </label>

                <label htmlFor="enable-audio" className="flex items-center gap-3 cursor-pointer">
                  <input
                    id="enable-audio"
                    type="checkbox"
                    checked={editedEnableAudio}
                    onChange={(e) => setEditedEnableAudio(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">Audio Card (audio → L2 + L1)</span>
                </label>
              </div>

              {/* Audio Info */}
              {selectedCard.audioUrl && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Audio: Linked from source sentence</p>
                </div>
              )}

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveCard}
                disabled={saving || !editedTextL2.trim() || !editedTranslationL1.trim()}
                className="w-full px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
          {selectedCardIds.size === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a card to edit
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Cards"
        message={`Are you sure you want to delete ${selectedCardIds.size} card${
          selectedCardIds.size > 1 ? 's' : ''
        }? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
};

export default DeckEditorPage;
