import { useQuery } from '@tanstack/react-query';
import { getTutorPreferences } from '../journal/journalTutor';

export default function useLearnTutor(ownerId: string) {
  const { data } = useQuery({
    queryKey: ['journal-tutor', ownerId],
    queryFn: getTutorPreferences,
    retry: false,
  });
  const preferences = data?.data;
  return preferences?.tutors.find((tutor) => tutor.id === (preferences.selectedId ?? 'hana'));
}
