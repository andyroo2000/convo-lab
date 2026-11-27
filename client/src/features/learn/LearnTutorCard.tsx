import type { ReactNode } from 'react';
import JournalAvatar from '../journal/JournalAvatar';
import { tutorAvatar, type JournalTutor } from '../journal/journalTutor';

const LearnTutorCard = ({
  children,
  tutor,
  action,
}: {
  children: ReactNode;
  tutor?: JournalTutor;
  action?: ReactNode;
}) => (
  <section className="learn-tutor-card" aria-label="Your tutor">
    <header className="learn-tutor-card-header">
      <JournalAvatar
        src={tutor && tutorAvatar(tutor)}
        alt={tutor?.name ?? 'Your tutor'}
        className="learn-tutor-avatar"
      />
    </header>
    <div className="learn-tutor-card-body">{children}</div>
    {action && <div className="learn-tutor-card-footer">{action}</div>}
  </section>
);

export default LearnTutorCard;
