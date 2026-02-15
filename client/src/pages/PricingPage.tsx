import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Library, Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import Logo from '../components/common/Logo';
import UserMenu from '../components/common/UserMenu';

const PricingPage = () => {
  const { t } = useTranslation(['pricing', 'common']);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleUpgrade = async (priceId: string) => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?returnUrl=/pricing`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(false);
    }
  };

  // Check if test tier is enabled (only for test users)
  const testPriceId = user?.isTestUser ? import.meta.env.VITE_STRIPE_PRICE_TEST_MONTHLY : undefined;
  const proPriceId = import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY;

  const tiers = [
    {
      name: t('tiers.free.name'),
      price: t('tiers.free.price'),
      period: t('tiers.free.period'),
      description: t('tiers.free.description'),
      features: [
        t('tiers.free.features.generations'),
        t('tiers.free.features.contentTypes'),
        t('tiers.free.features.tts'),
        t('tiers.free.features.support'),
      ],
      cta: user?.tier === 'free' ? t('actions.currentPlan') : t('actions.downgrade'),
      ctaDisabled: true,
      current: user?.tier === 'free',
    },
    // Show test tier if user is a test user
    ...(user?.isTestUser && testPriceId
      ? [
          {
            name: t('tiers.test.name'),
            price: t('tiers.test.price'),
            period: t('tiers.test.period'),
            description: t('tiers.test.description'),
            features: [
              t('tiers.test.features.generations'),
              t('tiers.test.features.contentTypes'),
              t('tiers.test.features.tts'),
              t('tiers.test.features.payment'),
            ],
            cta: t('tiers.test.cta'),
            ctaDisabled: false,
            ctaAction: () => handleUpgrade(testPriceId),
            current: false,
          },
        ]
      : []),
    {
      name: t('tiers.pro.name'),
      price: t('tiers.pro.price'),
      period: t('tiers.pro.period'),
      description: t('tiers.pro.description'),
      features: [
        t('tiers.pro.features.generations'),
        t('tiers.pro.features.contentTypes'),
        t('tiers.pro.features.tts'),
        t('tiers.pro.features.support'),
        t('tiers.pro.features.earlyAccess'),
      ],
      cta: user?.tier === 'pro' ? t('actions.currentPlan') : t('actions.upgrade'),
      ctaDisabled: user?.tier === 'pro' || !proPriceId,
      ctaAction: proPriceId ? () => handleUpgrade(proPriceId) : undefined,
      current: user?.tier === 'pro',
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-cream retro-shell">
      <nav className="sticky top-0 z-20 bg-periwinkle retro-topbar">
        <div className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center justify-between gap-3">
            <div className="flex items-center min-w-0 gap-2 sm:gap-6">
              <Link to={user ? '/app/library' : '/'} className="flex items-center px-2">
                <Logo size="small" showKana showIcons={false} />
              </Link>
              <div className="hidden sm:flex h-[4.5rem] items-center gap-2">
                <Link
                  to="/app/library"
                  className="retro-nav-tab relative inline-flex items-center justify-center text-white hover:bg-white/20"
                >
                  <Library className="w-5 h-5 mr-2.5 flex-shrink-0" />
                  {t('common:nav.library')}
                </Link>
                <Link
                  to="/app/create"
                  className="retro-nav-tab relative inline-flex items-center justify-center text-white hover:bg-white/20"
                >
                  <Mic className="w-5 h-5 mr-2.5 flex-shrink-0" />
                  {t('common:nav.create')}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <UserMenu
                  userName={user.displayName || user.name || user.email || 'User'}
                  avatarColor={user.avatarColor}
                  avatarUrl={user.avatarUrl}
                  userRole={user.role || 'user'}
                  onLogout={handleLogout}
                />
              ) : (
                <Link to="/login" className="retro-nav-tab">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="retro-pricing-v3-wrap">
        <div className="retro-pricing-v3-shell max-w-7xl xl:max-w-[96rem] mx-auto">
          <div className="retro-pricing-v3-top">
            <div className="retro-pricing-v3-branding">
              <h1 className="retro-pricing-v3-title">{t('pricing:title')}</h1>
              <p className="retro-pricing-v3-subtitle">{t('pricing:subtitle')}</p>
            </div>
          </div>

          <section className="retro-pricing-v3-main">
            {error && <div className="retro-pricing-v3-alert">{error}</div>}

            <div className="retro-pricing-v3-grid">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`retro-pricing-v3-card retro-paper-panel ${
                    tier.popular ? 'is-popular' : ''
                  }`}
                >
                  <div
                    className={`retro-pricing-v3-card-head ${tier.popular ? 'is-pro' : 'is-free'}`}
                  >
                    <div className="retro-pricing-v3-badge-row">
                      {tier.popular && (
                        <span className="retro-pricing-v3-badge is-popular">
                          {t('pricing:badges.popular')}
                        </span>
                      )}
                      {tier.current && (
                        <span className="retro-pricing-v3-badge is-current">
                          {t('pricing:badges.current')}
                        </span>
                      )}
                    </div>
                    <h2 className="retro-pricing-v3-card-title">{tier.name}</h2>
                  </div>

                  <div className="retro-pricing-v3-card-body">
                    <p className="retro-pricing-v3-card-description">{tier.description}</p>
                    <div className="retro-pricing-v3-price-row">
                      <span className="retro-pricing-v3-price">{tier.price}</span>
                      <span className="retro-pricing-v3-period">{tier.period}</span>
                    </div>

                    <ul className="retro-pricing-v3-feature-list">
                      {tier.features.map((feature, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={index} className="retro-pricing-v3-feature">
                          <Check className="retro-pricing-v3-feature-icon" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={tier.ctaAction}
                      disabled={tier.ctaDisabled || loading}
                      className={`retro-pricing-v3-cta ${tier.ctaDisabled || loading ? 'is-disabled' : ''}`}
                    >
                      {loading && tier.ctaAction ? t('pricing:actions.loading') : tier.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="retro-pricing-v3-foot">
              <p>{t('pricing:footer.inviteOnly')}</p>
              <p>
                {t('pricing:footer.questions')}{' '}
                <a href="mailto:support@convolab.app" className="retro-pricing-v3-foot-link">
                  {t('pricing:footer.contact')}
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
