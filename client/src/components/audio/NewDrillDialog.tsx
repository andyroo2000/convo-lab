import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import useJournalModal from '../../features/journal/useJournalModal';

interface Props {
  limits: { min: number; max: number; default: number };
  replacing: boolean;
  onCreate: (minutes: number) => void;
  onClose: () => void;
}
const NewDrillDialog = ({ limits, replacing, onCreate, onClose }: Props) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const dialog = useJournalModal();
  const [minutes, select] = useState(limits.default);
  const [confirm, setConfirm] = useState(false);
  const options = [
    ...new Set([
      limits.default,
      ...[15, 30, 45, 60].filter((n) => n >= limits.min && n <= limits.max),
    ]),
  ].sort((a, b) => a - b);
  const submit = () => {
    if (replacing && !confirm) setConfirm(true);
    else onCreate(minutes);
  };
  return (
    <dialog ref={dialog} className="new-drill" aria-labelledby="new-drill-title" onCancel={onClose}>
      <h2 id="new-drill-title" aria-live="polite">
        {confirm ? t('replaceTitle') : t('newDrill')}
      </h2>
      {confirm ? (
        <p>{t('replaceMessage')}</p>
      ) : (
        <fieldset>
          <legend>{t('length')}</legend>
          <div className="drill-lengths">
            {options.map((n) => (
              <button type="button" key={n} onClick={() => select(n)} aria-pressed={n === minutes}>
                {t('minutes', { minutes: n })}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <footer>
        <button type="button" className="drill-primary" onClick={submit}>
          {confirm ? t('replace') : t('generate', { minutes })}
        </button>
        <button type="button" onClick={onClose}>
          {t('cancel')}
        </button>
      </footer>
    </dialog>
  );
};
export default NewDrillDialog;
