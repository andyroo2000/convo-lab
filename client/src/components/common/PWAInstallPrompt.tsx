import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

import usePWAInstall from '../../hooks/usePWAInstall';

const PWA_PROMPT_DISMISSED_KEY = 'pwa-install-prompt-dismissed';
const PROMPT_DELAY_MS = 3000; // Show prompt after 3 seconds

const isIOSDevice = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  const hasTouch = window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && hasTouch);
};

const PWAInstallPrompt = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = isIOSDevice();
    setIsIOS(ios);

    // iOS Safari does not fire beforeinstallprompt, so iOS install instructions are gated by
    // device/install state rather than by the browser install event.
    const wasDismissed = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY);
    const canShowPrompt = isInstallable || ios;
    if (wasDismissed || isInstalled || !canShowPrompt) {
      return undefined;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, 'true');
  };

  if (!isVisible || isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  // iOS-specific instructions (Safari doesn't support beforeinstallprompt)
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          <div className="relative bg-gradient-to-r from-periwinkle to-dark-periwinkle p-4 text-white">
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-white hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6" />
              <h3 className="font-semibold text-lg">Install ConvoLab</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700">
              Get the full app experience! Install ConvoLab on your home screen:
            </p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap &ldquo;Add to Home Screen&rdquo;</li>
              <li>Tap &ldquo;Add&rdquo; to confirm</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Standard PWA install prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-periwinkle to-dark-periwinkle p-4 text-white relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6" />
            <h3 className="font-semibold text-lg">Install ConvoLab</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700">
            Install ConvoLab for a better experience with offline support and faster loading.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 bg-periwinkle hover:bg-dark-periwinkle text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
