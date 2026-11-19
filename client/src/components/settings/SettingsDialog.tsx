import { useState, type ReactNode, type RefObject } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, Link2, UserRound, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import ModalPortalContext from '../common/ModalPortalContext';
import useJournalModal from '../../features/journal/useJournalModal';
import SettingsPage, { type SettingsTab } from '../../pages/SettingsPage';
import GoogleCalendarConnectionCard from '../study/GoogleCalendarConnectionCard';
import './settings.css';

const EDITOR_TITLES = {
  profile: 'Account settings',
  security: 'Change password',
  danger: 'Delete account',
};
type Editor = keyof typeof EDITOR_TITLES;
const isEditor = (tab?: string): tab is Editor =>
  Object.prototype.hasOwnProperty.call(EDITOR_TITLES, tab ?? '');

const Chapter = ({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const id = `settings-${title.toLowerCase().replace(/ /g, '-')}`;
  return (
    <section className="journal-settings-chapter">
      <h2>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          {icon}
          <span>{title}</span>
          <ChevronDown aria-hidden="true" className={open ? 'is-open' : ''} />
        </button>
      </h2>
      {open && (
        <div id={id} className="journal-settings-chapter-content">
          {children}
        </div>
      )}
    </section>
  );
};

const SettingsIdentity = () => {
  const { user } = useAuth();
  return (
    <div className="journal-settings-identity">
      <div className="journal-settings-avatar">
        {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserRound aria-hidden="true" />}
      </div>
      <div>
        <strong>{user?.displayName || user?.name}</strong>
        <p>{user?.email}</p>
      </div>
    </div>
  );
};

const SettingsContents = ({ onEdit }: { onEdit: (tab: Editor) => void }) => {
  const { logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const studyEnabled = isFeatureEnabled('flashcardsEnabled');
  const { tab } = useParams();
  const [expanded, setExpanded] = useState(tab === 'integrations' ? 'Connections' : 'Account');
  const chapterProps = (title: string) => ({
    title,
    open: expanded === title,
    onToggle: () => setExpanded(expanded === title ? '' : title),
  });
  return (
    <>
      <Chapter {...chapterProps('Account')} icon={<UserRound aria-hidden="true" />}>
        <SettingsIdentity />
        <div className="journal-settings-actions">
          <button type="button" onClick={() => onEdit('profile')}>
            Edit profile
          </button>
          <button type="button" onClick={() => onEdit('security')}>
            Change password
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
            }}
          >
            Sign out
          </button>
          <button type="button" className="is-danger" onClick={() => onEdit('danger')}>
            Delete account
          </button>
        </div>
      </Chapter>
      {studyEnabled && (
        <>
          <Chapter {...chapterProps('Study preferences')} icon={<BookOpen aria-hidden="true" />}>
            <Link className="journal-settings-link" to="/app/study/settings">
              Daily cards, lesson size &amp; known kanji <span aria-hidden="true">→</span>
            </Link>
          </Chapter>
          <Chapter {...chapterProps('Connections')} icon={<Link2 aria-hidden="true" />}>
            <GoogleCalendarConnectionCard />
          </Chapter>
        </>
      )}
    </>
  );
};

function useSettingsDismissal(ref: RefObject<HTMLDialogElement>, nestedOverlay: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => {
    if (nestedOverlay || ref.current?.querySelector('[role=dialog]')) return;
    if (location.state?.backgroundLocation) navigate(-1);
    else navigate('/app/journal', { replace: true });
  };
  return close;
}

const AuthenticatedSettingsDialog = () => {
  const ref = useJournalModal();
  const { tab } = useParams();
  const [editor, setEditor] = useState<Editor | null>(isEditor(tab) ? tab : null);
  const [nestedOverlay, setNestedOverlay] = useState(false);
  const close = useSettingsDismissal(ref, nestedOverlay);
  return (
    <dialog
      ref={ref}
      className="journal-settings-dialog"
      aria-labelledby="journal-settings-title"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && ref.current?.querySelector('[role=dialog]'))
          event.preventDefault();
      }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <ModalPortalContext.Provider value={ref}>
        <header className="journal-settings-header">
          {editor && (
            <button
              type="button"
              aria-label="Back to settings"
              disabled={nestedOverlay}
              onClick={() => setEditor(null)}
            >
              <ArrowLeft />
            </button>
          )}
          <div>
            <p>
              CONVO-LAB <span>コンボ・ラボ</span>
            </p>
            <h1 id="journal-settings-title">{editor ? EDITOR_TITLES[editor] : 'Settings'}</h1>
          </div>
          <button
            type="button"
            aria-label="Close settings"
            disabled={nestedOverlay}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className="journal-settings-content">
          {editor ? (
            <SettingsPage
              key={editor}
              embeddedTab={editor as SettingsTab}
              onOverlayChange={setNestedOverlay}
            />
          ) : (
            <SettingsContents onEdit={setEditor} />
          )}
        </div>
      </ModalPortalContext.Provider>
    </dialog>
  );
};

const SettingsDialog = () => {
  const { user } = useAuth();
  return user ? <AuthenticatedSettingsDialog /> : null;
};

export default SettingsDialog;
