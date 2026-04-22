import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import StudyCardFormFields from '../components/study/StudyCardFormFields';
import { useStudyCardForm } from '../components/study/studyCardFormModel';
import { useCreateStudyCard } from '../hooks/useStudy';

const StudyCreatePage = () => {
  const { t } = useTranslation('study');
  const createCard = useCreateStudyCard();
  const [success, setSuccess] = useState<string | null>(null);
  const { values, setField, setCardType, reset, buildPayload } = useStudyCardForm({
    initialCardType: 'recognition',
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    const payload = buildPayload();

    const created = await createCard.mutateAsync(payload);

    setSuccess(t('create.success', { cardType: created.cardType }));
    reset();
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="text-3xl font-bold text-navy mb-3">{t('create.title')}</h1>
        <p className="text-gray-600">{t('create.description')}</p>
      </section>

      <section className="card retro-paper-panel max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <StudyCardFormFields
            values={values}
            idPrefix="study"
            includeCardTypeSelect
            onCardTypeChange={setCardType}
            onFieldChange={setField}
          />

          {createCard.error ? (
            <p className="text-sm text-red-600">
              {createCard.error instanceof Error ? createCard.error.message : t('create.failed')}
            </p>
          ) : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={createCard.isPending}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createCard.isPending ? t('create.creating') : t('create.submit')}
            </button>
            <Link
              to="/app/study"
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              {t('create.back')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default StudyCreatePage;
