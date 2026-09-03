import DialogueGeneratorForm from './DialogueGeneratorForm';
import { DialogueCompleteState, DialogueGeneratingState } from './DialogueGenerationStatus';
import type { DialogueCourseGeneration } from './useDialogueCourseGeneration';
import type { DialogueGeneratorState } from './useDialogueGeneratorState';
import type { DialogueIntentGeneration } from './useDialogueIntentGeneration';

interface DialogueGeneratorViewProps {
  course: DialogueCourseGeneration;
  dialogue: DialogueIntentGeneration;
  state: DialogueGeneratorState;
}

const DialogueGeneratorView = ({ course, dialogue, state }: DialogueGeneratorViewProps) => {
  if (state.step === 'generating') {
    return (
      <DialogueGeneratingState generationError={state.generationError} requestError={state.error} />
    );
  }
  if (state.step === 'complete') {
    return (
      <DialogueCompleteState
        courseError={state.courseError}
        generatedEpisodeId={state.generatedEpisodeId}
        hasConflictedCourseIntent={Boolean(state.conflictedCourseIntent)}
        onOpenEpisode={(episodeId) =>
          state.navigate(state.scopedRoute(`/app/playback/${episodeId}`))
        }
        onAbandonConflictedCourseRequest={course.abandonConflictedCourseRequest}
      />
    );
  }
  return (
    <DialogueGeneratorForm
      sourceText={state.sourceText}
      setSourceText={state.setSourceText}
      targetLanguage={state.targetLanguage}
      nativeLanguage={state.nativeLanguage}
      dialogueLength={state.dialogueLength}
      setDialogueLength={state.setDialogueLength}
      jlptLevel={state.jlptLevel}
      setJlptLevel={state.setJlptLevel}
      tone={state.tone}
      setTone={state.setTone}
      vocabSeedOverride={state.vocabSeedOverride}
      setVocabSeedOverride={state.setVocabSeedOverride}
      grammarSeedOverride={state.grammarSeedOverride}
      setGrammarSeedOverride={state.setGrammarSeedOverride}
      speakers={state.speakers}
      setSpeakers={state.setSpeakers}
      autoGenerateAudio={state.autoGenerateAudio}
      setAutoGenerateAudio={state.setAutoGenerateAudio}
      audioCourseEnabled={state.audioCourseEnabled}
      createAudioCourse={state.createAudioCourse}
      setCreateAudioCourse={state.setCreateAudioCourse}
      courseTitle={state.courseTitle}
      setCourseTitle={state.setCourseTitle}
      courseNarratorVoice={state.courseNarratorVoice}
      setCourseNarratorVoice={state.setCourseNarratorVoice}
      courseMaxDuration={state.courseMaxDuration}
      setCourseMaxDuration={state.setCourseMaxDuration}
      loading={state.loading}
      generationError={state.generationError}
      requestError={state.error}
      hasConflictedIntent={Boolean(state.conflictedIntent)}
      onGenerate={dialogue.handleGenerate}
      onAbandonConflictedRequest={dialogue.abandonConflictedRequest}
      showDemoModal={state.showDemoModal}
      onCloseDemoModal={() => state.setShowDemoModal(false)}
    />
  );
};

export default DialogueGeneratorView;
