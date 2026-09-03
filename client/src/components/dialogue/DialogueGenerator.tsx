import DialogueGeneratorView from './DialogueGeneratorView';
import useDialogueCourseGeneration, {
  useCreateCourseFromEpisode,
} from './useDialogueCourseGeneration';
import useDialogueGenerationPolling from './useDialogueGenerationPolling';
import useDialogueGeneratorState from './useDialogueGeneratorState';
import useDialogueIntentGeneration from './useDialogueIntentGeneration';

const DialogueGenerator = () => {
  const state = useDialogueGeneratorState();
  const createCourseFromEpisode = useCreateCourseFromEpisode(state);
  useDialogueGenerationPolling({
    audioCourseEnabled: state.audioCourseEnabled,
    autoGenerateAudio: state.autoGenerateAudio,
    createAudioCourse: state.createAudioCourse,
    createCourseFromEpisode,
    generateAllSpeedsAudio: state.generateAllSpeedsAudio,
    generatedEpisodeId: state.generatedEpisodeId,
    getEpisode: state.getEpisode,
    invalidateLibrary: state.invalidateLibrary,
    jobId: state.jobId,
    navigate: state.navigate,
    pollJobStatus: state.pollJobStatus,
    pollingRunRef: state.pollingRunRef,
    redirectTimerRef: state.redirectTimerRef,
    scopedRoute: state.scopedRoute,
    setCourseError: state.setCourseError,
    setJobId: state.setJobId,
    setStep: state.setStep,
    t: state.t,
  });
  const course = useDialogueCourseGeneration(state, createCourseFromEpisode);
  const dialogue = useDialogueIntentGeneration(state);
  return <DialogueGeneratorView course={course} dialogue={dialogue} state={state} />;
};

export default DialogueGenerator;
