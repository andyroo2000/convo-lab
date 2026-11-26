import { useState, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsDialogHeader, { type SettingsEditor } from './SettingsDialogHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import ModalPortalContext from '../common/ModalPortalContext';
import JournalAccountAvatar from '../common/JournalAccountAvatar';
import useJournalModal from '../../features/journal/useJournalModal';
import SettingsPage, { type SettingsTab } from '../../pages/SettingsPage';
import GoogleCalendarConnectionCard from '../study/GoogleCalendarConnectionCard';
import WaniKaniConnectionCard from './WaniKaniConnectionCard';
import StudyPreferences from '../../pages/StudySettingsPage';
import './settings.css';

const isEditor = (tab?: string): tab is SettingsEditor =>
  ['profile', 'security', 'danger'].includes(tab ?? '');
type ChapterKey = 'account' | 'study' | 'connections';

const Chapter = ({
  chapterKey,
  title,
  open,
  onToggle,
  children,
}: {
  chapterKey: ChapterKey;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const id = `settings-${chapterKey}`;
  return (
    <section className="journal-settings-chapter">
      <h2>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
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
    { label: 'editProfile', perform: () => onEdit('profile') },
    { label: 'changePassword', perform: () => onEdit('security') },
    { label: 'signOut', perform: logout },
    { label: 'deleteAccount', perform: () => onEdit('danger') },
  ];
  return (
    <div className="journal-settings-actions">
      {actions.map(({ label, perform }) => (
        <button
          key={label}
          type="button"
          className={label === 'deleteAccount' ? 'is-danger' : undefined}
          onClick={perform}
        >
          <span>{t(`modal.actions.${label}`)}</span>
          <ChevronRight aria-hidden="true" className="journal-settings-action-chevron" />
        </button>
      ))}
    </div>
  );
};

function initialChapter(tab?: string): ChapterKey {
  if (tab === 'study') return 'study';
  return tab === 'integrations' ? 'connections' : 'account';
}

const SettingsContents = ({ onEdit }: { onEdit: (tab: SettingsEditor) => void }) => {
  const { t } = useTranslation('settings');
  const { isFeatureEnabled } = useFeatureFlags();
  const studyEnabled = isFeatureEnabled('flashcardsEnabled');
  const { tab } = useParams();
  const [expanded, setExpanded] = useState<ChapterKey | null>(initialChapter(tab));
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
        <Chapter {...chapterProps('study')}>
          <StudyPreferences />
        </Chapter>
      )}
      <Chapter {...chapterProps('connections')}>
        <WaniKaniConnectionCard />
        {studyEnabled && <GoogleCalendarConnectionCard />}
      </Chapter>
    </>
  );
};

function useSettingsDismissal(ref: RefObject<HTMLDialogElement>, nestedOverlay: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => {
    if (nestedOverlay || ref.current?.querySelector('[role=dialog]')) return;
    if (location.state?.backgroundLocation) navigate(-1);
    else
      navigate(location.pathname === '/app/settings/study' ? '/app/study' : '/app/journal', {
        replace: true,
      });
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
