import { requestJson } from '../../lib/apiClient';

export interface JournalTutor {
  id: 'hana' | 'ren';
  name: string;
  gender: 'F' | 'M';
  avatar: string;
}
export interface TutorPreferences {
  selectedId: string | null;
  tutors: JournalTutor[];
}
export interface TutorQuestion {
  id: string;
  text: string;
  reading: string;
  translation: string;
  tutor: JournalTutor | null;
}
export const tutorAvatar = (tutor: JournalTutor) =>
  tutor.id === 'hana' ? '/images/journal/hana-v1.png' : '/images/journal/ren-v1.png';
export const getTutorPreferences = () =>
  requestJson<{ data: TutorPreferences }>('/api/journal/tutor');
export const saveTutorPreference = (tutorId: string) =>
  requestJson<{ data: TutorPreferences }>('/api/journal/tutor', {
    method: 'PUT',
    body: JSON.stringify({ tutorId }),
  });
export const prepareTutorQuestion = (entryId: string, analysisId: string, replyId?: string) =>
  requestJson<{ data: TutorQuestion }>(
    `/api/journal/entries/${encodeURIComponent(entryId)}/question`,
    {
      method: 'POST',
      body: JSON.stringify({ analysisId, replyId: replyId ?? null }),
    }
  );
