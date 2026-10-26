import { useId, useState } from 'react';
import { ulid } from 'ulid';
import { useTranslation } from 'react-i18next';
import { useSaveStudyPile } from '../../../hooks/useStudyPiles';
import type { StudyPileChapter } from '../../../lib/studyPilesApi';

interface Props {
  pileId?: string;
  item?: StudyPileChapter;
  position?: number;
  onDone?: () => void;
}
const initialValues = (item: StudyPileChapter | undefined, position: number) => ({
  id: item?.id ?? ulid().toLowerCase(),
  title: item?.title ?? '',
  order: item?.position ?? position,
});

const PileForm = ({ pileId, item, position = 0, onDone }: Props) => {
  const titleId = useId();
  const orderId = useId();
  const { t } = useTranslation('study');
  const [initial] = useState(() => initialValues(item, position));
  const [id, setId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [order, setOrder] = useState(String(initial.order));
  const mutation = useSaveStudyPile();
  const submit = async () => {
    await mutation.mutateAsync({
      id,
      pileId,
      attributes: { title: title.trim(), position: Number(order) },
    });
    if (!item) {
      setTitle('');
      setId(ulid().toLowerCase());
      setOrder(String(Number(order) + 1));
    }
    onDone?.();
  };
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit().catch(() => undefined);
      }}
    >
      <label htmlFor={titleId} className="min-w-40 flex-1 text-sm font-semibold">
        {t('piles.title')}
        <input
          id={titleId}
          required
          maxLength={160}
          value={title}
          disabled={mutation.isPending}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded border border-gray-300 bg-white px-3"
        />
      </label>
      <label htmlFor={orderId} className="text-sm font-semibold">
        {t('piles.order')}
        <input
          id={orderId}
          type="number"
          step={1}
          min={0}
          max={1000000}
          required
          value={order}
          disabled={mutation.isPending}
          onChange={(event) => setOrder(event.target.value)}
          className="mt-1 block min-h-11 w-24 rounded border border-gray-300 bg-white px-3"
        />
      </label>
      <button
        type="submit"
        disabled={mutation.isPending || !title.trim()}
        className="min-h-11 rounded bg-navy px-4 font-semibold text-white disabled:opacity-50"
      >
        {t(item ? 'piles.save' : 'piles.add')}
      </button>
      {mutation.isError && (
        <p role="alert" className="w-full text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}
    </form>
  );
};

export default PileForm;
