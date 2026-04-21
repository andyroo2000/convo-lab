import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useCreateStudyCard } from '../hooks/useStudy';

const StudyCreatePage = () => {
  const createCard = useCreateStudyCard();
  const [cardType, setCardType] = useState<'recognition' | 'production' | 'cloze'>('recognition');
  const [cueText, setCueText] = useState('');
  const [cueReading, setCueReading] = useState('');
  const [cueMeaning, setCueMeaning] = useState('');
  const [answerExpression, setAnswerExpression] = useState('');
  const [answerReading, setAnswerReading] = useState('');
  const [answerMeaning, setAnswerMeaning] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);

    const created = await createCard.mutateAsync({
      cardType,
      prompt:
        cardType === 'cloze'
          ? {
              clozeText: cueText,
              clozeHint: cueMeaning,
            }
          : {
              cueText,
              cueReading,
              cueMeaning,
            },
      answer:
        cardType === 'cloze'
          ? {
              restoredText: answerExpression,
              meaning: answerMeaning,
              notes,
            }
          : {
              expression: answerExpression,
              expressionReading: answerReading,
              meaning: answerMeaning,
              notes,
            },
    });

    setSuccess(`Created ${created.cardType} card and seeded it into the study queue.`);
    setCueText('');
    setCueReading('');
    setCueMeaning('');
    setAnswerExpression('');
    setAnswerReading('');
    setAnswerMeaning('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="text-3xl font-bold text-navy mb-3">Create study card</h1>
        <p className="text-gray-600">
          This first pass keeps creation intentionally focused: recognition, production, and cloze
          cards only, with answer-side audio generated automatically when needed.
        </p>
      </section>

      <section className="card retro-paper-panel max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="study-card-type"
            >
              Card type
            </label>
            <select
              id="study-card-type"
              value={cardType}
              onChange={(event) =>
                setCardType(event.target.value as 'recognition' | 'production' | 'cloze')
              }
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            >
              <option value="recognition">Recognition</option>
              <option value="production">Production</option>
              <option value="cloze">Cloze</option>
            </select>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="study-cue-text"
            >
              {cardType === 'cloze' ? 'Cloze text' : 'Prompt text'}
            </label>
            <textarea
              id="study-cue-text"
              value={cueText}
              onChange={(event) => setCueText(event.target.value)}
              className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              required
            />
          </div>

          {cardType !== 'cloze' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-gray-700"
                  htmlFor="study-cue-reading"
                >
                  Prompt reading
                </label>
                <input
                  id="study-cue-reading"
                  value={cueReading}
                  onChange={(event) => setCueReading(event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-gray-700"
                  htmlFor="study-cue-meaning"
                >
                  Prompt meaning / hint
                </label>
                <input
                  id="study-cue-meaning"
                  value={cueMeaning}
                  onChange={(event) => setCueMeaning(event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-700"
                htmlFor="study-cloze-hint"
              >
                Cloze hint
              </label>
              <input
                id="study-cloze-hint"
                value={cueMeaning}
                onChange={(event) => setCueMeaning(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-700"
                htmlFor="study-answer-expression"
              >
                {cardType === 'cloze' ? 'Restored answer' : 'Answer expression'}
              </label>
              <input
                id="study-answer-expression"
                value={answerExpression}
                onChange={(event) => setAnswerExpression(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                required
              />
            </div>
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-700"
                htmlFor="study-answer-reading"
              >
                Answer reading
              </label>
              <input
                id="study-answer-reading"
                value={answerReading}
                onChange={(event) => setAnswerReading(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                disabled={cardType === 'cloze'}
              />
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="study-answer-meaning"
            >
              Answer meaning
            </label>
            <input
              id="study-answer-meaning"
              value={answerMeaning}
              onChange={(event) => setAnswerMeaning(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="study-notes">
              Notes
            </label>
            <textarea
              id="study-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </div>

          {createCard.error ? (
            <p className="text-sm text-red-600">
              {createCard.error instanceof Error
                ? createCard.error.message
                : 'Card creation failed.'}
            </p>
          ) : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={createCard.isPending}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createCard.isPending ? 'Creating…' : 'Create card'}
            </button>
            <Link
              to="/app/study"
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              Back to study
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default StudyCreatePage;
