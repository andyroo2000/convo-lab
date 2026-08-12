import { useTranslation } from 'react-i18next';
import type { StudyCardCreationKind, StudyManualCardDraft } from '@languageflow/shared/src/types';

import StudyScrollableListPanel from './StudyScrollableListPanel';

type Props = {
  drafts: StudyManualCardDraft[];
  error: unknown;
  hasNextPage: boolean;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onFetchNextPage: () => void;
  onNewDraft: () => void;
  onSelectDraft: (draftId: string) => void;
  selectedDraftId: string | null;
  total: number;
};

function creationKindLabelKey(creationKind: StudyCardCreationKind) {
  if (creationKind === 'text-recognition') return 'textRecognition';
  if (creationKind === 'audio-recognition') return 'audioRecognition';
  if (creationKind === 'production-text') return 'productionText';
  if (creationKind === 'production-image') return 'productionImage';
  return 'cloze';
}

function draftTitle(draft: StudyManualCardDraft, fallback: string) {
  return (
    draft.prompt.cueText ??
    draft.prompt.clozeDisplayText ??
    draft.prompt.clozeText ??
    draft.answer.expression ??
    draft.answer.restoredText ??
    fallback
  );
}

const StudyManualDraftListPanel = ({
  drafts,
  error,
  hasNextPage,
  isFetchNextPageError,
  isFetchingNextPage,
  isLoading,
  onFetchNextPage,
  onNewDraft,
  onSelectDraft,
  selectedDraftId,
  total,
}: Props) => {
  const { t } = useTranslation('study');
  const errorMessage = error instanceof Error ? error.message : t('create.failedDrafts');

  return (
    <StudyScrollableListPanel
      panelTestId="study-manual-draft-list"
      scrollRegionTestId="study-manual-draft-scroll-region"
      header={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">{t('create.draftQueueCount', { count: total })}</p>
          <button
            type="button"
            onClick={onNewDraft}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.newDraft')}
          </button>
        </div>
      }
      footer={
        <>
          <div className="text-sm text-gray-500">
            <p>
              {drafts.some((draft) => draft.status === 'generating')
                ? t('create.draftQueueGenerating')
                : t('create.draftQueueReady')}
            </p>
            <p className="mt-1">{t('create.draftQueueShowing', { shown: drafts.length, total })}</p>
          </div>
          {hasNextPage ? (
            <button
              type="button"
              onClick={onFetchNextPage}
              disabled={isFetchingNextPage}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingNextPage ? t('create.loadingDrafts') : t('create.loadMoreDrafts')}
            </button>
          ) : null}
          {isFetchNextPageError && error ? (
            <p className="text-xs text-red-600">{errorMessage}</p>
          ) : null}
        </>
      }
    >
      {isLoading ? <p className="p-6 text-gray-500">{t('create.loadingDrafts')}</p> : null}
      {error ? <p className="p-6 text-red-600">{errorMessage}</p> : null}
      {!isLoading && drafts.length === 0 ? (
        <div className="p-6 text-center text-gray-600">{t('create.noDrafts')}</div>
      ) : null}
      {drafts.length > 0 ? (
        <>
          <div className="space-y-3 p-4 md:hidden">
            {drafts.map((draft) => {
              const isSelected = draft.id === selectedDraftId;
              return (
                <button
                  key={draft.id}
                  type="button"
                  data-testid="study-manual-draft-item"
                  onClick={() => onSelectDraft(draft.id)}
                  className={`block w-full rounded-2xl border px-4 py-4 text-left ${
                    isSelected
                      ? 'border-navy bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-cream/50'
                  }`}
                >
                  <p className="break-words text-base font-semibold text-gray-900">
                    {draftTitle(draft, t('create.untitledDraft'))}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    {t(`form.${creationKindLabelKey(draft.creationKind)}`)} ·{' '}
                    {t(`create.draftStatuses.${draft.status}`)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-cream/95 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('create.draftColumn')}</th>
                  <th className="px-4 py-3 font-medium">{t('create.statusColumn')}</th>
                  <th className="px-4 py-3 font-medium">{t('create.createdColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const isSelected = draft.id === selectedDraftId;
                  return (
                    <tr
                      key={draft.id}
                      data-testid="study-manual-draft-row"
                      onClick={() => onSelectDraft(draft.id)}
                      className={`cursor-pointer border-t border-gray-200 ${
                        isSelected ? 'bg-blue-100/70' : 'hover:bg-cream/50'
                      }`}
                    >
                      <td className="max-w-[16rem] px-4 py-3 align-top">
                        <p className="line-clamp-2 break-words text-gray-900">
                          {draftTitle(draft, t('create.untitledDraft'))}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {t(`form.${creationKindLabelKey(draft.creationKind)}`)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {t(`create.draftStatuses.${draft.status}`)}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {new Date(draft.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </StudyScrollableListPanel>
  );
};

export default StudyManualDraftListPanel;
