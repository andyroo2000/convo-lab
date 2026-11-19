import { useState, type ReactNode, type RefObject } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Link2,
  LockKeyhole,
  LogOut,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsDialogHeader, { type SettingsEditor } from './SettingsDialogHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import ModalPortalContext from '../common/ModalPortalContext';
import JournalAccountAvatar from '../common/JournalAccountAvatar';
import useJournalModal from '../../features/journal/useJournalModal';
import SettingsPage, { type SettingsTab } from '../../pages/SettingsPage';
import GoogleCalendarConnectionCard from '../study/GoogleCalendarConnectionCard';
import './settings.css';

const isEditor = (tab?: string): tab is SettingsEditor =>
  ['profile', 'security', 'danger'].includes(tab ?? '');
type ChapterKey = 'account' | 'study' | 'connections';

const Chapter = ({
  chapterKey,
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  chapterKey: ChapterKey;
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const id = `settings-${chapterKey}`;
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
  if (!user) return null;
  return (
    <div className="journal-settings-identity">
      <JournalAccountAvatar name={user.displayName || user.name} />
      <div>
        <strong>{user.displayName || user.name}</strong>
        <p>{user.email}</p>
      </div>
    </div>
  );
};

const SettingsAccountActions = ({ onEdit }: { onEdit: (tab: SettingsEditor) => void }) => {
  const { t } = useTranslation('settings');
  const { logout } = useAuth();
  const actions = [
    { label: 'editProfile', icon: UserRound, perform: () => onEdit('profile') },
    { label: 'changePassword', icon: LockKeyhole, perform: () => onEdit('security') },
    { label: 'signOut', icon: LogOut, perform: logout },
    { label: 'deleteAccount', icon: Trash2, perform: () => onEdit('danger') },
  ];
  return (
    <div className="journal-settings-actions">
      {actions.map(({ label, icon: Icon, perform }) => (
        <button
          key={label}
          type="button"
          className={label === 'deleteAccount' ? 'is-danger' : undefined}
          onClick={perform}
        >
          <Icon aria-hidden="true" />
          <span>{t(`modal.actions.${label}`)}</span>
          <ChevronRight aria-hidden="true" className="journal-settings-action-chevron" />
        </button>
      ))}
    </div>
  );
};

const SettingsContents = ({ onEdit }: { onEdit: (tab: SettingsEditor) => void }) => {
  const { t } = useTranslation('settings');
  const { isFeatureEnabled } = useFeatureFlags();
  const studyEnabled = isFeatureEnabled('flashcardsEnabled');
  const { tab } = useParams();
  const [expanded, setExpanded] = useState<ChapterKey | null>(
    tab === 'integrations' ? 'connections' : 'account'
  );
  const chapterProps = (chapterKey: ChapterKey) => ({
    chapterKey,
    title: t(`modal.chapters.${chapterKey}`),
    open: expanded === chapterKey,
    onToggle: () => setExpanded(expanded === chapterKey ? null : chapterKey),
  });
  return (
    <>
      <Chapter {...chapterProps('account')}>
        <SettingsIdentity />
        <SettingsAccountActions onEdit={onEdit} />
      </Chapter>
      {studyEnabled && (
        <>
          <Chapter {...chapterProps('study')} icon={<BookOpen aria-hidden="true" />}>
            <Link className="journal-settings-link" to="/app/study/settings">
              {t('modal.studyPreferencesLink')} <span aria-hidden="true">→</span>
            </Link>
          </Chapter>
          <Chapter {...chapterProps('connections')} icon={<Link2 aria-hidden="true" />}>
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
  const [editor, setEditor] = useState<SettingsEditor | null>(isEditor(tab) ? tab : null);
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
        <SettingsDialogHeader
          editor={editor}
          nestedOverlay={nestedOverlay}
          back={() => setEditor(null)}
          close={close}
        />
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
