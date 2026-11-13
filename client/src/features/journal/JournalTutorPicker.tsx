import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import JournalAvatar from './JournalAvatar';
import { getTutorPreferences, saveTutorPreference, tutorAvatar } from './journalTutor';

interface Props {
  ownerId: string;
  onSelected: () => void;
  onClose?: () => void;
}
function useTutorChoice(ownerId: string, onSelected: () => void) {
  const client = useQueryClient();
  const key = ['journal-tutor', ownerId];
  const preferences = useQuery({ queryKey: key, queryFn: getTutorPreferences, retry: false });
  const save = useMutation({
    mutationFn: saveTutorPreference,
    onSuccess: (value) => {
      client.setQueryData(key, value);
      onSelected();
    },
  });
  const retry = () => {
    if (save.error && save.variables) save.mutate(save.variables);
    else preferences.refetch().catch(() => undefined);
  };
  return { preferences, save, retry };
}

const JournalTutorPicker = ({ ownerId, onSelected, onClose }: Props) => {
  const { preferences, save, retry } = useTutorChoice(ownerId, onSelected);
  return (
    <section
      aria-label="Choose your tutor"
      className="rounded-2xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-navy">Choose your tutor</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-indigo"
            disabled={save.isPending}
          >
            Cancel
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Used for new questions on all your devices. Earlier questions keep their tutor.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {preferences.data?.data.tutors.map((tutor) => (
          <button
            key={tutor.id}
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(tutor.id)}
            aria-label={`${tutor.name} (${tutor.gender})`}
            aria-pressed={preferences.data.data.selectedId === tutor.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-3 text-navy hover:border-indigo hover:bg-indigo/5 focus-visible:outline-indigo disabled:opacity-50"
          >
            <JournalAvatar
              src={tutorAvatar(tutor)}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
            {preferences.data.data.selectedId === tutor.id && (
              <Check size={16} className="absolute right-2 top-2 text-indigo" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {preferences.isPending && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          Loading tutors…
        </p>
      )}
      {save.isPending && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          Saving tutor…
        </p>
      )}
      {(preferences.error || save.error) && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          Your tutor could not be saved or loaded.{' '}
          <button type="button" className="underline" onClick={retry}>
            Try again
          </button>
        </p>
      )}
    </section>
  );
};
export default JournalTutorPicker;
