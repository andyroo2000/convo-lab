import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  canAdjustMonologueVoiceSpeed,
  getMonologueTtsVoices,
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
  speed: number;
  voiceId: string;
}

const monologueVoices = getMonologueTtsVoices('ja');
const defaultVoice =
  monologueVoices.find((voice) => voice.provider === 'google' && voice.id.includes('-Neural2-')) ??
  monologueVoices[0];

function formatVoiceLabel(voiceId: string): string {
  const voice = getTtsVoiceById('ja', voiceId);
  return voice?.description ?? voiceId;
}

function buildDefaultControl(): AudioControlState {
  const voiceId = defaultVoice?.id ?? '';
  return {
    displayName: '',
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
      <div className="grid gap-3 md:grid-cols-[1.3fr_0.6fr_1fr_auto]">
        <label
          htmlFor={`monologue-${segment.id}-voice`}
          className="grid gap-1 text-xs font-semibold text-gray-600"
        >
          Voice
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
          Speed
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
          Take name
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
        <button
          type="button"
          disabled={disabled || isBusy || !control.voiceId}
          onClick={() => onGenerate(segment.id, control)}
          className="self-end rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {!canAdjustSpeed ? (
        <p className="text-xs text-gray-500">Fish Audio takes are fixed at 1.0x.</p>
      ) : null}
    </div>
  );
};

const MonologueProjectPage = () => {
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
  const initializedDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.activeVersion) return;
    const draftKey = `${project.id}:${project.activeVersion.id}`;
    if (initializedDraftKeyRef.current === draftKey) return;
    initializedDraftKeyRef.current = draftKey;
    setTitle(project.title);
    setFullText(project.activeVersion.fullText);
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

  const defaultFullTake = useMemo(
    () => project?.fullAudioTakes.find((take) => take.isDefault) ?? project?.fullAudioTakes[0],
    [project?.fullAudioTakes]
  );
  const recallSegment = activeVersion?.segments[recallIndex] ?? null;
  const recallAudio =
    recallSegment?.audioTakes.find((take) => take.isDefault) ?? recallSegment?.audioTakes[0];
  const isApproved = activeVersion?.status === 'approved';
  let approveLabel = 'Approve';
  if (isApproved) {
    approveLabel = 'Approved';
  } else if (approveScript.isPending) {
    approveLabel = 'Approving...';
  }
  let scriptErrorMessage = 'Could not save script.';
  if (updateDraft.error instanceof Error) {
    scriptErrorMessage = updateDraft.error.message;
  } else if (approveScript.error instanceof Error) {
    scriptErrorMessage = approveScript.error.message;
  }

  const updateSegment = (index: number, patch: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment, currentIndex) =>
        currentIndex === index ? { ...segment, ...patch } : segment
      )
    );
  };

  const handleSaveDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    await updateDraft.mutateAsync({
      projectId,
      values: {
        title,
        fullText,
        segments: segments.map((segment, index) => ({
          id: segment.id,
          ordinal: index,
          sourceText: segment.sourceText,
          japaneseText: segment.japaneseText,
          reading: segment.reading || null,
          beatLabel: segment.beatLabel || null,
        })),
      },
    });
  };

  const handleGenerateAudio = async (segmentId: string, control: AudioControlState) => {
    if (!projectId) return;
    setPendingSegmentAudioIds((current) => [...current, segmentId]);
    try {
      await generateAudio.mutateAsync({
        projectId,
        segmentId,
        displayName: control.displayName || null,
        isDefault: true,
        speed: control.speed,
        voiceId: control.voiceId,
      });
    } finally {
      setPendingSegmentAudioIds((current) => current.filter((id) => id !== segmentId));
    }
  };

  if (projectQuery.isLoading) {
    return <p className="text-gray-500">Loading monologue...</p>;
  }

  if (!project || !activeVersion) {
    return (
      <section className="card retro-paper-panel">
        <p className="text-red-600">
          {projectQuery.error instanceof Error
            ? projectQuery.error.message
            : 'Monologue not found.'}
        </p>
        <Link className="mt-4 inline-flex text-navy underline" to="/app/study/monologues">
          Back to Monologue Studio
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm font-semibold text-navy underline" to="/app/study/monologues">
          Back to Monologue Studio
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-navy">{project.title}</h1>
        <p className="mt-1 text-sm uppercase tracking-[0.14em] text-gray-500">
          {project.status} · version {activeVersion.versionNumber}
        </p>
      </div>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">Listen</h2>
        {defaultFullTake ? (
          <StudyAudioPlayer
            url={toAssetUrl(defaultFullTake.audioUrl) ?? ''}
            label={defaultFullTake.displayName}
          />
        ) : (
          <p className="text-gray-600">
            Generate sentence audio for every segment, then render full audio.
          </p>
        )}
        <button
          type="button"
          disabled={!isApproved || generateFullAudio.isPending}
          onClick={() => projectId && generateFullAudio.mutate(projectId)}
          className="rounded-xl border border-navy px-4 py-2 text-sm font-bold text-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generateFullAudio.isPending ? 'Rendering...' : 'Render full monologue'}
        </button>
        {generateFullAudio.error ? (
          <p className="text-sm text-red-600">
            {generateFullAudio.error instanceof Error
              ? generateFullAudio.error.message
              : 'Could not render full audio.'}
          </p>
        ) : null}
      </section>

      <form className="card retro-paper-panel space-y-4" onSubmit={handleSaveDraft}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy">Script</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updateDraft.isPending}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
            >
              {updateDraft.isPending ? 'Saving...' : 'Save draft'}
            </button>
            <button
              type="button"
              disabled={approveScript.isPending || isApproved}
              onClick={() => projectId && approveScript.mutate(projectId)}
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
          Title
          <input
            id="monologue-project-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
          />
        </label>
        <label
          htmlFor="monologue-full-text"
          className="grid gap-2 text-sm font-semibold text-gray-700"
        >
          Full Japanese script
          <textarea
            id="monologue-full-text"
            value={fullText}
            onChange={(event) => setFullText(event.target.value)}
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
                Sentence {index + 1}
              </p>
              <input
                aria-label={`Sentence ${index + 1} beat label`}
                value={segment.beatLabel}
                onChange={(event) => updateSegment(index, { beatLabel: event.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Beat label"
              />
              <textarea
                aria-label={`Sentence ${index + 1} English cue`}
                value={segment.sourceText}
                onChange={(event) => updateSegment(index, { sourceText: event.target.value })}
                className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                aria-label={`Sentence ${index + 1} Japanese text`}
                value={segment.japaneseText}
                onChange={(event) => updateSegment(index, { japaneseText: event.target.value })}
                className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                aria-label={`Sentence ${index + 1} reading`}
                value={segment.reading}
                onChange={(event) => updateSegment(index, { reading: event.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Reading"
              />
            </div>
          ))}
        </div>
        {(updateDraft.error || approveScript.error) && (
          <p className="text-sm text-red-600">{scriptErrorMessage}</p>
        )}
      </form>

      <section className="card retro-paper-panel space-y-4">
        <h2 className="text-xl font-bold text-navy">Sentence audio</h2>
        {!isApproved ? (
          <p className="text-gray-600">Approve the script before generating audio.</p>
        ) : null}
        <div className="grid gap-4">
          {activeVersion.segments.map((segment) => (
            <div key={segment.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Sentence {segment.ordinal + 1}
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
                          {take.displayName} {take.isDefault ? '(default)' : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {take.provider ?? 'audio'} · {take.speed}x
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!take.isDefault ? (
                          <button
                            type="button"
                            onClick={() =>
                              projectId && setDefaultAudio.mutate({ projectId, takeId: take.id })
                            }
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-navy"
                          >
                            Set default
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            projectId && regenerateAudio.mutate({ projectId, takeId: take.id })
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-navy"
                        >
                          Regenerate
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
        <h2 className="text-xl font-bold text-navy">Sentence recall</h2>
        {recallSegment ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Sentence {recallIndex + 1} of {activeVersion.segments.length}
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
                {revealed ? 'Hide answer' : 'Reveal'}
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
                Previous
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
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MonologueProjectPage;
