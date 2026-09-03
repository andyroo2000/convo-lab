import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  StudyLearningItem,
  StudyLearningItemStageStatus,
  StudyNewCardQueueItem,
} from '@languageflow/shared/src/types';
import { CheckCircle2, ChevronDown, GripVertical, Layers3, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const browserHref = (cardId: string, noteId: string | null) => {
  const params = new URLSearchParams({ cardId });
  // Native/manual cards are their own browser group and do not expose a note id.
  params.set('noteId', noteId ?? cardId);
  return `/app/study/browse?${params.toString()}`;
};

const stageStatusClass = (status: StudyLearningItemStageStatus, isCurrent: boolean) => {
  if (status === 'retired') return 'bg-green-500';
  if (isCurrent) return 'bg-navy';
  if (status === 'available') return 'bg-sky-300';
  return 'bg-gray-200';
};

const StandaloneLearningItemRow = ({ item }: { item: StudyLearningItem }) => {
  const { t } = useTranslation('study');
  const { representativeCard } = item;

  return (
    <li className="border-b border-navy/10 bg-white/70 last:border-b-0">
      <Link
        to={browserHref(representativeCard.id, representativeCard.noteId)}
        className="block px-4 py-4 hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-navy"
      >
        <p className="break-words font-bold text-navy">{representativeCard.displayText}</p>
        {representativeCard.meaning ? (
          <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">
            {representativeCard.meaning}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
          {t(`form.${representativeCard.cardType}`)}
        </p>
      </Link>
    </li>
  );
};

const LearningPathItemHeader = ({ item }: { item: StudyLearningItem }) => {
  const { t } = useTranslation('study');
  // Keep the family row's title and destination stable as later stages unlock.
  const { representativeCard } = item;

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-sky-100 p-2 text-navy" aria-hidden="true">
        <Layers3 className="h-4 w-4" />
      </span>
      <Link
        to={browserHref(representativeCard.id, representativeCard.noteId)}
        className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-navy"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-bold text-navy">{representativeCard.displayText}</p>
          {item.transferDemonstrated ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-green-700">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {t('cards.transferDemonstrated')}
            </span>
          ) : null}
        </div>
        {representativeCard.meaning ? (
          <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">
            {representativeCard.meaning}
          </p>
        ) : null}
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
          {t('cards.learningPathItem')} ·{' '}
          {item.currentStageNumber === null
            ? t('cards.stageCount', { count: item.stageCount })
            : t('cards.stageProgress', {
                current: item.currentStageNumber,
                total: item.stageCount,
              })}{' '}
          · {t('cards.cardCount', { count: item.cardCount })}
        </p>
      </Link>
    </div>
  );
};

const LearningPathProgress = ({ item }: { item: StudyLearningItem }) => {
  const { t } = useTranslation('study');

  return (
    <div
      className="mt-3 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${Math.max(item.stageCount, 1)}, minmax(0, 1fr))` }}
      role="img"
      aria-label={
        item.currentStageNumber === null
          ? t('cards.pathProgressPending', { total: item.stageCount })
          : t('cards.pathProgressLabel', {
              current: item.currentStageNumber,
              total: item.stageCount,
            })
      }
    >
      {item.stages.map((stage, index) => (
        <span
          key={stage.number ?? stage.representativeCard.syncId}
          className={`h-1.5 rounded-full ${stageStatusClass(
            stage.status,
            stage.number === item.currentStageNumber
          )}`}
          title={t('learningPath.stage', { number: stage.number ?? index + 1 })}
        />
      ))}
    </div>
  );
};

const LearningPathStages = ({ item }: { item: StudyLearningItem }) => {
  const { t } = useTranslation('study');

  return (
    <details className="group mt-3 rounded-xl border border-navy/10 bg-white/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-inset focus:ring-navy">
        {t('cards.viewStages', { count: item.stageCount })}
        <ChevronDown
          className="h-4 w-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ol className="space-y-2 border-t border-navy/10 p-3">
        {item.stages.map((stage, stageIndex) => (
          <li
            key={stage.number ?? stage.representativeCard.syncId}
            className="rounded-lg bg-cream/50 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-navy">
                {t('learningPath.stage', { number: stage.number ?? stageIndex + 1 })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[0.65rem] font-semibold text-gray-600">
                {stage.status === 'locked' ? (
                  <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {stage.status
                  ? t(`learningPath.status.${stage.status}`)
                  : t('cards.independentStage')}
                {' · '}
                {t('cards.cardCount', { count: stage.cardCount })}
              </span>
            </div>
            <ul className="space-y-1">
              {stage.cards.map((card) => (
                <li key={card.syncId}>
                  <Link
                    to={browserHref(card.id, card.noteId)}
                    className="block rounded-lg px-2 py-2 hover:bg-white focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <span className="block break-words text-sm font-semibold text-navy">
                      {card.displayText}
                    </span>
                    {card.meaning ? (
                      <span className="block break-words text-xs text-gray-600">
                        {card.meaning}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
};

const LearningPathItemRow = ({ item }: { item: StudyLearningItem }) => (
  <li
    className="border-b border-navy/10 bg-white/70 px-4 py-4 last:border-b-0"
    data-testid="study-learning-item"
  >
    <LearningPathItemHeader item={item} />
    <LearningPathProgress item={item} />
    <LearningPathStages item={item} />
  </li>
);

export const LearningItemRow = ({ item }: { item: StudyLearningItem }) => {
  if (item.groupId === null) return <StandaloneLearningItemRow item={item} />;
  return <LearningPathItemRow item={item} />;
};

interface QueueRowProps {
  item: StudyNewCardQueueItem;
  ordinal: number;
  reorderDisabled: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}

export const QueueRow = ({
  item,
  ordinal,
  reorderDisabled,
  selectionMode,
  selected,
  onToggleSelected,
}: QueueRowProps) => {
  const { t } = useTranslation('study');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-3 border-b border-navy/10 bg-white/70 px-4 py-4 last:border-b-0 ${
        isDragging ? 'relative z-10 shadow-lg ring-2 ring-navy/30' : ''
      }`}
      data-testid="study-new-queue-row"
    >
      {selectionMode ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={t('cards.selectForLessonFollowup', { text: item.displayText })}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-navy focus:ring-navy"
        />
      ) : (
        <button
          type="button"
          className="mt-0.5 rounded p-1 text-gray-400 hover:bg-cream hover:text-navy focus:outline-none focus:ring-2 focus:ring-navy"
          aria-label={t('cards.dragHandle', { text: item.displayText })}
          disabled={reorderDisabled}
          title={reorderDisabled ? t('cards.reorderLimit') : undefined}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <span className="mt-1 w-8 shrink-0 text-right font-mono text-xs font-bold text-gray-500">
        {ordinal}
      </span>
      <Link
        to={browserHref(item.id, item.noteId)}
        className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-navy"
      >
        <p className="break-words text-base font-bold text-navy">{item.displayText}</p>
        {item.meaning ? (
          <p className="mt-1 line-clamp-2 break-words text-sm text-gray-600">{item.meaning}</p>
        ) : null}
      </Link>
    </li>
  );
};
