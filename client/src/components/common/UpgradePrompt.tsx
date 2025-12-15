import { useNavigate } from 'react-router-dom';
import { X, Zap, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UpgradePromptProps {
  onClose?: () => void;
  quotaUsed?: number;
  quotaLimit?: number;
}

export default function UpgradePrompt({ onClose, quotaUsed, quotaLimit }: UpgradePromptProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUpgrade = () => {
    navigate('/pricing');
    onClose?.();
  };

  const handleViewBilling = () => {
    navigate('/app/settings/billing');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-periwinkle to-dark-periwinkle p-6 text-white relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Quota Limit Reached</h2>
          </div>
          {quotaUsed !== undefined && quotaLimit !== undefined && (
            <p className="text-white text-opacity-90">
              You've used {quotaUsed} of {quotaLimit} generations this week
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {user?.tier === 'free' ? (
            <>
              <p className="text-dark-brown mb-6">
                You've reached your weekly generation limit. Upgrade to Pro to create more content and unlock premium features!
              </p>

              <div className="bg-periwinkle-light border-2 border-periwinkle rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold text-dark-brown mb-4">
                  Pro Plan - $7/month
                </h3>
                <ul className="space-y-3 mb-4">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">
                      <strong>30 generations per week</strong> (6x more than Free)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">All content types included</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">High-quality Google Cloud TTS</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-brown">Priority support</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleUpgrade}
                className="btn-primary w-full mb-3"
              >
                Upgrade to Pro - $7/month
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="btn-secondary w-full"
                >
                  Maybe Later
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-dark-brown mb-6">
                You've reached your weekly generation limit. Your quota will reset at the start of next week (Monday 00:00 UTC).
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-medium-brown mb-2">
                  <strong>Pro Plan:</strong> 30 generations per week
                </p>
                <p className="text-sm text-medium-brown">
                  <strong>Quota resets:</strong> Every Monday at midnight UTC
                </p>
              </div>

              <button
                onClick={handleViewBilling}
                className="btn-secondary w-full mb-3"
              >
                View Billing Settings
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="btn-secondary w-full"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
