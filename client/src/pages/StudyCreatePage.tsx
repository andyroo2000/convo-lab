import { useState } from 'react';
import { Link } from 'react-router-dom';

import StudyFormField from '../components/study/StudyFormField';
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
          <StudyFormField htmlFor="study-card-type" label="Card type">
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
          </StudyFormField>

          <StudyFormField
            htmlFor="study-cue-text"
            label={cardType === 'cloze' ? 'Cloze text' : 'Prompt text'}
          >
            <textarea
              id="study-cue-text"
              value={cueText}
              onChange={(event) => setCueText(event.target.value)}
              className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              required
            />
          </StudyFormField>

          {cardType !== 'cloze' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <StudyFormField htmlFor="study-cue-reading" label="Prompt reading">
                <input
                  id="study-cue-reading"
                  value={cueReading}
                  onChange={(event) => setCueReading(event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </StudyFormField>
              <StudyFormField htmlFor="study-cue-meaning" label="Prompt meaning / hint">
                <input
                  id="study-cue-meaning"
                  value={cueMeaning}
                  onChange={(event) => setCueMeaning(event.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                />
              </StudyFormField>
            </div>
          ) : (
            <StudyFormField htmlFor="study-cloze-hint" label="Cloze hint">
              <input
                id="study-cloze-hint"
                value={cueMeaning}
                onChange={(event) => setCueMeaning(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              />
            </StudyFormField>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <StudyFormField
              htmlFor="study-answer-expression"
              label={cardType === 'cloze' ? 'Restored answer' : 'Answer expression'}
            >
              <input
                id="study-answer-expression"
                value={answerExpression}
                onChange={(event) => setAnswerExpression(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                required
              />
            </StudyFormField>
            <StudyFormField htmlFor="study-answer-reading" label="Answer reading">
              <input
                id="study-answer-reading"
                value={answerReading}
                onChange={(event) => setAnswerReading(event.target.value)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                disabled={cardType === 'cloze'}
              />
            </StudyFormField>
          </div>

          <StudyFormField htmlFor="study-answer-meaning" label="Answer meaning">
            <input
              id="study-answer-meaning"
              value={answerMeaning}
              onChange={(event) => setAnswerMeaning(event.target.value)}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

          <StudyFormField htmlFor="study-notes" label="Notes">
            <textarea
              id="study-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

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
