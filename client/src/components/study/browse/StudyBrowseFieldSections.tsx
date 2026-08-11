import { useTranslation } from 'react-i18next';

import type { StudyBrowserField, StudyBrowserNoteDetail } from '@languageflow/shared/src/types';

import { getAudioMimeType, toAssetUrl } from '../studyCardUtils';

const FieldValue = ({ field }: { field: StudyBrowserField }) => {
  const { t } = useTranslation('study');
  const imageUrl = toAssetUrl(field.image?.url);
  const audioUrl = toAssetUrl(field.audio?.url);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white/80 p-4">
      {field.textValue ? (
        <p className="whitespace-pre-wrap break-words text-gray-900">{field.textValue}</p>
      ) : null}
      {imageUrl ? (
        <img src={imageUrl} alt={field.name} className="max-h-64 rounded-lg object-contain" />
      ) : null}
      {audioUrl ? (
        <audio controls preload="metadata" className="w-full max-w-xl">
          <source src={audioUrl} type={getAudioMimeType(audioUrl, field.audio?.filename)} />
        </audio>
      ) : null}
      {!field.textValue && !imageUrl && !audioUrl ? (
        <p className="text-sm text-gray-400">{t('browse.noPreview')}</p>
      ) : null}
    </div>
  );
};

const FieldList = ({ fields }: { fields: StudyBrowserField[] }) => (
  <div className="mt-4 space-y-4">
    {fields.map((field) => (
      <div key={field.name} className="space-y-2">
        <p className="text-sm font-medium text-gray-700">{field.name}</p>
        <FieldValue field={field} />
      </div>
    ))}
  </div>
);

interface StudyBrowseFieldSectionsProps {
  detail: StudyBrowserNoteDetail;
}

const StudyBrowseFieldSections = ({ detail }: StudyBrowseFieldSectionsProps) => {
  const { t } = useTranslation('study');

  return (
    <>
      <section className="card retro-paper-panel">
        <details open>
          <summary className="cursor-pointer text-lg font-semibold text-navy">
            {t('browse.importedFields')}
          </summary>
          <FieldList fields={detail.rawFields} />
        </details>
      </section>

      {detail.canonicalFields.length ? (
        <section className="card retro-paper-panel">
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-navy">
              {t('browse.canonicalFields')}
            </summary>
            <FieldList fields={detail.canonicalFields} />
          </details>
        </section>
      ) : null}
    </>
  );
};

export default StudyBrowseFieldSections;
