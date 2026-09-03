/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SPEAKER_COLORS } from '@languageflow/shared/src/constants-new';
import { getRandomName } from '@languageflow/shared/src/nameConstants';
import {
  getCourseSpeakerVoices,
  getDialogueSpeakerVoices,
  getTtsVoiceById,
} from '@languageflow/shared/src/voiceSelection';
import {
  CreateEpisodeRequest,
  LanguageCode,
  ProficiencyLevel,
  Speaker,
  ToneStyle,
} from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import { useIsDemo } from '../../hooks/useDemo';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import {
  CourseGenerationIntentPayload,
  submitCourseGenerationIntent,
} from '../../lib/courseGenerationRequest';
import {
  acknowledgeGenerationIntent,
  abandonGenerationIntent,
  GenerationIntent,
  readGenerationIntent,
  writeGenerationIntent,
} from '../../lib/generationIntentStore';
import {
  generationRequestErrorMessage,
  isAcknowledgedGenerationFailure,
  isDefinitiveGenerationRejection,
} from '../../lib/generationRequest';
import { DialogueCompleteState, DialogueGeneratingState } from './DialogueGenerationStatus';
import DialogueGeneratorForm, { SpeakerFormData } from './DialogueGeneratorForm';
import {
  generateCompletedDialogueAudio,
  generateCompletedDialogueCourse,
} from './dialogueCompletion';

interface DialogueGenerationIntentPayload {
  episode: CreateEpisodeRequest;
  dialogue: {
    speakers: Speaker[];
    variationCount: number;
    dialogueLength: number;
    options: {
      jlptLevel: string;
      vocabSeedOverride: string;
      grammarSeedOverride: string;
    };
  };
  viewAsUserId?: string;
}

// Note: Speaker colors are now assigned at runtime based on index, not stored in the database
// This constant is kept for backward compatibility with episode creation API
const DEFAULT_SPEAKER_COLORS = SPEAKER_COLORS;

const DialogueGenerator = () => {
  const { t } = useTranslation(['dialogue']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const isDemo = useIsDemo();
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const {
    createEpisode,
    generateDialogue,
    generateAllSpeedsAudio,
    getEpisode,
    pollJobStatus,
    loading,
    error,
  } = useEpisodes();
  const invalidateLibrary = useInvalidateLibrary();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [conflictedIntent, setConflictedIntent] =
    useState<GenerationIntent<DialogueGenerationIntentPayload> | null>(null);
  const [conflictedCourseIntent, setConflictedCourseIntent] =
    useState<GenerationIntent<CourseGenerationIntentPayload> | null>(null);

  const [sourceText, setSourceText] = useState('');
  const targetLanguage: LanguageCode = 'ja';
  const nativeLanguage: LanguageCode = 'en';
  const [dialogueLength, setDialogueLength] = useState(8);
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [tone, setTone] = useState<ToneStyle>('casual');
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(true);
  const [vocabSeedOverride, setVocabSeedOverride] = useState('');
  const [grammarSeedOverride, setGrammarSeedOverride] = useState('');
  const [createAudioCourse, setCreateAudioCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseMaxDuration, setCourseMaxDuration] = useState(30);
  const [courseNarratorVoice, setCourseNarratorVoice] = useState('');

  // Initialize speakers based on target language with unique voices
  const [speakers, setSpeakers] = useState<SpeakerFormData[]>(() => {
    const speakerVoices = getDialogueSpeakerVoices(targetLanguage, 2);
    return speakerVoices.map((speaker, index) => ({
      name: getRandomName(targetLanguage, speaker.gender as 'male' | 'female'),
      voiceId: speaker.voiceId,
      proficiency: 'intermediate' as ProficiencyLevel,
      tone: 'casual' as ToneStyle,
      color: DEFAULT_SPEAKER_COLORS[index],
    }));
  });
  const audioCourseEnabled = isFeatureEnabled('audioCourseEnabled');

  // Keep speaker tone in sync with selection without resetting voices
  useEffect(() => {
    setSpeakers((prev) =>
      prev.map((speaker) => ({
        ...speaker,
        tone,
      }))
    );
  }, [tone]);

  // Initialize narrator voice for optional audio course creation
  useEffect(() => {
    const { narratorVoice } = getCourseSpeakerVoices(targetLanguage, nativeLanguage, 2);
    setCourseNarratorVoice((prev) => prev || narratorVoice);
  }, [nativeLanguage, targetLanguage]);

  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollingRunRef = useRef<symbol | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const submissionInFlightRef = useRef(false);
  const courseRecoveryInFlightRef = useRef(false);
  const dialogueRecoveryAttemptedForOwnerRef = useRef<string | null>(null);
  const courseRecoveryAttemptedForOwnerRef = useRef<string | null>(null);

  const scopedRoute = useCallback(
    (path: string, scopedUserId = viewAsUserId) =>
      scopedUserId ? `${path}?${new URLSearchParams({ viewAs: scopedUserId })}` : path,
    [viewAsUserId]
  );

  // Helper function to get proficiency level
  const getProficiencyLevel = () => jlptLevel;

  const createCourseFromEpisode = useCallback(
    async (episodeId: string, signal: AbortSignal): Promise<string | null> => {
      if (!createAudioCourse || !audioCourseEnabled) return null;
      const ownerId = viewAsUserId ?? user?.id;
      if (!ownerId) throw new Error('Your account is still loading. Please try again.');

      const getTargetVoiceGender = (voiceId: string): 'male' | 'female' => {
        const match = getTtsVoiceById(targetLanguage, voiceId);
        return match?.gender === 'female' ? 'female' : 'male';
      };

      const payload: CourseGenerationIntentPayload = {
        course: {
          title: courseTitle.trim(),
          episodeIds: [episodeId],
          nativeLanguage,
          targetLanguage,
          maxLessonDurationMinutes: courseMaxDuration,
          l1VoiceId: courseNarratorVoice,
          jlptLevel,
          speaker1Gender: getTargetVoiceGender(speakers[0]?.voiceId),
          speaker2Gender: getTargetVoiceGender(speakers[1]?.voiceId),
          speaker1VoiceId: speakers[0]?.voiceId,
          speaker2VoiceId: speakers[1]?.voiceId,
        },
        ...(viewAsUserId ? { viewAsUserId } : {}),
      };
      const intent =
        readGenerationIntent<CourseGenerationIntentPayload>(ownerId, 'dialogue-course') ??
        writeGenerationIntent(ownerId, 'dialogue-course', payload);
      try {
        const { courseId, acknowledgement } = await submitCourseGenerationIntent(
          intent.intentId,
          intent.payload,
          signal
        );
        if (acknowledgement.state === 'failed') {
          acknowledgeGenerationIntent(intent);
          throw new Error(acknowledgement.message || 'Course generation failed.');
        }
        acknowledgeGenerationIntent(intent);
        return courseId;
      } catch (caught) {
        const acknowledgedFailure = isAcknowledgedGenerationFailure(caught, intent.intentId);
        const definitiveRejection = isDefinitiveGenerationRejection(caught);
        if (acknowledgedFailure) {
          acknowledgeGenerationIntent(intent);
        }
        if (definitiveRejection) {
          acknowledgeGenerationIntent(intent);
        }
        if (!acknowledgedFailure && !definitiveRejection) setConflictedCourseIntent(intent);
        throw caught;
      }
    },
    [
      audioCourseEnabled,
      courseMaxDuration,
      courseNarratorVoice,
      courseTitle,
      createAudioCourse,
      jlptLevel,
      nativeLanguage,
      speakers,
      targetLanguage,
      user?.id,
      viewAsUserId,
    ]
  );

  // pollJobStatus owns the entire poll-until-terminal loop. This effect owns exactly one
  // abortable run for the current job and rejects all completions from superseded runs.
  useEffect(() => {
    if (!jobId) return undefined;

    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    const controller = new AbortController();
    const runToken = Symbol(jobId);
    pollingRunRef.current = runToken;
    const isCurrentRun = () => pollingRunRef.current === runToken && !controller.signal.aborted;

    const run = async () => {
      try {
        const status = await pollJobStatus(jobId, undefined, 'dialogue', controller.signal);
        if (!isCurrentRun()) return;

        if (status === 'completed') {
          setCourseError(null);

          let createdCourseId: string | null = null;

          const isCurrentAfterAudio = await generateCompletedDialogueAudio({
            enabled: !!generatedEpisodeId && autoGenerateAudio,
            signal: controller.signal,
            isCurrentRun,
            loadDialogueId: async (signal) => {
              if (!generatedEpisodeId) return undefined;
              const episode = await getEpisode(generatedEpisodeId, false, undefined, signal);
              return episode.dialogue?.id;
            },
            generateAudio: (dialogueId, signal) =>
              generatedEpisodeId
                ? generateAllSpeedsAudio(generatedEpisodeId, dialogueId, signal)
                : Promise.resolve(),
          });
          if (!isCurrentAfterAudio) return;

          const courseResult = await generateCompletedDialogueCourse({
            enabled: !!generatedEpisodeId && createAudioCourse && audioCourseEnabled,
            signal: controller.signal,
            isCurrentRun,
            createCourse: (signal) =>
              generatedEpisodeId
                ? createCourseFromEpisode(generatedEpisodeId, signal)
                : Promise.resolve(null),
            onError: (caughtCourseError) => {
              console.error('Failed to create audio course:', caughtCourseError);
              setCourseError(
                caughtCourseError instanceof Error
                  ? caughtCourseError.message
                  : t('dialogue:complete.courseFailureFallback')
              );
            },
          });
          if (!courseResult.isCurrent) return;
          createdCourseId = courseResult.courseId;

          if (!isCurrentRun()) return;
          setStep('complete');

          // Invalidate library cache so new episode shows up
          invalidateLibrary();

          const shouldAutoRedirect = !createAudioCourse || !!createdCourseId;

          if (shouldAutoRedirect) {
            // Navigate to playback page or course page
            redirectTimerRef.current = window.setTimeout(() => {
              redirectTimerRef.current = null;
              if (!isCurrentRun()) return;
              if (createdCourseId) {
                navigate(scopedRoute(`/app/courses/${createdCourseId}`));
              } else if (generatedEpisodeId) {
                navigate(scopedRoute(`/app/playback/${generatedEpisodeId}`));
              }
            }, 2000);
          }
        } else if (status === 'failed') {
          setJobId(null);
          setStep('input');
          // eslint-disable-next-line no-alert
          alert(t('dialogue:alerts.generationFailed'));
        }
      } catch (pollError) {
        if (isCurrentRun()) {
          console.error('Failed to poll dialogue generation:', pollError);
        }
      }
    };

    run().catch(() => undefined);

    return () => {
      if (pollingRunRef.current === runToken) {
        pollingRunRef.current = null;
      }
      controller.abort();
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [
    jobId,
    generatedEpisodeId,
    autoGenerateAudio,
    createAudioCourse,
    audioCourseEnabled,
    createCourseFromEpisode,
    pollJobStatus,
    getEpisode,
    generateAllSpeedsAudio,
    navigate,
    scopedRoute,
  ]);

  const runDialogueIntent = useCallback(
    async (intent: GenerationIntent<DialogueGenerationIntentPayload>) => {
      setGenerationError(null);
      setConflictedIntent(null);
      setCourseError(null);
      setStep('generating');

      try {
        const episodeRequest = { ...intent.payload.episode, id: intent.intentId };
        const episode = intent.payload.viewAsUserId
          ? await createEpisode(episodeRequest, intent.payload.viewAsUserId)
          : await createEpisode(episodeRequest);
        if (episode.id !== intent.intentId) {
          throw new Error('The server created a different episode for this generation request.');
        }
        setGeneratedEpisodeId(episode.id);

        const acknowledgement = await generateDialogue(
          episode.id,
          intent.payload.dialogue.speakers,
          intent.payload.dialogue.variationCount,
          intent.payload.dialogue.dialogueLength,
          {
            ...intent.payload.dialogue.options,
            clientRequestId: intent.intentId,
            ...(intent.payload.viewAsUserId ? { viewAsUserId: intent.payload.viewAsUserId } : {}),
          }
        );
        if (acknowledgement.clientRequestId !== intent.intentId) {
          throw new Error('The server acknowledged a different generation request.');
        }
        if (acknowledgement.state === 'failed') {
          acknowledgeGenerationIntent(intent);
          throw new Error(acknowledgement.message || 'Dialogue generation failed.');
        }

        // The exact generation acknowledgement completes the browser submission transaction.
        // The durable server ledger owns queue/job recovery from this point onward.
        acknowledgeGenerationIntent(intent);
        setJobId(acknowledgement.jobId);
      } catch (caught) {
        const acknowledgedFailure = isAcknowledgedGenerationFailure(caught, intent.intentId);
        const definitiveRejection = isDefinitiveGenerationRejection(caught);
        if (acknowledgedFailure) {
          acknowledgeGenerationIntent(intent);
        }
        if (definitiveRejection) {
          acknowledgeGenerationIntent(intent);
        }
        console.error('Failed to generate dialogue:', caught);
        if (!acknowledgedFailure && !definitiveRejection) setConflictedIntent(intent);
        setGenerationError(
          generationRequestErrorMessage(caught, 'Failed to generate dialogue. Please try again.')
        );
        setStep('input');
      } finally {
        submissionInFlightRef.current = false;
      }
    },
    [createEpisode, generateDialogue]
  );

  useEffect(() => {
    const ownerId = viewAsUserId ?? user?.id;
    if (
      !ownerId ||
      courseRecoveryAttemptedForOwnerRef.current === ownerId ||
      courseRecoveryInFlightRef.current
    ) {
      return;
    }
    courseRecoveryAttemptedForOwnerRef.current = ownerId;

    try {
      const savedIntent = readGenerationIntent<CourseGenerationIntentPayload>(
        ownerId,
        'dialogue-course'
      );
      if (!savedIntent) return;
      courseRecoveryInFlightRef.current = true;
      const recoveredEpisodeId = savedIntent.payload.course.episodeIds?.[0];
      if (recoveredEpisodeId) setGeneratedEpisodeId(recoveredEpisodeId);
      setStep('generating');
      submitCourseGenerationIntent(savedIntent.intentId, savedIntent.payload)
        .then(({ courseId, acknowledgement }) => {
          acknowledgeGenerationIntent(savedIntent);
          if (acknowledgement.state === 'failed') {
            throw new Error(acknowledgement.message || 'Course generation failed.');
          }
          setStep('complete');
          invalidateLibrary();
          navigate(scopedRoute(`/app/courses/${courseId}`, savedIntent.payload.viewAsUserId));
        })
        .catch((caught: unknown) => {
          const acknowledgedFailure = isAcknowledgedGenerationFailure(caught, savedIntent.intentId);
          const definitiveRejection = isDefinitiveGenerationRejection(caught);
          if (acknowledgedFailure) {
            acknowledgeGenerationIntent(savedIntent);
          }
          if (definitiveRejection) {
            acknowledgeGenerationIntent(savedIntent);
          }
          if (!acknowledgedFailure && !definitiveRejection) {
            setConflictedCourseIntent(savedIntent);
          }
          setCourseError(generationRequestErrorMessage(caught, 'Failed to create audio course.'));
          setStep('complete');
        })
        .finally(() => {
          courseRecoveryInFlightRef.current = false;
        });
    } catch (caught) {
      setCourseError(
        caught instanceof Error ? caught.message : 'Could not recover the saved course request.'
      );
    }
  }, [invalidateLibrary, navigate, scopedRoute, user?.id, viewAsUserId]);

  useEffect(() => {
    const ownerId = viewAsUserId ?? user?.id;
    if (
      !ownerId ||
      dialogueRecoveryAttemptedForOwnerRef.current === ownerId ||
      submissionInFlightRef.current
    ) {
      return;
    }
    dialogueRecoveryAttemptedForOwnerRef.current = ownerId;

    try {
      const savedIntent = readGenerationIntent<DialogueGenerationIntentPayload>(
        ownerId,
        'dialogue'
      );
      if (!savedIntent) return;
      submissionInFlightRef.current = true;
      runDialogueIntent(savedIntent).catch(() => undefined);
    } catch (caught) {
      setGenerationError(
        caught instanceof Error ? caught.message : 'Could not recover the saved generation request.'
      );
    }
  }, [runDialogueIntent, user?.id, viewAsUserId]);

  const handleGenerate = async () => {
    if (submissionInFlightRef.current) return;

    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    if (!sourceText.trim()) {
      // eslint-disable-next-line no-alert
      alert(t('dialogue:alerts.fillRequired'));
      return;
    }

    if (speakers.length < 2) {
      // eslint-disable-next-line no-alert
      alert(t('dialogue:alerts.twoSpeakers'));
      return;
    }

    if (createAudioCourse && audioCourseEnabled) {
      if (!courseTitle.trim() || !courseNarratorVoice) {
        // eslint-disable-next-line no-alert
        alert(t('dialogue:alerts.courseFields'));
        return;
      }
    }

    const ownerId = viewAsUserId ?? user?.id;
    if (!ownerId) {
      setGenerationError('Your account is still loading. Please try again.');
      return;
    }

    try {
      const proficiencyLevel = getProficiencyLevel();
      const episode: CreateEpisodeRequest = {
        title: t('dialogue:placeholderTitle'),
        sourceText: sourceText.trim(),
        targetLanguage,
        nativeLanguage,
        speakers: speakers.map((s) => ({
          name: s.name,
          voiceId: s.voiceId,
          proficiency: proficiencyLevel as ProficiencyLevel,
          tone: s.tone,
          color: s.color,
        })),
        audioSpeed: 'medium',
        jlptLevel,
        autoGenerateAudio,
      };
      const dialogueSpeakers = speakers.map((s) => ({
        id: '', // Will be assigned by backend
        name: s.name,
        voiceId: s.voiceId,
        proficiency: proficiencyLevel as ProficiencyLevel,
        tone: s.tone,
        color: s.color,
      }));
      const intent =
        readGenerationIntent<DialogueGenerationIntentPayload>(ownerId, 'dialogue') ??
        writeGenerationIntent(ownerId, 'dialogue', {
          episode,
          dialogue: {
            speakers: dialogueSpeakers,
            variationCount: 3,
            dialogueLength,
            options: {
              jlptLevel,
              vocabSeedOverride,
              grammarSeedOverride,
            },
          },
          ...(viewAsUserId ? { viewAsUserId } : {}),
        });
      submissionInFlightRef.current = true;
      await runDialogueIntent(intent);
    } catch (caught) {
      setGenerationError(
        caught instanceof Error ? caught.message : 'Could not save the generation request.'
      );
    }
  };

  const abandonConflictedRequest = () => {
    if (!conflictedIntent) return;
    try {
      abandonGenerationIntent(conflictedIntent);
      setConflictedIntent(null);
      setGenerationError(null);
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : 'Could not clear the request.');
    }
  };

  const abandonConflictedCourseRequest = () => {
    if (!conflictedCourseIntent) return;
    try {
      abandonGenerationIntent(conflictedCourseIntent);
      setConflictedCourseIntent(null);
      setCourseError(null);
    } catch (caught) {
      setCourseError(caught instanceof Error ? caught.message : 'Could not clear the request.');
    }
  };

  if (step === 'generating') {
    return <DialogueGeneratingState generationError={generationError} requestError={error} />;
  }

  if (step === 'complete') {
    return (
      <DialogueCompleteState
        courseError={courseError}
        generatedEpisodeId={generatedEpisodeId}
        hasConflictedCourseIntent={!!conflictedCourseIntent}
        onOpenEpisode={(episodeId) => navigate(scopedRoute(`/app/playback/${episodeId}`))}
        onAbandonConflictedCourseRequest={abandonConflictedCourseRequest}
      />
    );
  }

  return (
    <DialogueGeneratorForm
      sourceText={sourceText}
      setSourceText={setSourceText}
      targetLanguage={targetLanguage}
      nativeLanguage={nativeLanguage}
      dialogueLength={dialogueLength}
      setDialogueLength={setDialogueLength}
      jlptLevel={jlptLevel}
      setJlptLevel={setJlptLevel}
      tone={tone}
      setTone={setTone}
      vocabSeedOverride={vocabSeedOverride}
      setVocabSeedOverride={setVocabSeedOverride}
      grammarSeedOverride={grammarSeedOverride}
      setGrammarSeedOverride={setGrammarSeedOverride}
      speakers={speakers}
      setSpeakers={setSpeakers}
      autoGenerateAudio={autoGenerateAudio}
      setAutoGenerateAudio={setAutoGenerateAudio}
      audioCourseEnabled={audioCourseEnabled}
      createAudioCourse={createAudioCourse}
      setCreateAudioCourse={setCreateAudioCourse}
      courseTitle={courseTitle}
      setCourseTitle={setCourseTitle}
      courseNarratorVoice={courseNarratorVoice}
      setCourseNarratorVoice={setCourseNarratorVoice}
      courseMaxDuration={courseMaxDuration}
      setCourseMaxDuration={setCourseMaxDuration}
      loading={loading}
      generationError={generationError}
      requestError={error}
      hasConflictedIntent={!!conflictedIntent}
      onGenerate={handleGenerate}
      onAbandonConflictedRequest={abandonConflictedRequest}
      showDemoModal={showDemoModal}
      onCloseDemoModal={() => setShowDemoModal(false)}
    />
  );
};

export default DialogueGenerator;
