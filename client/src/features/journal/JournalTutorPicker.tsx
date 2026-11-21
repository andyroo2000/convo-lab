import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import JournalAvatar from './JournalAvatar';
import { getTutorPreferences, saveTutorPreference, tutorAvatar } from './journalTutor';
import './journalChoicePicker.css';

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
    <section aria-label="Choose your tutor" className="journal-tutor-picker">
      <div className="journal-choice-header">
        <h3 className="journal-choice-heading">Choose your tutor</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="journal-choice-close"
            aria-label="Close tutor picker"
            disabled={save.isPending}
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="journal-choice-options">
        {preferences.data?.data.tutors.map((tutor) => (
          <button
            key={tutor.id}
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(tutor.id)}
            aria-label={`${tutor.name} (${tutor.gender})`}
            aria-pressed={preferences.data.data.selectedId === tutor.id}
            className="journal-choice-option"
          >
            <JournalAvatar src={tutorAvatar(tutor)} alt="" className="journal-choice-avatar" />
            <span className="journal-choice-name">{tutor.name}</span>
            {preferences.data.data.selectedId === tutor.id && (
              <Check size={16} className="journal-choice-check" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {preferences.isPending && (
        <p role="status" className="journal-choice-status">
          Loading tutors…
        </p>
      )}
      {save.isPending && (
        <p role="status" className="journal-choice-status">
          Saving tutor…
        </p>
      )}
      {(preferences.error || save.error) && (
        <p role="alert" className="journal-choice-error">
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
