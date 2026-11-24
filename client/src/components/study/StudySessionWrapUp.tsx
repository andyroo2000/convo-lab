import { useTranslation } from 'react-i18next';

import JournalAvatar from '../../features/journal/JournalAvatar';
import type { StudySessionWrapUpSummary } from './studySessionWrapUpModel';

interface StudySessionWrapUpProps {
  summary: StudySessionWrapUpSummary;
  caughtUp: boolean;
  onDone: () => void;
}

const StudySessionWrapUp = ({ summary, caughtUp, onDone }: StudySessionWrapUpProps) => {
  const { t } = useTranslation('study');
  const recall =
    summary.firstPassRecall === null
      ? '—'
      : summary.firstPassRecall.toLocaleString(undefined, {
          style: 'percent',
          maximumFractionDigits: 0,
        });

  return (
    <section
      className="mx-auto my-auto w-full max-w-lg px-5 py-10 text-center sm:py-16"
      style={{ fontFamily: "'Crimson Pro', 'Noto Serif JP', Georgia, serif" }}
      aria-labelledby="review-wrap-up-title"
      data-testid="study-session-wrap-up"
    >
      <JournalAvatar
        src="/images/tutor-hana.webp"
        className="mx-auto h-24 w-24 rounded-full bg-white object-contain"
      />
      <h2 id="review-wrap-up-title" lang="ja" className="mt-5 text-3xl leading-snug sm:text-4xl">
        おつかれさまでした！
      </h2>
      <p className="mt-1 text-xl italic text-[#52694e]">{t('wrapUp.title')}</p>
      <p className="mt-5 text-lg">
        {t(caughtUp ? 'wrapUp.description' : 'wrapUp.partialDescription')}
      </p>

      <dl className="my-6 grid grid-cols-2 divide-x divide-[#c9c4b4] border-y border-[#c9c4b4] py-4">
        {[
          [t('wrapUp.reviews'), summary.reviewsCompleted],
          [t('wrapUp.recall'), recall],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse items-center px-2">
            <dt className="text-base text-[#56594f]">{label}</dt>
            <dd className="text-4xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="study-session-reveal" onClick={onDone}>
        {t('wrapUp.done')}
      </button>
    </section>
  );
};

export default StudySessionWrapUp;
