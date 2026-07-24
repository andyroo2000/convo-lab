import readApiError from './apiError';

export interface CourseApiContract {
  collection: string;
  member: (courseId: string) => string;
  operation: (courseId: string, operation: 'generate' | 'status' | 'reset' | 'retry') => string;
}

export function createCourseApiContract(apiUrl = ''): CourseApiContract {
  const collection = `${apiUrl}/api/convolab/courses`;
  const member = (courseId: string) => `${collection}/${encodeURIComponent(courseId)}`;

  return {
    collection,
    member,
    operation: (courseId, operation) => `${member(courseId)}/${operation}`,
  };
}

export const readCourseApiError = readApiError;
export const courseApi = createCourseApiContract();
