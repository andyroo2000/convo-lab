interface AutomaticAudioOptions {
  enabled: boolean;
  signal: AbortSignal;
  isCurrentRun: () => boolean;
  loadDialogueId: (signal: AbortSignal) => Promise<string | undefined>;
  generateAudio: (dialogueId: string, signal: AbortSignal) => Promise<unknown>;
}

export const generateCompletedDialogueAudio = async ({
  enabled,
  signal,
  isCurrentRun,
  loadDialogueId,
  generateAudio,
}: AutomaticAudioOptions): Promise<boolean> => {
  if (!enabled) return isCurrentRun();

  try {
    const dialogueId = await loadDialogueId(signal);
    if (!isCurrentRun()) return false;
    if (dialogueId) await generateAudio(dialogueId, signal);
    return isCurrentRun();
  } catch (error) {
    if (!isCurrentRun()) return false;
    console.error('Failed to trigger audio generation:', error);
    return true;
  }
};

interface AudioCourseOptions {
  enabled: boolean;
  signal: AbortSignal;
  isCurrentRun: () => boolean;
  createCourse: (signal: AbortSignal) => Promise<string | null>;
  onError: (error: unknown) => void;
}

interface AudioCourseResult {
  isCurrent: boolean;
  courseId: string | null;
}

export const generateCompletedDialogueCourse = async ({
  enabled,
  signal,
  isCurrentRun,
  createCourse,
  onError,
}: AudioCourseOptions): Promise<AudioCourseResult> => {
  if (!enabled) return { isCurrent: isCurrentRun(), courseId: null };

  try {
    const courseId = await createCourse(signal);
    return { isCurrent: isCurrentRun(), courseId };
  } catch (error) {
    if (!isCurrentRun()) return { isCurrent: false, courseId: null };
    onError(error);
    return { isCurrent: true, courseId: null };
  }
};
