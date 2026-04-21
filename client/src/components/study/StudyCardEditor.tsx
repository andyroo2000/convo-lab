import { useEffect, useState } from 'react';
import type { StudyAnswerPayload, StudyCardSummary, StudyPromptPayload } from '@shared/types';

interface StudyCardEditorProps {
  card: StudyCardSummary;
  onCancel: () => void;
  onSave: (payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }) => Promise<void> | void;
  isSaving?: boolean;
  error?: string | null;
}

const StudyCardEditor = ({ card, onCancel, onSave, isSaving = false, error }: StudyCardEditorProps) => {
  const [cueText, setCueText] = useState('');
  const [cueReading, setCueReading] = useState('');
  const [cueMeaning, setCueMeaning] = useState('');
  const [answerExpression, setAnswerExpression] = useState('');
  const [answerReading, setAnswerReading] = useState('');
  const [answerMeaning, setAnswerMeaning] = useState('');
  const [notes, setNotes] = useState('');
  const [sentenceJp, setSentenceJp] = useState('');
  const [sentenceEn, setSentenceEn] = useState('');

  useEffect(() => {
    if (card.cardType === 'cloze') {
      setCueText(card.prompt.clozeText ?? '');
      setCueMeaning(card.prompt.clozeHint ?? card.prompt.clozeResolvedHint ?? '');
      setCueReading('');
      setAnswerExpression(card.answer.restoredText ?? '');
      setAnswerReading('');
      setAnswerMeaning(card.answer.meaning ?? '');
      setNotes(card.answer.notes ?? '');
      setSentenceJp('');
      setSentenceEn('');
      return;
    }

    setCueText(card.prompt.cueText ?? '');
    setCueReading(card.prompt.cueReading ?? '');
    setCueMeaning(card.prompt.cueMeaning ?? '');
    setAnswerExpression(card.answer.expression ?? '');
    setAnswerReading(card.answer.expressionReading ?? '');
    setAnswerMeaning(card.answer.meaning ?? '');
    setNotes(card.answer.notes ?? '');
    setSentenceJp(card.answer.sentenceJp ?? '');
    setSentenceEn(card.answer.sentenceEn ?? '');
  }, [card]);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();

        const nextPrompt: StudyPromptPayload =
          card.cardType === 'cloze'
            ? {
                ...card.prompt,
                clozeText: cueText,
                clozeHint: cueMeaning || null,
              }
            : {
                ...card.prompt,
                cueText,
                cueReading: cueReading || null,
                cueMeaning: cueMeaning || null,
              };

        const nextAnswer: StudyAnswerPayload =
          card.cardType === 'cloze'
            ? {
                ...card.answer,
                restoredText: answerExpression,
                meaning: answerMeaning || null,
                notes: notes || null,
              }
            : {
                ...card.answer,
                expression: answerExpression,
                expressionReading: answerReading || null,
                meaning: answerMeaning || null,
                sentenceJp: sentenceJp || null,
                sentenceEn: sentenceEn || null,
                notes: notes || null,
              };

        await onSave({
          prompt: nextPrompt,
          answer: nextAnswer,
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-navy">Edit card</h3>
          <p className="text-sm text-gray-500">
            Save returns you to the front of this card in review mode.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
          {card.cardType}
        </span>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-cue-text">
          {card.cardType === 'cloze' ? 'Cloze text' : 'Prompt text'}
        </label>
        <textarea
          id="study-edit-cue-text"
          value={cueText}
          onChange={(event) => setCueText(event.target.value)}
          className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          required
        />
      </div>

      {card.cardType === 'cloze' ? (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-cloze-hint">
            Cloze hint
          </label>
          <input
            id="study-edit-cloze-hint"
            value={cueMeaning}
            onChange={(event) => setCueMeaning(event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-cue-reading">
              Prompt reading
            </label>
            <input
              id="study-edit-cue-reading"
              value={cueReading}
              onChange={(event) => setCueReading(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-cue-meaning">
              Prompt meaning / hint
            </label>
            <input
              id="study-edit-cue-meaning"
              value={cueMeaning}
              onChange={(event) => setCueMeaning(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="mb-2 block text-sm font-medium text-gray-700"
            htmlFor="study-edit-answer-expression"
          >
            {card.cardType === 'cloze' ? 'Restored answer' : 'Answer expression'}
          </label>
          <input
            id="study-edit-answer-expression"
            value={answerExpression}
            onChange={(event) => setAnswerExpression(event.target.value)}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            required
          />
        </div>
        {card.cardType !== 'cloze' ? (
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="study-edit-answer-reading"
            >
              Answer reading
            </label>
            <input
              id="study-edit-answer-reading"
              value={answerReading}
              onChange={(event) => setAnswerReading(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-answer-meaning">
          Answer meaning
        </label>
        <input
          id="study-edit-answer-meaning"
          value={answerMeaning}
          onChange={(event) => setAnswerMeaning(event.target.value)}
          className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </div>

      {card.cardType !== 'cloze' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-sentence-jp">
              Example sentence (JP)
            </label>
            <textarea
              id="study-edit-sentence-jp"
              value={sentenceJp}
              onChange={(event) => setSentenceJp(event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-sentence-en">
              Example sentence (EN)
            </label>
            <textarea
              id="study-edit-sentence-en"
              value={sentenceEn}
              onChange={(event) => setSentenceEn(event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-edit-notes">
          Notes
        </label>
        <textarea
          id="study-edit-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default StudyCardEditor;
