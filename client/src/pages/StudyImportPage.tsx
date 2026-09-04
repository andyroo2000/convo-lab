import { Trans, useTranslation } from 'react-i18next';

import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import StudyImportForm from '../components/study/StudyImportForm';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';
import { useStudyImportController } from '../hooks/useStudyImportController';

const StudyImportPage = () => {
  const { t } = useTranslation('study');
  const capabilitiesQuery = useStudyCapabilities();
  const maxArchiveBytes = capabilitiesQuery.data?.imports.maxArchiveBytes;
  const maxArchiveGb = maxArchiveBytes ? Math.floor(maxArchiveBytes / 1024 ** 3) : null;
  const controller = useStudyImportController({ maxArchiveBytes, maxArchiveGb });

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="text-3xl font-bold text-navy mb-3">{t('import.title')}</h1>
        <p className="text-gray-600">
          <Trans
            i18nKey="import.description"
            ns="study"
            components={[
              <span key="strong" className="font-semibold" />,
              <span key="unused-1" />,
              <span key="unused-2" />,
              <code key="code" className="mx-1 rounded bg-gray-100 px-2 py-1" />,
            ]}
          />
        </p>
      </section>

      <StudyCapabilitiesError
        isError={capabilitiesQuery.isError}
        isRetrying={capabilitiesQuery.isFetching}
        onRetry={() => {
          capabilitiesQuery.refetch().catch(() => undefined);
        }}
      />

      <StudyImportForm
        error={controller.error}
        file={controller.file}
        importResult={controller.importResult}
        isBusy={controller.isBusy}
        maxArchiveBytes={maxArchiveBytes}
        maxArchiveGb={maxArchiveGb}
        onCancelUpload={() => {
          controller.handleCancelUpload().catch(() => undefined);
        }}
        onFileChange={controller.handleFileChange}
        onSubmit={controller.handleSubmit}
        phase={controller.phase}
        uploadProgress={controller.uploadProgress}
      />
    </div>
  );
};

export default StudyImportPage;
