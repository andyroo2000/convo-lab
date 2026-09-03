import type { LanguageCode } from '../../types';
import type { CourseGenerationIntentPayload } from '../../lib/courseGenerationRequest';

export type CourseCreationValidationError =
  | 'audioCourse:alerts.fillRequired'
  | 'audioCourse:alerts.selectVoice';

interface CourseCreationInput {
  title: string;
  sourceText: string;
  episodeId?: string;
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  maxDuration: number;
  selectedVoice: string;
  jlptLevel: string;
  speaker1VoiceId: string;
  speaker2VoiceId: string;
}

interface CourseCreationIntentInput extends CourseCreationInput {
  viewAsUserId?: string;
}

interface CourseDraftErrorResponse {
  message?: string;
  error?: string | { message?: string };
}

export const getCourseCreationValidationError = ({
  title,
  sourceText,
  episodeId,
  selectedVoice,
}: Pick<
  CourseCreationInput,
  'title' | 'sourceText' | 'episodeId' | 'selectedVoice'
>): CourseCreationValidationError | null => {
  if (!title.trim()) return 'audioCourse:alerts.fillRequired';
  if (!episodeId && !sourceText.trim()) return 'audioCourse:alerts.fillRequired';
  if (!selectedVoice) return 'audioCourse:alerts.selectVoice';
  return null;
};

export const buildCourseCreationRequest = ({
  title,
  sourceText,
  episodeId,
  nativeLanguage,
  targetLanguage,
  maxDuration,
  selectedVoice,
  jlptLevel,
  speaker1VoiceId,
  speaker2VoiceId,
}: CourseCreationInput): CourseGenerationIntentPayload['course'] => ({
  title: title.trim(),
  ...(episodeId ? { episodeIds: [episodeId] } : { sourceText: sourceText.trim() }),
  nativeLanguage,
  targetLanguage,
  maxLessonDurationMinutes: maxDuration,
  l1VoiceId: selectedVoice,
  jlptLevel,
  speaker1Gender: 'male',
  speaker2Gender: 'female',
  speaker1VoiceId,
  speaker2VoiceId,
});

export const buildCourseCreationIntentPayload = ({
  viewAsUserId,
  ...courseInput
}: CourseCreationIntentInput): CourseGenerationIntentPayload => ({
  course: buildCourseCreationRequest(courseInput),
  ...(viewAsUserId ? { viewAsUserId } : {}),
});

export const getCourseDraftErrorMessage = (errorData: CourseDraftErrorResponse): string => {
  if (errorData.message) return errorData.message;
  if (typeof errorData.error === 'string') return errorData.error;
  if (errorData.error?.message) return errorData.error.message;
  return 'Failed to create course';
};
