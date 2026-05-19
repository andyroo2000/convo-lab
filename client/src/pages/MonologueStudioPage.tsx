import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useCreateMonologueProject, useMonologueProjects } from '../hooks/useStudy';

const MonologueStudioPage = () => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const projectsQuery = useMonologueProjects();
  const createProject = useCreateMonologueProject();
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const project = await createProject.mutateAsync({
        title: title.trim() || null,
        sourceText,
      });
      navigate(`/app/study/monologues/${project.id}`);
    } catch {
      // React Query exposes the error in the form; keep the submit handler settled.
    }
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">{t('monologueStudio.title')}</h1>
          <p className="mt-2 max-w-3xl text-gray-600">{t('monologueStudio.description')}</p>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label
            htmlFor="monologue-title"
            className="grid gap-2 text-sm font-semibold text-gray-700"
          >
            {t('monologueStudio.form.title')}
            <input
              id="monologue-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
              placeholder={t('monologueStudio.form.titlePlaceholder')}
            />
          </label>
          <label
            htmlFor="monologue-source"
            className="grid gap-2 text-sm font-semibold text-gray-700"
          >
            {t('monologueStudio.form.source')}
            <textarea
              id="monologue-source"
              required
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              className="min-h-52 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
              placeholder={t('monologueStudio.form.sourcePlaceholder')}
            />
          </label>
          {createProject.error ? (
            <p className="text-sm text-red-600">
              {createProject.error instanceof Error
                ? createProject.error.message
                : t('monologueStudio.errors.create')}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={createProject.isPending || !sourceText.trim()}
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createProject.isPending
              ? t('monologueStudio.form.generating')
              : t('monologueStudio.form.generate')}
          </button>
        </form>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">{t('monologueStudio.list.title')}</h2>
        {projectsQuery.isLoading ? (
          <p className="text-gray-500">{t('monologueStudio.list.loading')}</p>
        ) : null}
        {projectsQuery.error ? (
          <p className="text-red-600">
            {projectsQuery.error instanceof Error
              ? projectsQuery.error.message
              : t('monologueStudio.errors.load')}
          </p>
        ) : null}
        <div className="grid gap-3">
          {(projectsQuery.data?.projects ?? []).map((project) => (
            <Link
              key={project.id}
              to={`/app/study/monologues/${project.id}`}
              className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-navy/30 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-navy">{project.title}</h3>
                </div>
                <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-navy">
                  {project.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {t('monologueStudio.list.sentenceCount', { count: project.segmentCount })}
              </p>
            </Link>
          ))}
          {!projectsQuery.isLoading && (projectsQuery.data?.projects.length ?? 0) === 0 ? (
            <p className="text-gray-500">{t('monologueStudio.list.empty')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default MonologueStudioPage;
