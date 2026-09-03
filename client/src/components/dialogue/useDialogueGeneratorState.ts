import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SPEAKER_COLORS } from '@languageflow/shared/src/constants-new';
import { getRandomName } from '@languageflow/shared/src/nameConstants';
import {
  getCourseSpeakerVoices,
  getDialogueSpeakerVoices,
} from '@languageflow/shared/src/voiceSelection';

import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import type { CourseGenerationIntentPayload } from '../../lib/courseGenerationRequest';
import type { GenerationIntent } from '../../lib/generationIntentStore';
import type { LanguageCode, ProficiencyLevel, ToneStyle } from '../../types';
import type { SpeakerFormData } from './DialogueGeneratorForm';
import type { DialogueGenerationIntentPayload } from './dialogueGenerationRequest';

const TARGET_LANGUAGE: LanguageCode = 'ja';
const NATIVE_LANGUAGE: LanguageCode = 'en';

const createInitialSpeakers = () =>
  getDialogueSpeakerVoices(TARGET_LANGUAGE, 2).map((speaker, index) => ({
    name: getRandomName(TARGET_LANGUAGE, speaker.gender as 'male' | 'female'),
    voiceId: speaker.voiceId,
    proficiency: 'intermediate' as ProficiencyLevel,
    tone: 'casual' as ToneStyle,
    color: SPEAKER_COLORS[index],
  }));

const useDialogueGeneratorDependencies = () => {
  const { t } = useTranslation(['dialogue']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const isDemo = useIsDemo();
  const { user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const episodes = useEpisodes();
  const invalidateLibrary = useInvalidateLibrary();
  const scopedRoute = useCallback(
    (path: string, scopedUserId = viewAsUserId) =>
      scopedUserId ? `${path}?${new URLSearchParams({ viewAs: scopedUserId })}` : path,
    [viewAsUserId]
  );

  return {
    ...episodes,
    audioCourseEnabled: isFeatureEnabled('audioCourseEnabled'),
    invalidateLibrary,
    isDemo,
    navigate,
    scopedRoute,
    t,
    user,
    viewAsUserId,
  };
};

const useDialogueErrorState = () => {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [conflictedIntent, setConflictedIntent] =
    useState<GenerationIntent<DialogueGenerationIntentPayload> | null>(null);
  const [conflictedCourseIntent, setConflictedCourseIntent] =
    useState<GenerationIntent<CourseGenerationIntentPayload> | null>(null);
  return {
    conflictedCourseIntent,
    conflictedIntent,
    courseError,
    generationError,
    setConflictedCourseIntent,
    setConflictedIntent,
    setCourseError,
    setGenerationError,
    setShowDemoModal,
    showDemoModal,
  };
};

const useDialogueFormState = () => {
  const [sourceText, setSourceText] = useState('');
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
  const [speakers, setSpeakers] = useState<SpeakerFormData[]>(createInitialSpeakers);
  useEffect(() => {
    setSpeakers((current) => current.map((speaker) => ({ ...speaker, tone })));
  }, [tone]);
  useEffect(() => {
    const { narratorVoice } = getCourseSpeakerVoices(TARGET_LANGUAGE, NATIVE_LANGUAGE, 2);
    setCourseNarratorVoice((current) => current || narratorVoice);
  }, []);
  return {
    autoGenerateAudio,
    courseMaxDuration,
    courseNarratorVoice,
    courseTitle,
    createAudioCourse,
    dialogueLength,
    grammarSeedOverride,
    jlptLevel,
    nativeLanguage: NATIVE_LANGUAGE,
    setAutoGenerateAudio,
    setCourseMaxDuration,
    setCourseNarratorVoice,
    setCourseTitle,
    setCreateAudioCourse,
    setDialogueLength,
    setGrammarSeedOverride,
    setJlptLevel,
    setSourceText,
    setSpeakers,
    setTone,
    setVocabSeedOverride,
    sourceText,
    speakers,
    targetLanguage: TARGET_LANGUAGE,
    tone,
    vocabSeedOverride,
  };
};

const useDialogueWorkflowState = () => {
  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  return {
    courseRecoveryAttemptedForOwnerRef: useRef<string | null>(null),
    courseRecoveryInFlightRef: useRef(false),
    dialogueRecoveryAttemptedForOwnerRef: useRef<string | null>(null),
    generatedEpisodeId,
    jobId,
    pollingRunRef: useRef<symbol | null>(null),
    redirectTimerRef: useRef<number | null>(null),
    setGeneratedEpisodeId,
    setJobId,
    setStep,
    step,
    submissionInFlightRef: useRef(false),
  };
};

const useDialogueGeneratorState = () => ({
  ...useDialogueGeneratorDependencies(),
  ...useDialogueErrorState(),
  ...useDialogueFormState(),
  ...useDialogueWorkflowState(),
});

export type DialogueGeneratorState = ReturnType<typeof useDialogueGeneratorState>;

export default useDialogueGeneratorState;
