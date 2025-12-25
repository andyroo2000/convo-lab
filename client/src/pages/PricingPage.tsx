import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';

export default function PricingPage() {
  const { t } = useTranslation('pricing');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create checkout session');
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
      ctaDisabled: user?.tier === 'pro',
      ctaAction: () => handleUpgrade(proPriceId),
      current: user?.tier === 'pro',
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-dark-brown mb-4">{t('title')}</h1>
          <p className="text-lg text-medium-brown max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative card ${tier.popular ? 'ring-2 ring-periwinkle' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-periwinkle text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {t('badges.popular')}
                  </span>
                </div>
              )}

              {tier.current && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {t('badges.current')}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-dark-brown mb-2">{tier.name}</h2>
                <p className="text-medium-brown text-sm mb-4">{tier.description}</p>
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold text-dark-brown">{tier.price}</span>
                  <span className="text-medium-brown ml-2">{tier.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={tier.ctaAction}
                disabled={tier.ctaDisabled || loading}
                className={`btn-primary w-full ${
                  tier.ctaDisabled || loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading && tier.ctaAction ? t('actions.loading') : tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-medium-brown mb-4">{t('footer.inviteOnly')}</p>
          <p className="text-sm text-gray-500">
            {t('footer.questions')}{' '}
            <a
              href="mailto:support@convolab.app"
              className="text-periwinkle hover:text-dark-periwinkle"
            >
              {t('footer.contact')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
