import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Headphones, MessageSquare, type LucideIcon } from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useIsDemo } from '../hooks/useDemo';
import CustomContentGuide from '../components/pulsePoints/CustomContentGuide';
import { SHOW_ONBOARDING_WELCOME } from '../config';

interface ContentTypeCardProps {
  title: string;
  description: string;
  kicker: string;
  mini: string;
  actionLabel: string;
  icon: LucideIcon;
  testId: string;
  onSelect: () => void;
}

interface ContentTypeOption extends ContentTypeCardProps {
  enabled: boolean;
}

interface CreateOptionsProps {
  options: ContentTypeOption[];
}

interface GuideUser {
  onboardingCompleted?: boolean;
  seenCustomContentGuide?: boolean;
}

const buildScopedPath = (path: string, viewAsUserId?: string) =>
  viewAsUserId ? `${path}?viewAs=${viewAsUserId}` : path;

const shouldShowGuide = (user: GuideUser | null | undefined, isDemo: boolean) => {
  if (!SHOW_ONBOARDING_WELCOME) return false;
  if (!user?.onboardingCompleted) return false;
  if (user.seenCustomContentGuide) return false;
  return !isDemo;
};

const ContentTypeCard = ({
  title,
  description,
  kicker,
  mini,
  actionLabel,
  icon: Icon,
  testId,
  onSelect,
}: ContentTypeCardProps) => (
  <button
    type="button"
    onClick={onSelect}
    className="retro-create-v3-card group"
    data-testid={testId}
  >
    <div className="retro-create-v3-card-head">
      <div className="retro-create-v3-card-kicker retro-caps">{kicker}</div>
      <h2 className="retro-create-v3-card-title">{title}</h2>
    </div>

    <div className="retro-create-v3-card-body">
      <div className="retro-create-v3-card-mini">
        <span className="retro-create-v3-icon-wrap" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="retro-caps">{mini}</span>
      </div>

      <p className="retro-create-v3-card-description">{description}</p>

      <div className="retro-create-v3-card-cta">
        <span className="retro-create-v3-open retro-caps">{actionLabel}</span>
      </div>
    </div>
  </button>
);

const CreateOptions = ({ options }: CreateOptionsProps) => (
  <div className="retro-create-v3-grid">
    {options
      .filter(({ enabled }) => enabled)
      .map((option) => (
        <ContentTypeCard key={option.testId} {...option} />
      ))}
  </div>
);

const CustomContentGuidePrompt = () => {
  const { user, updateUser } = useAuth();
  const isDemo = useIsDemo();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (shouldShowGuide(user, isDemo)) setIsVisible(true);
  }, [user, isDemo]);

  const handleClose = async () => {
    setIsVisible(false);
    if (!user) return;
    if (user.seenCustomContentGuide) return;

    try {
      await updateUser({ seenCustomContentGuide: true });
    } catch (error) {
      console.error('Failed to update seenCustomContentGuide:', error);
    }
  };

  if (!SHOW_ONBOARDING_WELCOME) return null;
  if (!isVisible) return null;
  return <CustomContentGuide onClose={handleClose} />;
};

const CreatePage = () => {
  const { t } = useTranslation(['create']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isFeatureEnabled } = useFeatureFlags();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const navigateTo = (path: string) => navigate(buildScopedPath(path, viewAsUserId));
  const actionLabel = t('create:buttons.create');
  const options: ContentTypeOption[] = [
    {
      enabled: isFeatureEnabled('dialoguesEnabled'),
      title: t('create:types.dialogue.title'),
      description: t('create:types.dialogue.description'),
      kicker: t('create:kickers.dialogue'),
      mini: t('create:types.dialogue.mini'),
      actionLabel,
      icon: MessageSquare,
      testId: 'create-card-dialogues',
      onSelect: () => navigateTo('/app/create/dialogue'),
    },
    {
      enabled: isFeatureEnabled('scriptsEnabled'),
      title: t('create:types.script.title'),
      description: t('create:types.script.description'),
      kicker: t('create:kickers.script'),
      mini: t('create:types.script.mini'),
      actionLabel,
      icon: FileText,
      testId: 'create-card-scripts',
      onSelect: () => navigateTo('/app/create/script'),
    },
    {
      enabled: isFeatureEnabled('flashcardsEnabled'),
      title: t('create:types.dailyAudio.title'),
      description: t('create:types.dailyAudio.description'),
      kicker: t('create:kickers.dailyAudio'),
      mini: t('create:types.dailyAudio.mini'),
      actionLabel,
      icon: Headphones,
      testId: 'create-card-daily-audio',
      onSelect: () => navigateTo('/app/study/daily-audio'),
    },
  ];

  return (
    <div className="retro-create-v3-wrap">
      <div className="retro-create-v3-shell">
        <div className="retro-create-v3-top">
          <div className="retro-create-v3-branding">
            <h1 className="retro-create-v3-title">{t('create:title')}</h1>
            <p className="retro-create-v3-subtitle">{t('create:subtitle')}</p>
          </div>
        </div>

        <div className="retro-create-v3-main">
          <CreateOptions options={options} />
          <p className="retro-create-v3-footer">{t('create:footer')}</p>
        </div>
      </div>
      <CustomContentGuidePrompt />
    </div>
  );
};

export default CreatePage;
