import { requestJson } from '../../lib/apiClient';

export interface JournalTutor {
  id: 'hana' | 'ren';
  name: string;
  gender: 'F' | 'M';
  avatar: string;
  avatarUrl?: string;
}
export interface TutorPreferences {
  selectedId: string | null;
  tutors: JournalTutor[];
}
export interface TutorQuestion {
  audio?: { status: string; error: string | null };
  id: string;
  text: string;
  reading: string;
  translation: string;
  tutor: JournalTutor | null;
}
export const tutorAvatar = (tutor: JournalTutor) => tutor.avatarUrl;
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
