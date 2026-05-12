import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  canAdjustMonologueVoiceSpeed,
  getMonologueTtsVoices,
  getMonologueVoiceDisplayName,
  getMonologueVoiceSpeedOptions,
  getTtsVoiceById,
  MONOLOGUE_DEFAULT_GOOGLE_NEURAL_SPEED,
  normalizeMonologueVoiceSpeed,
} from '@languageflow/shared/src/voiceSelection';
import type { MonologueSegmentSummary } from '@languageflow/shared/src/types';

import StudyAudioPlayer from '../components/study/StudyAudioPlayer';
import { toAssetUrl } from '../components/study/studyCardUtils';
import {
  useApproveMonologueScript,
  useGenerateMonologueFullAudio,
  useGenerateMonologueSegmentAudioTake,
  useMonologueProject,
  useRegenerateMonologueAudioTake,
  useSetMonologueDefaultAudioTake,
  useUpdateMonologueDraft,
} from '../hooks/useStudy';

interface SegmentDraft {
  id?: string;
  ordinal: number;
  sourceText: string;
  japaneseText: string;
  reading: string;
  beatLabel: string;
}

interface AudioControlState {
  displayName: string;
  isDefault: boolean;
  speed: number;
  voiceId: string;
}

// TODO: derive this from the project target language when monologues expand beyond Japanese.
const monologueVoices = getMonologueTtsVoices('ja');
const defaultVoice =
  monologueVoices.find((voice) => voice.provider === 'google' && voice.id.includes('-Neural2-')) ??
  monologueVoices[0];

function formatVoiceLabel(voiceId: string): string {
  const voice = getTtsVoiceById('ja', voiceId);
  const provider = voice?.provider === 'google' ? 'Google' : 'Fish';
  const label = getMonologueVoiceDisplayName(voice) ?? voiceId;
  return `${provider} ${label}`;
}

function buildDefaultControl(): AudioControlState {
  const voiceId = defaultVoice?.id ?? '';
  return {
    displayName: '',
    isDefault: true,
    speed: MONOLOGUE_DEFAULT_GOOGLE_NEURAL_SPEED,
    voiceId,
  };
}

const SegmentAudioControls = ({
  disabled,
  isBusy,
  onGenerate,
  segment,
}: {
  disabled: boolean;
  isBusy: boolean;
  onGenerate: (segmentId: string, control: AudioControlState) => void;
  segment: MonologueSegmentSummary;
}) => {
  const { t } = useTranslation('study');
  const [control, setControl] = useState<AudioControlState>(() => buildDefaultControl());
  const selectedVoice = getTtsVoiceById('ja', control.voiceId);
  const speedOptions = getMonologueVoiceSpeedOptions(selectedVoice);
  const canAdjustSpeed = canAdjustMonologueVoiceSpeed(selectedVoice);

  useEffect(() => {
    setControl((current) => ({
      ...current,
      speed: normalizeMonologueVoiceSpeed(selectedVoice, current.speed),
    }));
  }, [selectedVoice]);

  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-white/70 p-3">
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_1fr_auto_auto]">
        <label
          htmlFor={`monologue-${segment.id}-voice`}
          className="grid gap-1 text-xs font-semibold text-gray-600"
        >
          {t('monologue.controls.voice')}
          <select
            id={`monologue-${segment.id}-voice`}
            value={control.voiceId}
            onChange={(event) =>
              setControl((current) => ({
                ...current,
                voiceId: event.target.value,
              }))
            }
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm"
          >
            {monologueVoices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.description}
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor={`monologue-${segment.id}-speed`}
          className="grid gap-1 text-xs font-semibold text-gray-600"
        >
          {t('monologue.controls.speed')}
          <select
            id={`monologue-${segment.id}-speed`}
            value={control.speed}
            disabled={!canAdjustSpeed}
            onChange={(event) =>
              setControl((current) => ({
                ...current,
                speed: Number(event.target.value),
              }))
            }
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm disabled:bg-gray-100"
          >
            {speedOptions.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor={`monologue-${segment.id}-take-name`}
          className="grid gap-1 text-xs font-semibold text-gray-600"
        >
          {t('monologue.controls.takeName')}
          <input
            id={`monologue-${segment.id}-take-name`}
            value={control.displayName}
            onChange={(event) =>
              setControl((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm"
            placeholder={`${formatVoiceLabel(control.voiceId)} ${control.speed}x`}
          />
        </label>
        <label
          htmlFor={`monologue-${segment.id}-make-default`}
          className="flex items-center gap-2 self-end text-xs font-semibold text-gray-600"
        >
          <input
            id={`monologue-${segment.id}-make-default`}
            type="checkbox"
            checked={control.isDefault}
            onChange={(event) =>
              setControl((current) => ({
                ...current,
                isDefault: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-gray-300 text-navy"
          />
          {t('monologue.controls.makeDefault')}
        </label>
        <button
          type="button"
          disabled={disabled || isBusy || !control.voiceId}
          onClick={() => onGenerate(segment.id, control)}
          className="self-end rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? t('monologue.controls.generating') : t('monologue.controls.generate')}
        </button>
      </div>
      {!canAdjustSpeed ? (
        <p className="text-xs text-gray-500">{t('monologue.controls.fishFixedSpeed')}</p>
      ) : null}
    </div>
  );
};

const MonologueProjectPage = () => {
  const { t } = useTranslation('study');
  const { projectId } = useParams();
  const projectQuery = useMonologueProject(projectId);
  const updateDraft = useUpdateMonologueDraft();
  const approveScript = useApproveMonologueScript();
  const generateAudio = useGenerateMonologueSegmentAudioTake();
  const regenerateAudio = useRegenerateMonologueAudioTake();
  const setDefaultAudio = useSetMonologueDefaultAudioTake();
  const generateFullAudio = useGenerateMonologueFullAudio();
  const project = projectQuery.data;
  const activeVersion = project?.activeVersion;
  const [title, setTitle] = useState('');
  const [fullText, setFullText] = useState('');
  const [segments, setSegments] = useState<SegmentDraft[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pendingSegmentAudioIds, setPendingSegmentAudioIds] = useState<string[]>([]);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [audioActionErrorMessage, setAudioActionErrorMessage] = useState<string | null>(null);
  const initializedDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.activeVersion) return;
    const draftKey = `${project.id}:${project.activeVersion.id}`;
    if (initializedDraftKeyRef.current === draftKey) return;
    initializedDraftKeyRef.current = draftKey;
    setTitle(project.title);
    setFullText(project.activeVersion.fullText);
    setSaveSucceeded(false);
    setDraftDirty(false);
    setSegments(
      project.activeVersion.segments.map((segment) => ({
        id: segment.id,
        ordinal: segment.ordinal,
        sourceText: segment.sourceText,
        japaneseText: segment.japaneseText,
        reading: segment.reading ?? '',
        beatLabel: segment.beatLabel ?? '',
      }))
    );
  }, [project]);

  useEffect(() => {
    setRecallIndex(0);
    setRevealed(false);
  }, [activeVersion?.id]);

  useEffect(() => {
    if (!draftDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign -- Required by browsers to trigger beforeunload confirmation.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftDirty]);

  const defaultFullTake = useMemo(
    () => project?.fullAudioTakes.find((take) => take.isDefault) ?? project?.fullAudioTakes[0],
    [project?.fullAudioTakes]
  );
  const recallSegment = activeVersion?.segments[recallIndex] ?? null;
  const recallAudio =
    recallSegment?.audioTakes.find((take) => take.isDefault) ?? recallSegment?.audioTakes[0];
  const isApproved = activeVersion?.status === 'approved';
  let approveLabel = t('monologue.actions.approve');
  if (isApproved) {
    approveLabel = t('monologue.actions.approved');
  } else if (approveScript.isPending) {
    approveLabel = t('monologue.actions.approving');
  }
  let scriptErrorMessage = t('monologue.errors.saveScript');
  if (updateDraft.error instanceof Error) {
    scriptErrorMessage = updateDraft.error.message;
  } else if (approveScript.error instanceof Error) {
    scriptErrorMessage = approveScript.error.message;
  }
  function confirmDiscardDraftChanges() {
    // eslint-disable-next-line no-alert -- Standard browser confirmation for unsaved form edits.
    return !draftDirty || window.confirm(t('monologue.unsavedChanges'));
  }

  function getAudioActionErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : t('monologue.errors.audioAction');
  }

  const updateSegment = (index: number, patch: Partial<SegmentDraft>) => {
    setSaveSucceeded(false);
    setDraftDirty(true);
    setSegments((current) =>
      current.map((segment, currentIndex) =>
        currentIndex === index ? { ...segment, ...patch } : segment
      )
    );
  };

  const handleSaveDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    setSaveSucceeded(false);
    try {
      await updateDraft.mutateAsync({
        projectId,
        values: {
          title,
          fullText,
          segments: segments.map((segment) => ({
            id: segment.id,
            sourceText: segment.sourceText,
            japaneseText: segment.japaneseText,
            reading: segment.reading || null,
            beatLabel: segment.beatLabel || null,
          })),
        },
      });
      setSaveSucceeded(true);
      setDraftDirty(false);
    } catch {
      // React Query exposes the error below the form; keep the submit handler settled.
    }
  };

  const handleGenerateAudio = async (segmentId: string, control: AudioControlState) => {
    if (!projectId) return;
    setAudioActionErrorMessage(null);
    setPendingSegmentAudioIds((current) => [...current, segmentId]);
    try {
      await generateAudio.mutateAsync({
        projectId,
        segmentId,
        displayName: control.displayName || null,
        isDefault: control.isDefault,
        speed: control.speed,
        voiceId: control.voiceId,
      });
    } catch (error) {
      setAudioActionErrorMessage(getAudioActionErrorMessage(error));
    } finally {
      setPendingSegmentAudioIds((current) => current.filter((id) => id !== segmentId));
    }
  };

  const handleSetDefaultAudio = async (takeId: string) => {
    if (!projectId) return;
    setAudioActionErrorMessage(null);
    try {
      await setDefaultAudio.mutateAsync({ projectId, takeId });
    } catch (error) {
      setAudioActionErrorMessage(getAudioActionErrorMessage(error));
    }
  };

  const handleRegenerateAudio = async (takeId: string) => {
    if (!projectId) return;
    setAudioActionErrorMessage(null);
    try {
      await regenerateAudio.mutateAsync({ projectId, takeId });
    } catch (error) {
      setAudioActionErrorMessage(getAudioActionErrorMessage(error));
    }
  };

  if (projectQuery.isLoading) {
    return <p className="text-gray-500">{t('monologue.loading')}</p>;
  }

  if (!project || !activeVersion) {
    return (
      <section className="card retro-paper-panel">
        <p className="text-red-600">
          {projectQuery.error instanceof Error
            ? projectQuery.error.message
            : t('monologue.errors.notFound')}
        </p>
        <Link className="mt-4 inline-flex text-navy underline" to="/app/study/monologues">
          {t('monologue.actions.back')}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="text-sm font-semibold text-navy underline"
          to="/app/study/monologues"
          onClick={(event) => {
            if (!confirmDiscardDraftChanges()) event.preventDefault();
          }}
        >
          {t('monologue.actions.back')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-navy">{project.title}</h1>
        <p className="mt-1 text-sm uppercase tracking-[0.14em] text-gray-500">
          {project.status} · {t('monologue.version', { version: activeVersion.versionNumber })}
        </p>
      </div>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">{t('monologue.listen.title')}</h2>
        {defaultFullTake ? (
          <StudyAudioPlayer
            url={toAssetUrl(defaultFullTake.audioUrl) ?? ''}
            label={defaultFullTake.displayName}
          />
        ) : (
          <p className="text-gray-600">{t('monologue.listen.empty')}</p>
        )}
        <button
          type="button"
          disabled={!isApproved || generateFullAudio.isPending}
          onClick={() => projectId && generateFullAudio.mutate(projectId)}
          className="rounded-xl border border-navy px-4 py-2 text-sm font-bold text-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generateFullAudio.isPending
            ? t('monologue.listen.rendering')
            : t('monologue.listen.render')}
        </button>
        {generateFullAudio.error ? (
          <p className="text-sm text-red-600">
            {generateFullAudio.error instanceof Error
              ? generateFullAudio.error.message
              : t('monologue.errors.fullAudio')}
          </p>
        ) : null}
      </section>

      <form className="card retro-paper-panel space-y-4" onSubmit={handleSaveDraft}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy">{t('monologue.script.title')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updateDraft.isPending}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
            >
              {updateDraft.isPending ? t('monologue.actions.saving') : t('monologue.actions.save')}
            </button>
            <button
              type="button"
              disabled={approveScript.isPending || isApproved}
              onClick={() => {
                setSaveSucceeded(false);
                if (projectId) approveScript.mutate(projectId);
              }}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {approveLabel}
            </button>
          </div>
        </div>
        <label
          htmlFor="monologue-project-title"
          className="grid gap-2 text-sm font-semibold text-gray-700"
        >
          {t('monologue.script.projectTitle')}
          <input
            id="monologue-project-title"
            value={title}
            onChange={(event) => {
              setSaveSucceeded(false);
              setDraftDirty(true);
              setTitle(event.target.value);
            }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
          />
        </label>
        <label
          htmlFor="monologue-full-text"
          className="grid gap-2 text-sm font-semibold text-gray-700"
        >
          {t('monologue.script.fullJapanese')}
          <textarea
            id="monologue-full-text"
            value={fullText}
            onChange={(event) => {
              setSaveSucceeded(false);
              setDraftDirty(true);
              setFullText(event.target.value);
            }}
            className="min-h-44 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
          />
        </label>
        <div className="grid gap-3">
          {segments.map((segment, index) => (
            <div
              key={segment.id ?? index}
              className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                {t('monologue.sentenceLabel', { index: index + 1 })}
              </p>
              <input
                aria-label={t('monologue.segmentFields.beatLabel', { index: index + 1 })}
                value={segment.beatLabel}
                onChange={(event) => updateSegment(index, { beatLabel: event.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={t('monologue.segmentFields.beatLabelPlaceholder')}
              />
              <textarea
                aria-label={t('monologue.segmentFields.englishCue', { index: index + 1 })}
                value={segment.sourceText}
                onChange={(event) => updateSegment(index, { sourceText: event.target.value })}
                className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                aria-label={t('monologue.segmentFields.japaneseText', { index: index + 1 })}
                value={segment.japaneseText}
                onChange={(event) => updateSegment(index, { japaneseText: event.target.value })}
                className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                aria-label={t('monologue.segmentFields.reading', { index: index + 1 })}
                value={segment.reading}
                onChange={(event) => updateSegment(index, { reading: event.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={t('monologue.segmentFields.readingPlaceholder')}
              />
            </div>
          ))}
        </div>
        {(updateDraft.error || approveScript.error) && (
          <p className="text-sm text-red-600">{scriptErrorMessage}</p>
        )}
        {saveSucceeded && !updateDraft.error ? (
          <p className="text-sm font-semibold text-green-700">{t('monologue.actions.saved')}</p>
        ) : null}
      </form>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">{t('monologue.audio.title')}</h2>
        {!isApproved ? <p className="text-gray-600">{t('monologue.audio.approveFirst')}</p> : null}
        {audioActionErrorMessage ? (
          <p className="text-sm text-red-600">{audioActionErrorMessage}</p>
        ) : null}
        <div className="grid gap-4">
          {activeVersion.segments.map((segment) => (
            <div key={segment.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                {t('monologue.sentenceLabel', { index: segment.ordinal + 1 })}
              </p>
              <p className="mt-2 text-sm text-gray-600">{segment.sourceText}</p>
              <p className="mt-2 text-lg font-semibold text-navy">{segment.japaneseText}</p>
              {segment.reading ? (
                <p className="mt-1 text-sm text-gray-500">{segment.reading}</p>
              ) : null}
              <div className="mt-3 grid gap-2">
                {segment.audioTakes.map((take) => (
                  <div key={take.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">
                          {take.displayName} {take.isDefault ? t('monologue.audio.default') : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {take.provider ?? 'audio'} · {take.speed}x
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!take.isDefault ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleSetDefaultAudio(take.id);
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-navy"
                          >
                            {t('monologue.audio.setDefault')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            handleRegenerateAudio(take.id);
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-navy"
                        >
                          {t('monologue.audio.regenerate')}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <StudyAudioPlayer
                        url={toAssetUrl(take.audioUrl) ?? ''}
                        label={take.displayName}
                        size="compact"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <SegmentAudioControls
                disabled={!isApproved}
                isBusy={pendingSegmentAudioIds.includes(segment.id)}
                onGenerate={handleGenerateAudio}
                segment={segment}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">{t('monologue.recall.title')}</h2>
        {recallSegment ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              {t('monologue.recall.progress', {
                index: recallIndex + 1,
                count: activeVersion.segments.length,
              })}
            </p>
            <p className="mt-3 text-lg text-navy">{recallSegment.sourceText}</p>
            {revealed ? (
              <div className="mt-4 space-y-2">
                <p className="text-xl font-bold text-navy">{recallSegment.japaneseText}</p>
                {recallSegment.reading ? (
                  <p className="text-gray-500">{recallSegment.reading}</p>
                ) : null}
                {recallAudio ? (
                  <StudyAudioPlayer
                    url={toAssetUrl(recallAudio.audioUrl) ?? ''}
                    label={recallAudio.displayName}
                    size="compact"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRevealed((current) => !current)}
                className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white"
              >
                {revealed ? t('monologue.recall.hide') : t('monologue.recall.reveal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecallIndex((current) => Math.max(0, current - 1));
                  setRevealed(false);
                }}
                disabled={recallIndex === 0}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
              >
                {t('monologue.recall.previous')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecallIndex((current) =>
                    Math.min(activeVersion.segments.length - 1, current + 1)
                  );
                  setRevealed(false);
                }}
                disabled={recallIndex >= activeVersion.segments.length - 1}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
              >
                {t('monologue.recall.next')}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MonologueProjectPage;
