import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Check } from 'lucide-react';
import { API_URL } from '../config';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
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
          priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || process.env.STRIPE_PRICE_PRO_MONTHLY
        })
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

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out ConvoLab',
      features: [
        '5 generations per week',
        'All content types',
        'High-quality TTS audio',
        'Standard support'
      ],
      cta: user?.tier === 'free' ? 'Current Plan' : 'Downgrade',
      ctaDisabled: true,
      current: user?.tier === 'free'
    },
    {
      name: 'Pro',
      price: '$7',
      period: 'per month',
      description: 'For serious language learners',
      features: [
        '30 generations per week',
        'All content types',
        'High-quality TTS audio',
        'Priority support',
        'Early access to new features'
      ],
      cta: user?.tier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      ctaDisabled: user?.tier === 'pro',
      ctaAction: handleUpgrade,
      current: user?.tier === 'pro',
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-dark-brown mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-medium-brown max-w-2xl mx-auto">
            Start creating immersive language learning content today. Upgrade or downgrade anytime.
          </p>
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
                    Most Popular
                  </span>
                </div>
              )}

              {tier.current && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-dark-brown mb-2">
                  {tier.name}
                </h2>
                <p className="text-medium-brown text-sm mb-4">
                  {tier.description}
                </p>
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold text-dark-brown">
                    {tier.price}
                  </span>
                  <span className="text-medium-brown ml-2">
                    {tier.period}
                  </span>
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
                  tier.ctaDisabled || loading
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {loading && tier.ctaAction ? 'Loading...' : tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-medium-brown mb-4">
            All plans require an invite code. ConvoLab is currently invite-only.
          </p>
          <p className="text-sm text-gray-500">
            Questions about pricing?{' '}
            <a
              href="mailto:support@convolab.app"
              className="text-periwinkle hover:text-dark-periwinkle"
            >
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
