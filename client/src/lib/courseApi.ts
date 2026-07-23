import { API_URL, LEARNING_OS_DIRECT_COURSE_API_ENABLED } from '../config';
import readApiError from './apiError';

export interface CourseApiContract {
  collection: string;
  member: (courseId: string) => string;
  operation: (courseId: string, operation: 'generate' | 'status' | 'reset' | 'retry') => string;
}

export function createCourseApiContract(
  directLearningOs: boolean,
  apiUrl: string = API_URL
): CourseApiContract {
  const collection = `${apiUrl}${directLearningOs ? '/api/convolab/courses' : '/api/courses'}`;
  const member = (courseId: string) => `${collection}/${encodeURIComponent(courseId)}`;

  return {
    collection,
    member,
    operation: (courseId, operation) => `${member(courseId)}/${operation}`,
  };
}

export const readCourseApiError = readApiError;
export const courseApi = createCourseApiContract(LEARNING_OS_DIRECT_COURSE_API_ENABLED);
